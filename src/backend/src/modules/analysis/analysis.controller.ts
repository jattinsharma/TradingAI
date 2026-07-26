import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalysisService } from './analysis.service';

@ApiTags('Analysis History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post()
  @ApiOperation({ summary: 'Save a new analysis result' })
  @ApiBody({ schema: { type: 'object', properties: { symbol: { type: 'string' }, timeframe: { type: 'string' }, currentPrice: { type: 'number' }, recommendation: { type: 'string' }, confidence: { type: 'number' }, entryPrice: { type: 'number' }, stopLoss: { type: 'number' }, takeProfit: { type: 'number' }, riskRewardRatio: { type: 'number' }, reasoning: { type: 'string' } } } })
  async create(@Body() data: Record<string, unknown>) {
    return this.analysisService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'List analyses with filters' })
  @ApiQuery({ name: 'symbol', required: false })
  @ApiQuery({ name: 'recommendation', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'sort', required: false })
  async findAll(
    @Query('symbol') symbol?: string,
    @Query('recommendation') recommendation?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sort') sort?: string,
  ) {
    return this.analysisService.findAll({ symbol, recommendation, startDate, endDate, limit, offset, sort });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get analysis statistics' })
  @ApiQuery({ name: 'symbol', required: false })
  async getStats(@Query('symbol') symbol?: string) {
    return this.analysisService.getStats(symbol);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one analysis by ID' })
  async findOne(@Param('id') id: string) {
    return this.analysisService.findOne(id);
  }

  @Patch(':id/outcome')
  @ApiOperation({ summary: 'Update trade outcome for an analysis' })
  async updateOutcome(@Param('id') id: string, @Body() body: { outcome: 'WIN' | 'LOSS' | 'PENDING' }) {
    return this.analysisService.updateOutcome(id, body.outcome);
  }
}
