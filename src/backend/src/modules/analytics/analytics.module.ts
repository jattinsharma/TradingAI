import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent, AnalyticsEventSchema } from '../../database/schemas/analytics-event.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: AnalyticsEvent.name, schema: AnalyticsEventSchema }])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
