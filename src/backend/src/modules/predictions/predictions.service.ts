import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Prediction, PredictionDocument } from '../../database/schemas/prediction.schema';
import { MarketDataService } from '../market-data/market-data.service';

export interface PredictionStats {
  total: number;
  open: number;
  wins: number;
  losses: number;
  partialWins: number;
  noEntries: number;
  expired: number;
  winRate: number;
  avgConfidence: number;
  avgRr: number;
  currentStreak: number;
  bestStreak: number;
  worstStreak: number;
}

@Injectable()
export class PredictionsService {
  private readonly logger = new Logger(PredictionsService.name);

  constructor(
    @InjectModel(Prediction.name)
    private readonly predictionModel: Model<PredictionDocument>,
    private readonly marketDataService: MarketDataService,
  ) {}

  /**
   * Create a new prediction from an analysis result.
   * Called by the extension after every analysis.
   */
  async create(data: Partial<Prediction>): Promise<Prediction> {
    const prediction = new this.predictionModel({
      ...data,
      status: 'OPEN',
      result: 'PENDING',
      evaluatedAt: null,
    });
    const saved = await prediction.save();
    this.logger.log(
      `Prediction saved: ${saved.symbol} ${saved.recommendation} @ ${saved.confidence}% confidence`,
    );
    return saved;
  }

  /**
   * Find predictions with advanced filtering.
   */
  async findAll(filters: {
    userId?: string;
    symbol?: string;
    status?: string;
    result?: string;
    recommendation?: string;
    timeframe?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }): Promise<{ items: Prediction[]; total: number }> {
    const query: Record<string, unknown> = {};

    if (filters.userId) query.userId = filters.userId;
    if (filters.symbol) query.symbol = filters.symbol.toUpperCase();
    if (filters.status) query.status = filters.status;
    if (filters.result) query.result = filters.result;
    if (filters.recommendation) query.recommendation = filters.recommendation;
    if (filters.timeframe) query.timeframe = filters.timeframe;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {} as Record<string, Date>;
      if (filters.startDate) (query.createdAt as Record<string, Date>)['$gte'] = new Date(filters.startDate);
      if (filters.endDate) (query.createdAt as Record<string, Date>)['$lte'] = new Date(filters.endDate);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const sortField = filters.sort === 'confidence' ? 'confidence' : 'createdAt';
    const sortDir = filters.sort === 'confidence' ? -1 : -1;

    const [items, total] = await Promise.all([
      this.predictionModel
        .find(query)
        .sort({ [sortField]: sortDir })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.predictionModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  /**
   * Get a single prediction by ID.
   */
  async findOne(id: string): Promise<PredictionDocument> {
    const prediction = await this.predictionModel.findById(id).exec();
    if (!prediction) throw new NotFoundException(`Prediction ${id} not found`);
    return prediction;
  }

  /**
   * Delete a prediction.
   */
  async remove(id: string): Promise<void> {
    const prediction = await this.findOne(id);
    await this.predictionModel.findByIdAndDelete(id).exec();
  }

  /**
   * Get aggregate statistics for a user's predictions.
   */
  async getStats(userId: string): Promise<PredictionStats> {
    const all = await this.predictionModel.find({ userId }).sort({ createdAt: -1 }).exec();

    const open = all.filter((p) => p.status === 'OPEN').length;
    const wins = all.filter((p) => p.result === 'WIN').length;
    const losses = all.filter((p) => p.result === 'LOSS').length;
    const partialWins = all.filter((p) => p.result === 'PARTIAL_WIN').length;
    const noEntries = all.filter((p) => p.result === 'NO_ENTRY').length;
    const expired = all.filter((p) => p.result === 'EXPIRED').length;

    const resolved = all.filter((p) => p.result !== 'PENDING' && p.result !== 'NO_ENTRY');
    const totalResolved = resolved.length;
    const winRate = totalResolved > 0 ? ((wins + partialWins) / totalResolved) * 100 : 0;

    const totalConfidence = all.reduce((sum, p) => sum + (p.confidence || 0), 0);
    const avgConfidence = all.length > 0 ? totalConfidence / all.length : 0;

    const withRr = all.filter((p) => (p.riskRewardRatio ?? 0) > 0);
    const avgRr = withRr.length > 0
      ? withRr.reduce((sum, p) => sum + (p.riskRewardRatio ?? 0), 0) / withRr.length
      : 0;

    // Calculate streaks — scan entire history from oldest to newest
    // to find all-time best winning streak and worst losing streak
    const ascending = [...all]
      .filter((p) => p.result === 'WIN' || p.result === 'LOSS' || p.result === 'PARTIAL_WIN')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let bestStreak = 0;
    let worstStreak = 0;
    let winRun = 0;
    let lossRun = 0;

    for (const p of ascending) {
      if (p.result === 'WIN' || p.result === 'PARTIAL_WIN') {
        winRun++;
        lossRun = 0;
        bestStreak = Math.max(bestStreak, winRun);
      } else if (p.result === 'LOSS') {
        lossRun++;
        winRun = 0;
        worstStreak = Math.max(worstStreak, lossRun);
      }
    }

    // Current streak (walk from newest until sign change)
    const descending = [...ascending].reverse();
    let currentStreak = 0;
    if (descending.length > 0) {
      const firstResult = descending[0].result;
      const isFirstWin = firstResult === 'WIN' || firstResult === 'PARTIAL_WIN';
      for (const p of descending) {
        const isWin = p.result === 'WIN' || p.result === 'PARTIAL_WIN';
        if (isWin === isFirstWin) {
          currentStreak = isWin ? currentStreak + 1 : currentStreak - 1;
        } else break;
      }
      currentStreak = Math.abs(currentStreak);
    }

    return {
      total: all.length,
      open,
      wins,
      losses,
      partialWins,
      noEntries,
      expired,
      winRate: parseFloat(winRate.toFixed(1)),
      avgConfidence: parseFloat(avgConfidence.toFixed(1)),
      avgRr: parseFloat(avgRr.toFixed(2)),
      currentStreak,
      bestStreak,
      worstStreak: Math.abs(worstStreak),
    };
  }

  /**
   * Get predictions grouped by confidence buckets for calibration.
   */
  async getConfidenceCalibration(userId: string): Promise<
    Array<{
      bucket: string;
      total: number;
      wins: number;
      losses: number;
      winRate: number;
    }>
  > {
    const all = await this.predictionModel
      .find({ userId, result: { $in: ['WIN', 'LOSS', 'PARTIAL_WIN'] } })
      .exec();

    const buckets: Record<string, { total: number; wins: number }> = {
      '90-100': { total: 0, wins: 0 },
      '80-89': { total: 0, wins: 0 },
      '70-79': { total: 0, wins: 0 },
      '60-69': { total: 0, wins: 0 },
      '50-59': { total: 0, wins: 0 },
      '40-49': { total: 0, wins: 0 },
      '30-39': { total: 0, wins: 0 },
      '20-29': { total: 0, wins: 0 },
      '0-19': { total: 0, wins: 0 },
    };

    for (const p of all) {
      const conf = p.confidence;
      let key = '0-19';
      if (conf >= 90) key = '90-100';
      else if (conf >= 80) key = '80-89';
      else if (conf >= 70) key = '70-79';
      else if (conf >= 60) key = '60-69';
      else if (conf >= 50) key = '50-59';
      else if (conf >= 40) key = '40-49';
      else if (conf >= 30) key = '30-39';
      else if (conf >= 20) key = '20-29';

      buckets[key].total++;
      if (p.result === 'WIN' || p.result === 'PARTIAL_WIN') buckets[key].wins++;
    }

    return Object.entries(buckets)
      .filter(([_, v]) => v.total > 0)
      .map(([bucket, data]) => ({
        bucket,
        total: data.total,
        wins: data.wins,
        losses: data.total - data.wins,
        winRate: data.total > 0 ? parseFloat(((data.wins / data.total) * 100).toFixed(1)) : 0,
      }));
  }

  /**
   * Get symbol-specific performance statistics.
   */
  async getSymbolPerformance(userId: string): Promise<
    Array<{
      symbol: string;
      total: number;
      wins: number;
      losses: number;
      winRate: number;
      avgConfidence: number;
      avgRr: number;
    }>
  > {
    const all = await this.predictionModel.find({ userId }).exec();
    const bySymbol: Record<string, Prediction[]> = {};

    for (const p of all) {
      if (!bySymbol[p.symbol]) bySymbol[p.symbol] = [];
      bySymbol[p.symbol].push(p);
    }

    return Object.entries(bySymbol)
      .map(([symbol, predictions]) => {
        const resolved = predictions.filter(
          (p) => p.result === 'WIN' || p.result === 'LOSS' || p.result === 'PARTIAL_WIN',
        );
        const wins = resolved.filter(
          (p) => p.result === 'WIN' || p.result === 'PARTIAL_WIN',
        ).length;

        return {
          symbol,
          total: predictions.length,
          wins,
          losses: resolved.length - wins,
          winRate: resolved.length > 0 ? parseFloat(((wins / resolved.length) * 100).toFixed(1)) : 0,
          avgConfidence: parseFloat(
            (predictions.reduce((s, p) => s + (p.confidence || 0), 0) / predictions.length).toFixed(1),
          ),
          avgRr: parseFloat(
            (
              predictions.filter((p) => (p.riskRewardRatio ?? 0) > 0).reduce((s, p) => s + (p.riskRewardRatio ?? 0), 0) /
                Math.max(1, predictions.filter((p) => (p.riskRewardRatio ?? 0) > 0).length)
            ).toFixed(2),
          ),
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Get timeframe-specific performance statistics.
   */
  async getTimeframePerformance(userId: string): Promise<
    Array<{
      timeframe: string;
      total: number;
      wins: number;
      winRate: number;
      avgConfidence: number;
    }>
  > {
    const all = await this.predictionModel.find({ userId }).exec();
    const byTimeframe: Record<string, Prediction[]> = {};

    for (const p of all) {
      const tf = p.timeframe || '1D';
      if (!byTimeframe[tf]) byTimeframe[tf] = [];
      byTimeframe[tf].push(p);
    }

    return Object.entries(byTimeframe)
      .map(([timeframe, predictions]) => {
        const resolved = predictions.filter(
          (p) => p.result === 'WIN' || p.result === 'LOSS',
        );
        const wins = resolved.filter((p) => p.result === 'WIN').length;

        return {
          timeframe,
          total: predictions.length,
          wins,
          winRate: resolved.length > 0 ? parseFloat(((wins / resolved.length) * 100).toFixed(1)) : 0,
          avgConfidence: parseFloat(
            (predictions.reduce((s, p) => s + (p.confidence || 0), 0) / predictions.length).toFixed(1),
          ),
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Get monthly/weekly performance trend.
   */
  async getPerformanceTrend(
    userId: string,
    groupBy: 'week' | 'month' = 'month',
  ): Promise<
    Array<{
      period: string;
      total: number;
      wins: number;
      losses: number;
      winRate: number;
      avgConfidence: number;
    }>
  > {
    const all = await this.predictionModel
      .find({ userId, result: { $in: ['WIN', 'LOSS', 'PARTIAL_WIN'] } })
      .sort({ createdAt: 1 })
      .exec();

    const grouped: Record<string, Prediction[]> = {};

    for (const p of all) {
      const d = p.createdAt;
      const key =
        groupBy === 'month'
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          : `${d.getFullYear()}-W${String(Math.ceil(d.getDate() / 7)).padStart(2, '0')}`;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    }

    return Object.entries(grouped)
      .map(([period, predictions]) => {
        const wins = predictions.filter(
          (p) => p.result === 'WIN' || p.result === 'PARTIAL_WIN',
        ).length;

        return {
          period,
          total: predictions.length,
          wins,
          losses: predictions.length - wins,
          winRate: parseFloat(((wins / predictions.length) * 100).toFixed(1)),
          avgConfidence: parseFloat(
            (predictions.reduce((s, p) => s + (p.confidence || 0), 0) / predictions.length).toFixed(1),
          ),
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }
}
