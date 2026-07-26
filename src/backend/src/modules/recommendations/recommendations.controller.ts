import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Post('analyze')
  analyze(@Body() body: { symbol: string; timeframe?: string; analysisTypes?: string[] }) {
    return this.recommendationsService.analyze(body.symbol, body.timeframe, body.analysisTypes);
  }

  @Get('history/:symbol')
  getHistory(@Param('symbol') symbol: string, @Query('limit') limit: number = 100) {
    return this.recommendationsService.getHistory(symbol, limit);
  }

  @Get('latest/:symbol')
  getLatest(@Param('symbol') symbol: string) {
    return this.recommendationsService.getLatest(symbol);
  }
}
