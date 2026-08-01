/**
 * TradingAI V2 — Coach Module
 *
 * NestJS module for the AI Coach system.
 *
 * @module coach
 */
import { Module } from '@nestjs/common';
import { CoachService } from './coach.service';
import { CoachController } from './coach.controller';
import { MemoryModule } from '../memory/memory.module';
import { MultiAgentModule } from '../multi-agent/multi-agent.module';

@Module({
  imports: [MemoryModule, MultiAgentModule],
  controllers: [CoachController],
  providers: [CoachService],
  exports: [CoachService],
})
export class CoachModule {}
