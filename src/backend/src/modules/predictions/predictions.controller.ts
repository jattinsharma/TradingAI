import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PredictionsService } from './predictions.service';
import { PredictionEvaluatorService } from './prediction-evaluator.service';

@ApiTags('Predictions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('predictions')
export class PredictionsController {
  constructor(
    private readonly predictionsService: PredictionsService,
    private readonly evaluator: PredictionEvaluatorService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Save a new trade prediction from AI analysis' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        platform: { type: 'string' },
        symbol: { type: 'string' },
        timeframe: { type: 'string' },
        recommendation: { type: 'string' },
        confidence: { type: 'number' },
        currentPrice: { type: 'number' },
        entryPrice: { type: 'number' },
        stopLoss: { type: 'number' },
        takeProfit1: { type: 'number' },
        takeProfit2: { type: 'number' },
        riskRewardRatio: { type: 'number' },
        indicatorSnapshot: { type: 'object' },
      },
    },
  })
  async create(@Body() data: Record<string, unknown>) {
    return this.predictionsService.create(data as any);
  }

  @Get()
  @ApiOperation({ summary: 'List predictions with filters' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'symbol', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'result', required: false })
  @ApiQuery({ name: 'recommendation', required: false })
  @ApiQuery({ name: 'timeframe', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'sort', required: false })
  async findAll(
    @Query('userId') userId: string,
    @Query('symbol') symbol?: string,
    @Query('status') status?: string,
    @Query('result') result?: string,
    @Query('recommendation') recommendation?: string,
    @Query('timeframe') timeframe?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sort') sort?: string,
  ) {
    return this.predictionsService.findAll({
      userId, symbol, status, result, recommendation, timeframe,
      startDate, endDate, limit, offset, sort,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get overall prediction statistics' })
  @ApiQuery({ name: 'userId', required: true })
  async getStats(@Query('userId') userId: string) {
    return this.predictionsService.getStats(userId);
  }

  @Get('confidence-calibration')
  @ApiOperation({ summary: 'Get confidence calibration data (win rate per confidence bucket)' })
  @ApiQuery({ name: 'userId', required: true })
  async getConfidenceCalibration(@Query('userId') userId: string) {
    return this.predictionsService.getConfidenceCalibration(userId);
  }

  @Get('performance/symbols')
  @ApiOperation({ summary: 'Get performance grouped by symbol' })
  @ApiQuery({ name: 'userId', required: true })
  async getSymbolPerformance(@Query('userId') userId: string) {
    return this.predictionsService.getSymbolPerformance(userId);
  }

  @Get('performance/timeframes')
  @ApiOperation({ summary: 'Get performance grouped by timeframe' })
  @ApiQuery({ name: 'userId', required: true })
  async getTimeframePerformance(@Query('userId') userId: string) {
    return this.predictionsService.getTimeframePerformance(userId);
  }

  @Get('performance/trend')
  @ApiOperation({ summary: 'Get performance trend over time' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'groupBy', required: false })
  async getPerformanceTrend(
    @Query('userId') userId: string,
    @Query('groupBy') groupBy?: string,
  ) {
    return this.predictionsService.getPerformanceTrend(userId, groupBy as 'week' | 'month');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single prediction by ID' })
  async findOne(@Param('id') id: string) {
    return this.predictionsService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a prediction' })
  async remove(@Param('id') id: string) {
    return this.predictionsService.remove(id);
  }

  @Post(':id/evaluate')
  @ApiOperation({ summary: 'Manually trigger evaluation of a prediction against live market data' })
  async evaluatePrediction(@Param('id') id: string) {
    const prediction = await this.predictionsService.findOne(id);
    return this.evaluator.evaluatePrediction(prediction);
  }
}
