import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { PredictionEvaluatorService } from './prediction-evaluator.service';
import { Prediction, PredictionSchema } from '../../database/schemas/prediction.schema';
import { IndicatorStats, IndicatorStatsSchema } from '../../database/schemas/indicator-stats.schema';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Prediction.name, schema: PredictionSchema },
      { name: IndicatorStats.name, schema: IndicatorStatsSchema },
    ]),
    MarketDataModule,
  ],
  controllers: [PredictionsController],
  providers: [PredictionsService, PredictionEvaluatorService],
  exports: [PredictionsService, PredictionEvaluatorService],
})
export class PredictionsModule {}
