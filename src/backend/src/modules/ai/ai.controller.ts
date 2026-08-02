import { Controller, Post, Body, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AiService, AiAnalysisRequest } from './ai.service';

@ApiTags('AI Analysis')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check AI service availability' })
  async getStatus() {
    const available = await this.aiService.isAvailable();
    const activeModel = this.aiService.getActiveModel();
    return {
      available,
      activeModel,
    };
  }

  @Get('models')
  @ApiOperation({ summary: 'Get available AI models' })
  async getModels() {
    return {
      active: this.aiService.getActiveModel(),
      available: this.aiService.getAvailableModels(),
    };
  }

  @Post('models/:model')
  @ApiOperation({ summary: 'Switch to a different AI model' })
  async setModel(@Param('model') model: string) {
    const success = await this.aiService.setModel(model);
    if (!success) {
      throw new HttpException(`Unknown model: ${model}`, HttpStatus.BAD_REQUEST);
    }
    return { success: true, activeModel: this.aiService.getActiveModel() };
  }

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze market data using AI' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        timeframe: { type: 'string' },
        currentPrice: { type: 'number' },
        indicators: { type: 'object' },
        news: { type: 'array', items: { type: 'object' } },
        marketContext: { type: 'object' },
      },
    },
  })
  async analyze(@Body() request: AiAnalysisRequest) {
    const available = await this.aiService.isAvailable();
    if (!available) {
      throw new HttpException(
        'No AI providers are available. Please check your API keys and connections.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.aiService.analyze(request);
  }
}