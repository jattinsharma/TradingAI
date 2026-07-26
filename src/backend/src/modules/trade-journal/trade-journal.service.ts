import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TradeJournal, TradeJournalDocument } from '../../database/schemas/trade-journal.schema';

@Injectable()
export class TradeJournalService {
  private readonly logger = new Logger(TradeJournalService.name);

  constructor(
    @InjectModel(TradeJournal.name)
    private readonly model: Model<TradeJournalDocument>,
  ) {}

  async create(data: Partial<TradeJournal>): Promise<TradeJournal> {
    const created = new this.model(data);
    const saved = await created.save();
    this.logger.log(`Trade entry saved: ${saved.symbol} ${saved.side} @ ${saved.entryPrice}`);
    return saved;
  }

  async findAll(filters: {
    symbol?: string;
    result?: string;
    side?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{ items: TradeJournal[]; total: number }> {
    const query: Record<string, unknown> = {};

    if (filters.symbol) query.symbol = filters.symbol.toUpperCase();
    if (filters.result) query.actualResult = filters.result;
    if (filters.side) query.side = filters.side;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) (query.createdAt as Record<string, Date>)['$gte'] = new Date(filters.startDate);
      if (filters.endDate) (query.createdAt as Record<string, Date>)['$lte'] = new Date(filters.endDate);
    }

    const limit = filters.limit || 50;
    const [items, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  async findOne(id: string): Promise<TradeJournalDocument> {
    const entry = await this.model.findById(id).exec();
    if (!entry) throw new NotFoundException(`Trade entry ${id} not found`);
    return entry;
  }

  async update(id: string, data: Partial<TradeJournal>): Promise<TradeJournalDocument> {
    const entry = await this.findOne(id);
    Object.assign(entry, data);
    return entry.save();
  }

  async remove(id: string): Promise<void> {
    const entry = await this.findOne(id);
    await this.model.findByIdAndDelete(id).exec();
  }

  async getStats(): Promise<{
    totalTrades: number;
    wins: number;
    losses: number;
    breakEvens: number;
    openTrades: number;
    winRate: number;
    totalPnl: number;
    totalPnlPercent: number;
    bestTrade: number;
    worstTrade: number;
    avgWinPercent: number;
    avgLossPercent: number;
    topSymbols: Array<{ symbol: string; count: number }>;
    recentTrades: TradeJournal[];
  }> {
    const all = await this.model.find().sort({ createdAt: -1 }).exec();

    const wins = all.filter((t) => t.actualResult === 'WIN');
    const losses = all.filter((t) => t.actualResult === 'LOSS');
    const breakEvens = all.filter((t) => t.actualResult === 'BREAK_EVEN');
    const open = all.filter((t) => t.actualResult === 'OPEN' || !t.actualResult);

    const closed = [...wins, ...losses, ...breakEvens];
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

    const totalPnl = all.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
    const totalPnlPercent = all.reduce((sum, t) => sum + (Number(t.pnlPercent) || 0), 0);

    const bestTrade = Math.max(...closed.map((t) => Number(t.pnl) || 0), 0);
    const worstTrade = Math.min(...closed.map((t) => Number(t.pnl) || 0), 0);

    const avgWinPercent =
      wins.length > 0 ? wins.reduce((sum, t) => sum + (Number(t.pnlPercent) || 0), 0) / wins.length : 0;
    const avgLossPercent =
      losses.length > 0 ? losses.reduce((sum, t) => sum + (Number(t.pnlPercent) || 0), 0) / losses.length : 0;

    const symbolCounts: Record<string, number> = {};
    all.forEach((t) => {
      symbolCounts[t.symbol] = (symbolCounts[t.symbol] || 0) + 1;
    });

    const topSymbols = Object.entries(symbolCounts)
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalTrades: all.length,
      wins: wins.length,
      losses: losses.length,
      breakEvens: breakEvens.length,
      openTrades: open.length,
      winRate,
      totalPnl,
      totalPnlPercent,
      bestTrade,
      worstTrade,
      avgWinPercent,
      avgLossPercent,
      topSymbols,
      recentTrades: all.slice(0, 10),
    };
  }
}
