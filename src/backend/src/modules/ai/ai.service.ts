import { Injectable, Logger } from '@nestjs/common';
import { AIProviderRouter } from '../providers/ai/provider.router';
import { AiAnalysisRequest } from './ai.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly providerRouter: AIProviderRouter) {}

  async isAvailable(): Promise<boolean> {
    return this.providerRouter.isAvailable();
  }

  getActiveModel() {
    return this.providerRouter.getActiveModel();
  }

  getAvailableModels() {
    return this.providerRouter.getAvailableModels();
  }

  async setModel(modelName: string): Promise<boolean> {
    return this.providerRouter.setModel(modelName);
  }

  async analyze(request: AiAnalysisRequest) {
    return this.providerRouter.analyze(request);
  }

  // Additional methods to match the AIProvider interface for completeness
  async summarizeNews(request: any) {
    return this.providerRouter.summarizeNews(request);
  }

  async coachTrade(request: any) {
    return this.providerRouter.coachTrade(request);
  }
}