/**
 * TradingAI V2 — Coach Controller
 *
 * REST API endpoints for the AI Coach.
 *
 * @module coach
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CoachService } from './coach.service';
import { TradeMemory } from '../memory/schemas/memory.schema';

@ApiTags('AI Coach')
@Controller('v2/coach')
export class CoachController {
  private readonly logger = new Logger(CoachController.name);

  constructor(private readonly coachService: CoachService) {}

  @Post('review/:userId')
  @ApiOperation({
    summary:
      'Review a completed trade and generate coaching feedback',
  })
  async reviewTrade(
    @Param('userId') userId: string,
    @Body() tradeData: Partial<TradeMemory>,
  ) {
    return this.coachService.reviewTrade(userId, tradeData);
  }

  @Get('insights/:userId')
  @ApiOperation({
    summary:
      'Get proactive coaching insights (not tied to a specific trade)',
  })
  async getInsights(@Param('userId') userId: string) {
    return this.coachService.getInsights(userId);
  }
}
