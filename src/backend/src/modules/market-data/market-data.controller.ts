import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketDataService } from './market-data.service';

@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('quote/:symbol')
  async getQuote(@Param('symbol') symbol: string) {
    return this.marketDataService.getQuote(symbol);
  }

  @Get('price/:symbol')
  getCurrentPrice(@Param('symbol') symbol: string) {
    return this.marketDataService.getCurrentPrice(symbol);
  }

  @Get('candles/:symbol')
  async getCandles(
    @Param('symbol') symbol: string,
    @Query('interval') interval: string = '1d',
    @Query('limit') limit: number = 100,
  ) {
    return this.marketDataService.getCandles(symbol, interval, limit);
  }
}
