import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Analysis, AnalysisDocument } from '../../database/schemas/analysis.schema';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectModel(Analysis.name)
    private readonly model: Model<AnalysisDocument>,
  ) {}

  async create(data: Partial<Analysis>): Promise<Analysis> {
    const created = new this.model(data);
    const saved = await created.save();
    this.logger.log(`Analysis saved: ${saved.symbol} ${saved.recommendation} (${saved.confidence}%)`);
    return saved;
  }

  async findAll(filters: {
    symbol?: string;
    recommendation?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }): Promise<{ items: Analysis[]; total: number }> {
    const query: Record<string, unknown> = {};

    if (filters.symbol) query.symbol = filters.symbol.toUpperCase();
    if (filters.recommendation) query.recommendation = filters.recommendation;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) (query.createdAt as Record<string, Date>)['$gte'] = new Date(filters.startDate);
      if (filters.endDate) (query.createdAt as Record<string, Date>)['$lte'] = new Date(filters.endDate);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [items, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  async findOne(id: string): Promise<AnalysisDocument> {
    const analysis = await this.model.findById(id).exec();
    if (!analysis) throw new NotFoundException(`Analysis ${id} not found`);
    return analysis;
  }

  async getStats(symbol?: string): Promise<{
    totalAnalyses: number;
    buyCount: number;
    sellCount: number;
    holdCount: number;
    avgConfidence: number;
    outcomeStats: { wins: number; losses: number; pending: number };
    recentAnalyses: Analysis[];
  }> {
    const query = symbol ? { symbol: symbol.toUpperCase() } : {};
    const all = await this.model.find(query).sort({ createdAt: -1 }).exec();

    const buyCount = all.filter((a) => a.recommendation === 'BUY' || a.recommendation === 'STRONG_BUY').length;
    const sellCount = all.filter((a) => a.recommendation === 'SELL' || a.recommendation === 'STRONG_SELL').length;
    const holdCount = all.filter((a) => a.recommendation === 'HOLD').length;

    const totalConfidence = all.reduce((sum, a) => sum + Number(a.confidence), 0);
    const avgConfidence = all.length > 0 ? totalConfidence / all.length : 0;

    const outcomeStats = {
      wins: all.filter((a) => a.outcome === 'WIN').length,
      losses: all.filter((a) => a.outcome === 'LOSS').length,
      pending: all.filter((a) => a.outcome === 'PENDING' || !a.outcome).length,
    };

    return {
      totalAnalyses: all.length,
      buyCount,
      sellCount,
      holdCount,
      avgConfidence,
      outcomeStats,
      recentAnalyses: all.slice(0, 10),
    };
  }

  async updateOutcome(id: string, outcome: 'WIN' | 'LOSS' | 'PENDING'): Promise<AnalysisDocument> {
    const analysis = await this.findOne(id);
    analysis.outcome = outcome;
    return analysis.save();
  }
}
