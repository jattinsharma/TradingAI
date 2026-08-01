/**
 * TradingAI V2 — Decision Module
 *
 * NestJS module for the Decision Engine.
 *
 * @module decision
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DecisionService } from './decision.service';
import { Analysis, AnalysisSchema } from '../../database/schemas/analysis.schema';
import { MultiAgentModule } from '../multi-agent/multi-agent.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Analysis.name, schema: AnalysisSchema },
    ]),
    MultiAgentModule,
    MemoryModule,
  ],
  providers: [DecisionService],
  exports: [DecisionService],
})
export class DecisionModule {}
