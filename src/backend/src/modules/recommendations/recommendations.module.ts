import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { MarketDataModule } from '../market-data/market-data.module';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [MarketDataModule, NewsModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
