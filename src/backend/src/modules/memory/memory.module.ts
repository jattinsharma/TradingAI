/**
 * TradingAI V2 — Memory Module
 *
 * NestJS module for the persistent AI memory system.
 * Registers all memory schemas and the MemoryService.
 *
 * @module memory
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import {
  TradeMemory,
  TradeMemorySchema,
  PatternMemory,
  PatternMemorySchema,
  MistakeMemory,
  MistakeMemorySchema,
  PreferenceMemory,
  PreferenceMemorySchema,
  SessionMemory,
  SessionMemorySchema,
} from './schemas/memory.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TradeMemory.name, schema: TradeMemorySchema },
      { name: PatternMemory.name, schema: PatternMemorySchema },
      { name: MistakeMemory.name, schema: MistakeMemorySchema },
      { name: PreferenceMemory.name, schema: PreferenceMemorySchema },
      { name: SessionMemory.name, schema: SessionMemorySchema },
    ]),
  ],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
