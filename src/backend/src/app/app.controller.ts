import { Controller, Get, Optional } from '@nestjs/common';
import { AppService } from './app.service';
import { AiService } from '../modules/ai/ai.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Optional() private readonly aiService?: AiService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    let aiAvailable = false;
    if (this.aiService) {
      try {
        aiAvailable = this.aiService.isAvailable();
      } catch {
        aiAvailable = false;
      }
    }

    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      services: {
        ai: aiAvailable ? 'available' : 'unavailable',
        database: process.env.MONGODB_URI ? 'configured' : 'not-configured',
      },
    };
  }
}
