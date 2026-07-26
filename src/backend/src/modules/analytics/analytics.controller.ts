import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('user/:userId')
  getUserAnalytics(@Param('userId') userId: string, @Query('days') days: number = 30) {
    return this.analyticsService.getUserAnalytics(userId, days);
  }

  @Get('platform/overview')
  getPlatformOverview(@Query('days') days: number = 30) {
    return this.analyticsService.getPlatformOverview(days);
  }

  @Get('performance/:symbol')
  getSymbolPerformance(@Param('symbol') symbol: string, @Query('days') days: number = 30) {
    return this.analyticsService.getSymbolPerformance(symbol, days);
  }

  @Get('recommendations/accuracy')
  getRecommendationAccuracy(@Query('days') days: number = 30) {
    return this.analyticsService.getRecommendationAccuracy(days);
  }
}
