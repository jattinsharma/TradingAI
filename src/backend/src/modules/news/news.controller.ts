import { Controller, Get, Param, Query } from '@nestjs/common';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  async getNews(@Query('category') category?: string, @Query('limit') limit: number = 10) {
    return this.newsService.getNews(category, limit);
  }

  @Get('headlines')
  async getHeadlines(@Query('limit') limit: number = 10) {
    return this.newsService.getLatestHeadlines(limit);
  }

  @Get('symbol/:symbol')
  async getNewsForSymbol(@Param('symbol') symbol: string, @Query('limit') limit: number = 10) {
    return this.newsService.getNewsForSymbol(symbol, limit);
  }
}
