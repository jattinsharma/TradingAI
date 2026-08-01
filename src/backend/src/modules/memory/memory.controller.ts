/**
 * TradingAI V2 — Memory Controller
 *
 * REST API endpoints for the Memory Engine.
 *
 * @module memory
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MemoryService } from './memory.service';
import { TradeMemory, SessionMemory } from './schemas/memory.schema';

@ApiTags('Memory Engine')
@Controller('v2/memory')
export class MemoryController {
  private readonly logger = new Logger(MemoryController.name);

  constructor(private readonly memoryService: MemoryService) {}

  @Get('context/:userId/:symbol')
  @ApiOperation({
    summary: 'Get the full MemoryContext for a user and symbol',
  })
  async getMemoryContext(
    @Param('userId') userId: string,
    @Param('symbol') symbol: string,
  ) {
    return this.memoryService.buildMemoryContext(userId, symbol);
  }

  @Get('stats/:userId')
  @ApiOperation({ summary: 'Get memory statistics for a user' })
  async getStats(@Param('userId') userId: string) {
    return this.memoryService.getStats(userId);
  }

  @Get('trades/:userId')
  @ApiOperation({ summary: 'Get trade memories for a user' })
  async getTradeMemories(
    @Param('userId') userId: string,
    @Query('symbol') symbol?: string,
    @Query('result') result?: string,
    @Query('limit') limit?: number,
  ) {
    return this.memoryService.getTradeMemories(userId, {
      symbol,
      result,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('trades')
  @ApiOperation({ summary: 'Record a trade in memory' })
  async recordTrade(@Body() data: Partial<TradeMemory>) {
    return this.memoryService.recordTrade(data);
  }

  @Get('sessions/:userId')
  @ApiOperation({ summary: 'Get recent trading sessions for a user' })
  async getSessions(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.memoryService.getRecentSessions(
      userId,
      limit ? Number(limit) : 10,
    );
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Record a trading session' })
  async recordSession(@Body() data: Partial<SessionMemory>) {
    return this.memoryService.recordSession(data);
  }

  @Post('preferences/:userId/recompute')
  @ApiOperation({
    summary: 'Recompute user preferences from trade history',
  })
  async recomputePreferences(@Param('userId') userId: string) {
    await this.memoryService.recomputePreferences(userId);
    return { success: true };
  }

  @Get('preferences/:userId')
  @ApiOperation({ summary: 'Get learned preferences for a user' })
  async getPreferences(@Param('userId') userId: string) {
    return this.memoryService.getPreferences(userId);
  }
}
