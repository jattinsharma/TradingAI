/**
 * TradingAI V2 — Multi-Agent Module
 *
 * NestJS module that registers the complete multi-agent AI pipeline:
 *   - 6 specialist analyst agents
 *   - Bull/Bear researchers
 *   - Portfolio Manager
 *   - Debate Orchestrator
 *   - LLM Provider (multi-provider with fallback)
 *   - Pipeline Orchestrator
 *
 * @module multi-agent
 */
import { Module } from '@nestjs/common';
import { MemoryModule } from '../memory/memory.module';
import { LlmProviderService } from './llm/llm-provider.service';
import { TechnicalAnalystAgent } from './agents/technical-analyst.agent';
import { FundamentalAnalystAgent } from './agents/fundamental-analyst.agent';
import { NewsAnalystAgent } from './agents/news-analyst.agent';
import { SentimentAnalystAgent } from './agents/sentiment-analyst.agent';
import { MacroAnalystAgent } from './agents/macro-analyst.agent';
import { RiskManagerAgent } from './agents/risk-manager.agent';
import { BullResearcherAgent } from './agents/bull-researcher.agent';
import { BearResearcherAgent } from './agents/bear-researcher.agent';
import { PortfolioManagerAgent } from './agents/portfolio-manager.agent';
import { DebateOrchestratorService } from './debate/debate-orchestrator.service';
import { PipelineOrchestratorService } from './pipeline/pipeline-orchestrator.service';
import { MultiAgentController } from './multi-agent.controller';

@Module({
  imports: [MemoryModule],
  controllers: [MultiAgentController],
  providers: [
    // LLM abstraction layer
    LlmProviderService,

    // Specialist analysts
    TechnicalAnalystAgent,
    FundamentalAnalystAgent,
    NewsAnalystAgent,
    SentimentAnalystAgent,
    MacroAnalystAgent,
    RiskManagerAgent,

    // Debate participants
    BullResearcherAgent,
    BearResearcherAgent,

    // Final decision maker
    PortfolioManagerAgent,

    // Orchestration
    DebateOrchestratorService,
    PipelineOrchestratorService,
  ],
  exports: [
    PipelineOrchestratorService,
    LlmProviderService,
  ],
})
export class MultiAgentModule {}
