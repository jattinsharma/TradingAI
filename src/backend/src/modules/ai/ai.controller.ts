import { Controller, Post, Body, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AiService, AiAnalysisRequest } from './ai.service';

@ApiTags('AI Analysis')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check Ollama AI service availability' })
  getStatus() {
    return {
      available: this.aiService.isAvailable(),
      activeModel: this.aiService.getActiveModel(),
    };
  }

  @Get('models')
  @ApiOperation({ summary: 'Get available AI models' })
  getModels() {
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
  @ApiOperation({ summary: 'Analyze market data using local AI (Ollama)' })
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
    if (!this.aiService.isAvailable()) {
      throw new HttpException(
        'Ollama is not running. Start it with: ollama serve. Install from https://ollama.com',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.aiService.analyze(request);
  }
}
