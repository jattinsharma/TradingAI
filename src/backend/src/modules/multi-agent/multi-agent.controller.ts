/**
 * TradingAI V2 — Multi-Agent Controller
 *
 * REST API endpoints for the AI Engine V2 pipeline.
 *
 * @module multi-agent
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { randomUUID } from 'crypto';
import { PipelineOrchestratorService } from './pipeline/pipeline-orchestrator.service';
import { LlmProviderService } from './llm/llm-provider.service';
import {
  AnalysisContext,
  AnalysisDepth,
  ChartData,
  MarketData,
  MemoryContext,
  UserProfile,
  TradeRecommendation,
} from './types/agent.types';

/** DTO for the analysis request */
interface AnalyzeRequestDto {
  symbol: string;
  timeframe: string;
  depth?: 'QUICK' | 'STANDARD' | 'DEEP';
  chartData: {
    currentPrice: number;
    exchange?: string;
    indicators: Record<string, unknown>;
    candles?: Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    drawings?: Array<{
      type: string;
      points: Array<{ price: number; time: string }>;
      label?: string;
    }>;
  };
  marketData?: Partial<MarketData>;
  memory?: Partial<MemoryContext>;
  userProfile?: Partial<UserProfile>;
}

@ApiTags('AI Engine V2')
@Controller('v2/analyze')
export class MultiAgentController {
  private readonly logger = new Logger(MultiAgentController.name);

  constructor(
    private readonly pipeline: PipelineOrchestratorService,
    private readonly llmProvider: LlmProviderService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Check AI Engine V2 status and provider health' })
  getStatus() {
    return {
      version: '2.0.0',
      providers: this.llmProvider.getHealthStatus(),
      primaryProvider: this.llmProvider.getPrimaryProvider(),
      configuredProviders: this.llmProvider.getConfiguredProviders(),
      tokenUsage: this.llmProvider.getTokenUsage(),
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Run the AI Engine V2 multi-agent analysis pipeline',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['symbol', 'timeframe', 'chartData'],
      properties: {
        symbol: { type: 'string', example: 'BTCUSDT' },
        timeframe: { type: 'string', example: '4H' },
        depth: {
          type: 'string',
          enum: ['QUICK', 'STANDARD', 'DEEP'],
          default: 'STANDARD',
        },
        chartData: {
          type: 'object',
          properties: {
            currentPrice: { type: 'number' },
            indicators: { type: 'object' },
          },
        },
        marketData: { type: 'object' },
        memory: { type: 'object' },
        userProfile: { type: 'object' },
      },
    },
  })
  async analyze(
    @Body() request: AnalyzeRequestDto,
    @Request() req?: any,
  ): Promise<TradeRecommendation> {
    // Validate required fields
    if (!request.symbol || !request.timeframe || !request.chartData) {
      throw new HttpException(
        'Missing required fields: symbol, timeframe, chartData',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!request.chartData.currentPrice || request.chartData.currentPrice <= 0) {
      throw new HttpException(
        'chartData.currentPrice must be a positive number',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Build the AnalysisContext
    const depth =
      AnalysisDepth[request.depth as keyof typeof AnalysisDepth] ||
      AnalysisDepth.STANDARD;

    const chartData: ChartData = {
      symbol: request.symbol.toUpperCase(),
      timeframe: request.timeframe,
      exchange: request.chartData.exchange,
      currentPrice: request.chartData.currentPrice,
      indicators: request.chartData.indicators || {},
      candles: request.chartData.candles?.map((c) => ({
        ...c,
        timestamp: new Date(c.timestamp),
      })),
      drawings: request.chartData.drawings?.map((d) => ({
        ...d,
        points: d.points.map((p) => ({
          ...p,
          time: new Date(p.time),
        })),
      })),
    };

    const userId = req?.user?.id || req?.user?.sub || undefined;

    const context: AnalysisContext = {
      symbol: request.symbol.toUpperCase(),
      timeframe: request.timeframe,
      depth,
      chartData,
      marketData: request.marketData as MarketData | undefined,
      memory: request.memory as MemoryContext | undefined,
      userProfile: request.userProfile as UserProfile | undefined,
      userId,
      requestId: randomUUID(),
      requestedAt: new Date(),
    };

    this.logger.log(
      `Analysis request: ${context.symbol} ${context.timeframe} [${context.depth}] by user: ${userId || 'anonymous'}`,
    );

    try {
      return await this.pipeline.analyze(context);
    } catch (error) {
      this.logger.error(
        `Pipeline failed: ${(error as Error).message}`,
      );
      throw new HttpException(
        `AI analysis failed: ${(error as Error).message}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post('quick')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Quick analysis — 3 agents, no debate, fastest response',
  })
  async analyzeQuick(
    @Body() request: AnalyzeRequestDto,
    @Request() req?: any,
  ): Promise<TradeRecommendation> {
    return this.analyze({ ...request, depth: 'QUICK' }, req);
  }

  @Post('deep')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Deep analysis — all agents, multi-round debate, most thorough',
  })
  async analyzeDeep(
    @Body() request: AnalyzeRequestDto,
    @Request() req?: any,
  ): Promise<TradeRecommendation> {
    return this.analyze({ ...request, depth: 'DEEP' }, req);
  }
}
