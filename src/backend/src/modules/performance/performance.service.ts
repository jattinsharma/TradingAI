import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Prediction, PredictionDocument } from '../../database/schemas/prediction.schema';
import { TradeJournal, TradeJournalDocument } from '../../database/schemas/trade-journal.schema';
import { safeToFixed } from '../../common/utils/safe-numeric.util';

export interface OverallPerformance {
  totalPredictions: number;
  totalTrades: number;
  wins: number;
  losses: number;
  partialWins: number;
  pending: number;
  winRate: number;
  avgConfidence: number;
  avgRr: number;
  avgMfe: number;
  avgMae: number;
  bestStreak: number;
  worstStreak: number;
  currentStreak: number;
  totalPnl: number;
  monthlyStats: Array<{
    month: string;
    total: number;
    wins: number;
    winRate: number;
  }>;
}

export interface AssetPerformance {
  symbol: string;
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  avgConfidence: number;
  avgRr: number;
  totalPnl: number;
}

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);

  constructor(
    @InjectModel(Prediction.name)
    private readonly predictionModel: Model<PredictionDocument>,
    @InjectModel(TradeJournal.name)
    private readonly tradeJournalModel: Model<TradeJournalDocument>,
  ) {}

  /**
   * Get overall performance metrics for a user.
   */
  async getOverall(userId: string): Promise<OverallPerformance> {
    const predictions = await this.predictionModel.find({ userId }).exec();
    const trades = await this.tradeJournalModel.find({ userId }).exec();

    const wins = predictions.filter((p) => p.result === 'WIN').length;
    const losses = predictions.filter((p) => p.result === 'LOSS').length;
    const partialWins = predictions.filter((p) => p.result === 'PARTIAL_WIN').length;
    const pending = predictions.filter(
      (p) => p.result === 'PENDING' || p.status === 'OPEN',
    ).length;

    const resolved = wins + losses + partialWins;
    const winRate = resolved > 0 ? (wins + partialWins) / resolved * 100 : 0;

    const totalConf = predictions.reduce((s, p) => s + (p.confidence || 0), 0);
    const avgConf = predictions.length > 0 ? totalConf / predictions.length : 0;

    const withRr = predictions.filter((p) => (p.riskRewardRatio ?? 0) > 0);
    const avgRr = withRr.length > 0
      ? withRr.reduce((s, p) => s + (p.riskRewardRatio ?? 0), 0) / withRr.length
      : 0;

    const withMfe = predictions.filter((p) => (p.mfe ?? 0) !== 0);
    const avgMfe = withMfe.length > 0
      ? withMfe.reduce((s, p) => s + (p.mfe ?? 0), 0) / withMfe.length
      : 0;

    const withMae = predictions.filter((p) => (p.mae ?? 0) !== 0);
    const avgMae = withMae.length > 0
      ? withMae.reduce((s, p) => s + (p.mae ?? 0), 0) / withMae.length
      : 0;

    // Streak calculation — scan ENTIRE history
    const sortedDesc = [...predictions]
      .filter((p) => p.result === 'WIN' || p.result === 'LOSS' || p.result === 'PARTIAL_WIN')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // All-time best/worst streak (scan all predictions ascending)
    const ascending = [...sortedDesc].reverse();
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
    let currentStreak = 0;
    if (sortedDesc.length > 0) {
      const firstResult = sortedDesc[0].result;
      const isFirstWin = firstResult === 'WIN' || firstResult === 'PARTIAL_WIN';
      for (const p of sortedDesc) {
        const isWin = p.result === 'WIN' || p.result === 'PARTIAL_WIN';
        if (isWin === isFirstWin) {
          currentStreak = isWin ? currentStreak + 1 : currentStreak - 1;
        } else break;
      }
      currentStreak = Math.abs(currentStreak);
    }

    // Monthly stats
    const monthlyMap: Record<string, { total: number; wins: number }> = {};
    for (const p of predictions.filter((p) => p.result === 'WIN' || p.result === 'LOSS')) {
      const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { total: 0, wins: 0 };
      monthlyMap[key].total++;
      if (p.result === 'WIN') monthlyMap[key].wins++;
    }

    const monthlyStats = Object.entries(monthlyMap)
      .map(([month, data]) => ({
        month,
        total: data.total,
        wins: data.wins,
        winRate: data.total > 0 ? safeToFixed((data.wins / data.total) * 100, 1) : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Total P&L from trade journal
    const totalPnl = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);

    return {
      totalPredictions: predictions.length,
      totalTrades: trades.length,
      wins,
      losses,
      partialWins,
      pending,
      winRate: safeToFixed(winRate, 1),
      avgConfidence: safeToFixed(avgConf, 1),
      avgRr: safeToFixed(avgRr, 2),
      avgMfe: safeToFixed(avgMfe, 2),
      avgMae: safeToFixed(avgMae, 2),
      bestStreak: Math.abs(bestStreak),
      worstStreak: Math.abs(worstStreak),
      currentStreak: Math.abs(currentStreak),
      monthlyStats,
      totalPnl,
    };
  }

  /**
   * Get asset-level performance.
   */
  async getAssetPerformance(userId: string): Promise<AssetPerformance[]> {
    const predictions = await this.predictionModel.find({ userId }).exec();
    const trades = await this.tradeJournalModel.find({ userId }).exec();

    // Build P&L by symbol from trade journal
    const pnlBySymbol: Record<string, number> = {};
    for (const t of trades) {
      pnlBySymbol[t.symbol] = (pnlBySymbol[t.symbol] || 0) + (Number(t.pnl) || 0);
    }

    // Group predictions by symbol
    const bySymbol: Record<string, Prediction[]> = {};
    for (const p of predictions) {
      if (!bySymbol[p.symbol]) bySymbol[p.symbol] = [];
      bySymbol[p.symbol].push(p);
    }

    return Object.entries(bySymbol)
      .map(([symbol, preds]) => {
        const resolved = preds.filter(
          (p) => p.result === 'WIN' || p.result === 'LOSS' || p.result === 'PARTIAL_WIN',
        );
        const wins = resolved.filter((p) => p.result === 'WIN' || p.result === 'PARTIAL_WIN').length;

        return {
          symbol,
          total: preds.length,
          wins,
          losses: resolved.length - wins,
          winRate: resolved.length > 0
            ? safeToFixed((wins / resolved.length) * 100, 1)
            : 0,
          avgConfidence: safeToFixed(
            preds.reduce((s, p) => s + (p.confidence || 0), 0) / preds.length, 1,
          ),
          avgRr: safeToFixed(
            preds.filter((p) => (p.riskRewardRatio ?? 0) > 0)
              .reduce((s, p) => s + (p.riskRewardRatio ?? 0), 0) /
            Math.max(1, preds.filter((p) => (p.riskRewardRatio ?? 0) > 0).length), 2,
          ),
          totalPnl: pnlBySymbol[symbol] || 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Get the best and worst performing assets.
   */
  async getBestAndWorstAssets(userId: string): Promise<{
    best: AssetPerformance | null;
    worst: AssetPerformance | null;
  }> {
    const all = await this.getAssetPerformance(userId);
    const withMinimum = all.filter((a) => a.total >= 3);

    return {
      best: withMinimum.length > 0
        ? withMinimum.reduce((a, b) => (a.winRate > b.winRate ? a : b))
        : null,
      worst: withMinimum.length > 0
        ? withMinimum.reduce((a, b) => (a.winRate < b.winRate ? a : b))
        : null,
    };
  }
}
