import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PerformanceService } from './performance.service';
import { IndicatorAnalyticsService } from './indicator-analytics.service';

@ApiTags('Performance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('performance')
export class PerformanceController {
  constructor(
    private readonly performanceService: PerformanceService,
    private readonly indicatorAnalytics: IndicatorAnalyticsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get overall performance metrics (win rate, streaks, averages)' })
  @ApiQuery({ name: 'userId', required: true })
  async getOverall(@Query('userId') userId: string) {
    return this.performanceService.getOverall(userId);
  }

  @Get('assets')
  @ApiOperation({ summary: 'Get performance statistics grouped by symbol/asset' })
  @ApiQuery({ name: 'userId', required: true })
  async getAssetPerformance(@Query('userId') userId: string) {
    return this.performanceService.getAssetPerformance(userId);
  }

  @Get('assets/best-worst')
  @ApiOperation({ summary: 'Get the best and worst performing assets' })
  @ApiQuery({ name: 'userId', required: true })
  async getBestAndWorstAssets(@Query('userId') userId: string) {
    return this.performanceService.getBestAndWorstAssets(userId);
  }

  @Get('indicators')
  @ApiOperation({ summary: 'Get per-indicator performance statistics' })
  @ApiQuery({ name: 'userId', required: true })
  async getAllIndicatorStats(@Query('userId') userId: string) {
    return this.indicatorAnalytics.getAllIndicatorStats(userId);
  }

  @Get('indicators/top')
  @ApiOperation({ summary: 'Get top-performing indicators by win rate' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async getTopIndicators(
    @Query('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.indicatorAnalytics.getTopIndicators(userId, limit);
  }

  @Get('indicators/worst')
  @ApiOperation({ summary: 'Get worst-performing indicators by win rate' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async getWorstIndicators(
    @Query('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.indicatorAnalytics.getWorstIndicators(userId, limit);
  }

  @Get('indicators/combinations')
  @ApiOperation({ summary: 'Get best indicator combinations (highest win rate sets)' })
  @ApiQuery({ name: 'userId', required: true })
  async getBestCombinations(@Query('userId') userId: string) {
    return this.indicatorAnalytics.getBestCombinations(userId);
  }

  @Get('confidence-calibration')
  @ApiOperation({ summary: 'Get confidence calibration — win rate per confidence bucket' })
  @ApiQuery({ name: 'userId', required: true })
  async getConfidenceCalibration(@Query('userId') userId: string) {
    return this.indicatorAnalytics.getConfidenceCalibration(userId);
  }
}
