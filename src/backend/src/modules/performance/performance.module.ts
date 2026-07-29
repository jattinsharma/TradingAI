import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { IndicatorAnalyticsService } from './indicator-analytics.service';
import { Prediction, PredictionSchema } from '../../database/schemas/prediction.schema';
import { IndicatorStats, IndicatorStatsSchema } from '../../database/schemas/indicator-stats.schema';
import { TradeJournal, TradeJournalSchema } from '../../database/schemas/trade-journal.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Prediction.name, schema: PredictionSchema },
      { name: IndicatorStats.name, schema: IndicatorStatsSchema },
      { name: TradeJournal.name, schema: TradeJournalSchema },
    ]),
  ],
  controllers: [PerformanceController],
  providers: [PerformanceService, IndicatorAnalyticsService],
  exports: [PerformanceService, IndicatorAnalyticsService],
})
export class PerformanceModule {}
