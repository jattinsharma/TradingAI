import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Watchlist, WatchlistDocument } from '../../database/schemas/watchlist.schema';

@Injectable()
export class WatchlistsService {
  constructor(
    @InjectModel(Watchlist.name)
    private readonly model: Model<WatchlistDocument>,
  ) {}

  async findAll(userId?: string): Promise<Watchlist[]> {
    if (userId) {
      return this.model.find({ userId }).sort({ createdAt: -1 }).exec();
    }
    return this.model.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<WatchlistDocument> {
    const watchlist = await this.model.findById(id).exec();
    if (!watchlist) {
      throw new NotFoundException(`Watchlist with ID ${id} not found`);
    }
    return watchlist;
  }

  async create(createWatchlistDto: {
    userId: string;
    name: string;
    symbols?: string[];
    description?: string;
    isPublic?: boolean;
  }): Promise<Watchlist> {
    const created = new this.model({
      userId: createWatchlistDto.userId,
      name: createWatchlistDto.name,
      symbols: createWatchlistDto.symbols || [],
      description: createWatchlistDto.description,
      isPublic: createWatchlistDto.isPublic ?? false,
    });

    return created.save();
  }

  async addSymbol(watchlistId: string, symbol: string): Promise<WatchlistDocument> {
    const watchlist = await this.findOne(watchlistId);
    const upperSymbol = symbol.toUpperCase();
    if (!watchlist.symbols.includes(upperSymbol)) {
      watchlist.symbols = [...watchlist.symbols, upperSymbol];
      return watchlist.save();
    }
    return watchlist;
  }

  async removeSymbol(watchlistId: string, symbol: string): Promise<WatchlistDocument> {
    const watchlist = await this.findOne(watchlistId);
    watchlist.symbols = watchlist.symbols.filter((s) => s !== symbol.toUpperCase());
    return watchlist.save();
  }

  async remove(id: string): Promise<WatchlistDocument> {
    const watchlist = await this.findOne(id);
    await this.model.findByIdAndDelete(id).exec();
    return watchlist;
  }
}
