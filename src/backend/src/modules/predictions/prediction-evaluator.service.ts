import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prediction, PredictionDocument } from '../../database/schemas/prediction.schema';
import { IndicatorStats, IndicatorStatsDocument } from '../../database/schemas/indicator-stats.schema';
import { MarketDataService } from '../market-data/market-data.service';

export interface PredictionEvaluationResult {
  predictionId: string;
  symbol: string;
  status: string;
  result: string;
  mfe: number;
  mae: number;
  entryTriggered: boolean;
  slHit: boolean;
  tp1Hit: boolean;
  tp2Hit: boolean;
}

@Injectable()
export class PredictionEvaluatorService {
  private readonly logger = new Logger(PredictionEvaluatorService.name);

  constructor(
    @InjectModel(Prediction.name)
    private readonly predictionModel: Model<PredictionDocument>,
    @InjectModel(IndicatorStats.name)
    private readonly indicatorStatsModel: Model<IndicatorStatsDocument>,
    private readonly marketDataService: MarketDataService,
  ) {}

  /**
   * Evaluate a single open prediction against live market data.
   * Checks entry trigger, TP1/TP2 hits, SL hit, and calculates MFE/MAE.
   */
  async evaluatePrediction(prediction: PredictionDocument): Promise<PredictionEvaluationResult> {
    const { symbol, entryPrice, stopLoss, takeProfit1, takeProfit2, recommendation } = prediction;

    // Get live quote
    const quote = await this.marketDataService.getQuote(symbol);
    if (!quote) {
      this.logger.warn(`Cannot evaluate ${prediction._id}: no market data for ${symbol}`);
      return {
        predictionId: prediction._id,
        symbol,
        status: prediction.status,
        result: prediction.result,
        mfe: prediction.mfe ?? 0,
        mae: prediction.mae ?? 0,
        entryTriggered: prediction.entryTriggered ?? false,
        slHit: false,
        tp1Hit: false,
        tp2Hit: false,
      };
    }

    const currentPrice = quote.price;

    // Determine direction
    const isBullish = recommendation === 'BUY' || recommendation === 'STRONG_BUY';
    const isBearish = recommendation === 'SELL' || recommendation === 'STRONG_SELL';

    // Calculate MFE/MAE
    let mfe = prediction.mfe ?? 0;
    let mae = prediction.mae ?? 0;

    if (isBullish && entryPrice && entryPrice > 0) {
      const priceChangePct = ((currentPrice - entryPrice) / entryPrice) * 100;
      mfe = Math.max(mfe, priceChangePct);
      mae = Math.min(mae, priceChangePct);
    } else if (isBearish && entryPrice && entryPrice > 0) {
      const priceChangePct = ((entryPrice - currentPrice) / entryPrice) * 100;
      mfe = Math.max(mfe, priceChangePct);
      mae = Math.min(mae, priceChangePct);
    }

    // Check entry trigger
    const entryTriggered = prediction.entryTriggered ?? false;
    let entryTriggeredAt = prediction.entryTriggeredAt;

    if (!entryTriggered && entryPrice && entryPrice > 0) {
      const priceCrossedEntry = isBullish
        ? currentPrice >= entryPrice
        : isBearish
          ? currentPrice <= entryPrice
          : false;

      if (priceCrossedEntry) {
        entryTriggeredAt = new Date();
      }
    }

    // Only check TP/SL if entry was triggered
    let status = prediction.status;
    let result = prediction.result;
    let slHit = false;
    let tp1Hit = false;
    let tp2Hit = false;

    const effectiveEntryTriggered = entryTriggered || !!entryTriggeredAt;

    if (effectiveEntryTriggered && entryPrice && entryPrice > 0) {
      // Check SL hit
      if (stopLoss && stopLoss > 0) {
        const slCrossed = isBullish
          ? currentPrice <= stopLoss
          : isBearish
            ? currentPrice >= stopLoss
            : false;

        if (slCrossed && status === 'OPEN') {
          status = 'SL_HIT';
          result = 'LOSS';
          slHit = true;
        }
      }

      // Check TP1 hit (only if still open)
      if (takeProfit1 && takeProfit1 > 0 && status === 'OPEN') {
        const tp1Crossed = isBullish
          ? currentPrice >= takeProfit1
          : isBearish
            ? currentPrice <= takeProfit1
            : false;

        if (tp1Crossed) {
          status = 'TP1_HIT';
          result = 'PARTIAL_WIN';
          tp1Hit = true;
        }
      }

      // Check TP2 hit (only if TP1 already hit)
      if (takeProfit2 && takeProfit2 > 0 && status === 'TP1_HIT') {
        const tp2Crossed = isBullish
          ? currentPrice >= takeProfit2
          : isBearish
            ? currentPrice <= takeProfit2
            : false;

        if (tp2Crossed) {
          status = 'TP2_HIT';
          result = 'WIN';
          tp2Hit = true;
        }
      }
    }

    // Update prediction document
    prediction.mfe = mfe;
    prediction.mae = mae;
    prediction.entryTriggered = effectiveEntryTriggered;
    if (entryTriggeredAt) prediction.entryTriggeredAt = entryTriggeredAt;
    if (slHit) prediction.slHitAt = new Date();
    if (tp1Hit) prediction.tp1HitAt = new Date();
    if (tp2Hit) prediction.tp2HitAt = new Date();
    prediction.status = status;
    prediction.result = result;
    prediction.evaluatedAt = new Date();

    await prediction.save();

    // If the prediction resolved, update indicator stats
    if (result !== 'PENDING' && status !== 'OPEN') {
      await this.updateIndicatorStats(prediction);
    }

    return {
      predictionId: prediction._id,
      symbol,
      status,
      result,
      mfe,
      mae,
      entryTriggered: effectiveEntryTriggered,
      slHit,
      tp1Hit,
      tp2Hit,
    };
  }

  /**
   * Update indicator performance stats after a prediction resolves.
   */
  private async updateIndicatorStats(prediction: PredictionDocument): Promise<void> {
    const snapshot = prediction.indicatorSnapshot as Record<string, unknown> | undefined;
    if (!snapshot) return;

    const resolvedResult = prediction.result;
    const isWin = resolvedResult === 'WIN' || resolvedResult === 'PARTIAL_WIN';
    const isLoss = resolvedResult === 'LOSS';
    const isNoEntry = resolvedResult === 'NO_ENTRY';

    // Map each indicator to its signal direction
    const indicatorSignals = this.extractIndicatorSignals(snapshot, prediction.recommendation);

    for (const { name, direction } of indicatorSignals) {
      // Upsert the stats document
      const existing = await this.indicatorStatsModel
        .findOne({
          userId: prediction.userId,
          indicatorName: name,
          signalDirection: direction,
        })
        .exec();

      if (existing) {
        existing.totalPredictions += 1;
        if (isWin) existing.wins += 1;
        else if (isLoss) existing.losses += 1;
        else if (isNoEntry) existing.noEntries += 1;
        else existing.partialWins += 1;
        existing.totalConfidence += prediction.confidence;
        existing.avgConfidence = existing.totalConfidence / existing.totalPredictions;
        existing.lastUpdated = new Date();
        await existing.save();
      } else {
        await this.indicatorStatsModel.create({
          userId: prediction.userId,
          indicatorName: name,
          signalDirection: direction,
          totalPredictions: 1,
          wins: isWin ? 1 : 0,
          losses: isLoss ? 1 : 0,
          partialWins: isWin ? 0 : isLoss ? 0 : 1,
          noEntries: isNoEntry ? 1 : 0,
          avgConfidence: prediction.confidence,
          totalConfidence: prediction.confidence,
          lastUpdated: new Date(),
        } as unknown as IndicatorStats);
      }
    }
  }

  /**
   * Extract indicator signal directions from the indicator snapshot.
   * Returns an array of { name, direction } pairs.
   */
  private extractIndicatorSignals(
    snapshot: Record<string, unknown>,
    recommendation: string,
  ): Array<{ name: string; direction: string }> {
    const signals: Array<{ name: string; direction: string }> = [];
    const isBullish = recommendation === 'BUY' || recommendation === 'STRONG_BUY';
    const direction = isBullish ? 'BULLISH' : 'BEARISH';

    // RSI
    const rsi = snapshot['rsi'] as number | undefined;
    if (rsi !== undefined) {
      signals.push({ name: 'RSI', direction: rsi > 50 ? 'BULLISH' : rsi < 50 ? 'BEARISH' : 'NEUTRAL' });
    }

    // MACD
    const macdHistogram = snapshot['macdHistogram'] as number | undefined;
    if (macdHistogram !== undefined) {
      signals.push({ name: 'MACD', direction: macdHistogram > 0 ? 'BULLISH' : 'BEARISH' });
    }

    // EMA indicators
    const ema20 = snapshot['ema20'] as number | undefined;
    if (ema20 !== undefined && snapshot['currentPrice'] !== undefined) {
      const price = snapshot['currentPrice'] as number;
      signals.push({ name: 'EMA', direction: price > ema20 ? 'BULLISH' : 'BEARISH' });
    }

    // ADX
    const adx = snapshot['adx'] as number | undefined;
    if (adx !== undefined) {
      signals.push({ name: 'ADX', direction: adx > 25 ? direction : 'NEUTRAL' });
    }

    // ATR (volatility — directionless, track anyway)
    signals.push({ name: 'ATR', direction: 'NEUTRAL' });

    // Bollinger Bands position
    const bbUpper = snapshot['bollingerUpper'] as number | undefined;
    const bbLower = snapshot['bollingerLower'] as number | undefined;
    const close = snapshot['currentPrice'] as number | undefined;
    if (bbUpper !== undefined && bbLower !== undefined && close !== undefined) {
      const bbPosition = (close - bbLower) / (bbUpper - bbLower);
      signals.push({ name: 'BOLLINGER', direction: bbPosition > 0.5 ? 'BULLISH' : 'BEARISH' });
    }

    // VWAP
    const vwap = snapshot['vwap'] as number | undefined;
    if (vwap !== undefined && snapshot['currentPrice'] !== undefined) {
      const price_vwap = snapshot['currentPrice'] as number;
      signals.push({ name: 'VWAP', direction: price_vwap > vwap ? 'BULLISH' : 'BEARISH' });
    }

    // Stochastic
    const stochK = snapshot['stochasticK'] as number | undefined;
    if (stochK !== undefined) {
      signals.push({ name: 'STOCHASTIC', direction: stochK > 50 ? 'BULLISH' : 'BEARISH' });
    }

    // OBV trend
    const obv = snapshot['obv'] as number | undefined;
    if (obv !== undefined) {
      signals.push({ name: 'OBV', direction: obv > 0 ? 'BULLISH' : 'BEARISH' });
    }

    return signals;
  }

  /**
   * Evaluate all open predictions that haven't been evaluated recently.
   * Runs every 5 minutes to check expired/open predictions.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluateOpenPredictions(): Promise<void> {
    this.logger.log('Running scheduled prediction evaluation...');

    // Find predictions that are OPEN (not yet resolved)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const openPredictions = await this.predictionModel
      .find({
        status: 'OPEN',
        $or: [
          { evaluatedAt: { $exists: false } },
          { evaluatedAt: null },
          { evaluatedAt: { $lte: fiveMinutesAgo } },
        ],
      })
      .limit(100)
      .exec();

    this.logger.log(`Found ${openPredictions.length} open predictions to evaluate`);

    for (const prediction of openPredictions) {
      try {
        await this.evaluatePrediction(prediction);
      } catch (error) {
        this.logger.error(
          `Error evaluating prediction ${prediction._id}: ${(error as Error).message}`,
        );
      }
    }

    // Check for expired predictions (> 30 days without evaluation)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const expiredPredictions = await this.predictionModel
      .find({
        status: 'OPEN',
        createdAt: { $lte: thirtyDaysAgo },
      })
      .limit(50)
      .exec();

    for (const pred of expiredPredictions) {
      pred.status = 'EXPIRED';
      pred.result = 'NO_ENTRY';
      pred.evaluatedAt = new Date();
      await pred.save();
      this.logger.log(`Prediction ${pred._id} marked as EXPIRED (created ${pred.createdAt})`);
    }

    if (expiredPredictions.length > 0) {
      this.logger.log(`Marked ${expiredPredictions.length} predictions as EXPIRED`);
    }
  }
}
