import { Controller, Get, Post, Body, Param, Delete, Query } from '@nestjs/common';
import { WatchlistsService } from './watchlists.service';

@Controller('watchlists')
export class WatchlistsController {
  constructor(private readonly watchlistsService: WatchlistsService) {}

  @Get()
  findAll(@Query('userId') userId?: string) {
    return this.watchlistsService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.watchlistsService.findOne(id);
  }

  @Post()
  create(
    @Body()
    createWatchlistDto: {
      userId: string;
      name: string;
      symbols?: string[];
      description?: string;
      isPublic?: boolean;
    },
  ) {
    return this.watchlistsService.create(createWatchlistDto);
  }

  @Post(':id/symbols')
  addSymbol(@Param('id') id: string, @Body() body: { symbol: string }) {
    return this.watchlistsService.addSymbol(id, body.symbol);
  }

  @Delete(':id/symbols/:symbol')
  removeSymbol(@Param('id') id: string, @Param('symbol') symbol: string) {
    return this.watchlistsService.removeSymbol(id, symbol);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.watchlistsService.remove(id);
  }
}
