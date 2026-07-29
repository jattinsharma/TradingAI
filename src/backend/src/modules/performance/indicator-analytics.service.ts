import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IndicatorStats, IndicatorStatsDocument } from '../../database/schemas/indicator-stats.schema';
import { Prediction, PredictionDocument } from '../../database/schemas/prediction.schema';
import { safeToFixed } from '../../common/utils/safe-numeric.util';

export interface IndicatorAnalysis {
  indicatorName: string;
  totalPredictions: number;
  wins: number;
  losses: number;
  partialWins: number;
  winRate: number;
  avgConfidence: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  bullishWinRate: number;
  bearishWinRate: number;
  bestDirection: string;
}

export interface IndicatorCombination {
  indicators: string[];
  total: number;
  wins: number;
  winRate: number;
}

@Injectable()
export class IndicatorAnalyticsService {
  private readonly logger = new Logger(IndicatorAnalyticsService.name);

  constructor(
    @InjectModel(IndicatorStats.name)
    private readonly statsModel: Model<IndicatorStatsDocument>,
    @InjectModel(Prediction.name)
    private readonly predictionModel: Model<PredictionDocument>,
  ) {}

  /**
   * Get performance stats for every tracked indicator.
   */
  async getAllIndicatorStats(userId: string): Promise<IndicatorAnalysis[]> {
    const all = await this.statsModel.find({ userId }).exec();

    // Group by indicator name
    const byName: Record<string, IndicatorStats[]> = {};
    for (const stat of all) {
      if (!byName[stat.indicatorName]) byName[stat.indicatorName] = [];
      byName[stat.indicatorName].push(stat);
    }

    return Object.entries(byName).map(([name, entries]) => {
      const total = entries.reduce((s, e) => s + e.totalPredictions, 0);
      const wins = entries.reduce((s, e) => s + e.wins, 0);
      const losses = entries.reduce((s, e) => s + e.losses, 0);
      const partialWins = entries.reduce((s, e) => s + e.partialWins, 0);
      const resolved = wins + losses + partialWins;
      const winRate = resolved > 0 ? (wins + partialWins) / resolved * 100 : 0;
      const avgConf = entries.reduce((s, e) => s + e.avgConfidence, 0) / entries.length;

      const bullish = entries.find((e) => e.signalDirection === 'BULLISH');
      const bearish = entries.find((e) => e.signalDirection === 'BEARISH');
      const neutral = entries.find((e) => e.signalDirection === 'NEUTRAL');

      const bullishWinRate = bullish && (bullish.wins + bullish.losses) > 0
        ? bullish.wins / (bullish.wins + bullish.losses) * 100 : 0;
      const bearishWinRate = bearish && (bearish.wins + bearish.losses) > 0
        ? bearish.wins / (bearish.wins + bearish.losses) * 100 : 0;

      const bestDir = bullishWinRate >= bearishWinRate ? 'BULLISH' : 'BEARISH';

      return {
        indicatorName: name,
        totalPredictions: total,
        wins,
        losses,
        partialWins,
        winRate: safeToFixed(winRate, 1),
        avgConfidence: safeToFixed(avgConf, 1),
        bullishCount: bullish?.totalPredictions ?? 0,
        bearishCount: bearish?.totalPredictions ?? 0,
        neutralCount: neutral?.totalPredictions ?? 0,
        bullishWinRate: safeToFixed(bullishWinRate, 1),
        bearishWinRate: safeToFixed(bearishWinRate, 1),
        bestDirection: bestDir,
      };
    });
  }

  /**
   * Get the top-performing indicators sorted by win rate.
   */
  async getTopIndicators(userId: string, limit: number = 5): Promise<IndicatorAnalysis[]> {
    const all = await this.getAllIndicatorStats(userId);
    return all
      .filter((i) => i.totalPredictions >= 3) // Minimum sample size
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, limit);
  }

  /**
   * Get the worst-performing indicators sorted by win rate.
   */
  async getWorstIndicators(userId: string, limit: number = 5): Promise<IndicatorAnalysis[]> {
    const all = await this.getAllIndicatorStats(userId);
    return all
      .filter((i) => i.totalPredictions >= 3)
      .sort((a, b) => a.winRate - b.winRate)
      .slice(0, limit);
  }

  /**
   * Detect which combinations of indicators produce the best results.
   * Analyzes predictions to find common indicator sets that won vs lost.
   */
  async getBestCombinations(userId: string): Promise<IndicatorCombination[]> {
    const predictions = await this.predictionModel
      .find({
        userId,
        result: { $in: ['WIN', 'LOSS', 'PARTIAL_WIN'] },
        indicatorSnapshot: { $exists: true, $ne: null },
      })
      .limit(500)
      .exec();

    // Build combinations from indicator snapshots
    const combos: Record<string, { wins: number; total: number }> = {};

    for (const pred of predictions) {
      const snapshot = pred.indicatorSnapshot as Record<string, unknown> | undefined;
      if (!snapshot) continue;

      const detectedIndicators = Object.keys(snapshot).filter(
        (k) => typeof snapshot[k] === 'number' && snapshot[k] !== undefined,
      ).slice(0, 5); // Top 5 indicators

      if (detectedIndicators.length < 2) continue;

      const key = [...detectedIndicators].sort().join('+');
      if (!combos[key]) combos[key] = { wins: 0, total: 0 };
      combos[key].total++;

      if (pred.result === 'WIN' || pred.result === 'PARTIAL_WIN') {
        combos[key].wins++;
      }
    }

    return Object.entries(combos)
      .filter(([_, v]) => v.total >= 3)
      .map(([indicators, data]) => ({
        indicators: indicators.split('+'),
        total: data.total,
        wins: data.wins,
        winRate: safeToFixed((data.wins / data.total) * 100, 1),
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 15);
  }

  /**
   * Get the confidence calibration data from indicator performance.
   */
  async getConfidenceCalibration(userId: string): Promise<
    Array<{ range: string; winRate: number; total: number }>
  > {
    const predictions = await this.predictionModel
      .find({
        userId,
        result: { $in: ['WIN', 'LOSS', 'PARTIAL_WIN'] },
      })
      .exec();

    const buckets: Record<string, { wins: number; total: number }> = {
      '≤30': { wins: 0, total: 0 },
      '31-40': { wins: 0, total: 0 },
      '41-50': { wins: 0, total: 0 },
      '51-60': { wins: 0, total: 0 },
      '61-70': { wins: 0, total: 0 },
      '71-80': { wins: 0, total: 0 },
      '81-90': { wins: 0, total: 0 },
      '>90': { wins: 0, total: 0 },
    };

    for (const p of predictions) {
      const conf = p.confidence || 50;
      let key = '≤30';
      if (conf > 90) key = '>90';
      else if (conf > 80) key = '81-90';
      else if (conf > 70) key = '71-80';
      else if (conf > 60) key = '61-70';
      else if (conf > 50) key = '51-60';
      else if (conf > 40) key = '41-50';
      else if (conf > 30) key = '31-40';

      buckets[key].total++;
      if (p.result === 'WIN' || p.result === 'PARTIAL_WIN') buckets[key].wins++;
    }

    return Object.entries(buckets)
      .filter(([_, v]) => v.total > 0)
      .map(([range, data]) => ({
        range,
        total: data.total,
        winRate: data.total > 0 ? safeToFixed((data.wins / data.total) * 100, 1) : 0,
      }));
  }


}
