import { Module } from '@nestjs/common';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { RssNewsService } from './rss-news.service';

@Module({
  controllers: [NewsController],
  providers: [NewsService, RssNewsService],
  exports: [NewsService, RssNewsService],
})
export class NewsModule {}
