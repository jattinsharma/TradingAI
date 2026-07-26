import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { Analysis, AnalysisSchema } from '../../database/schemas/analysis.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Analysis.name, schema: AnalysisSchema }])],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
