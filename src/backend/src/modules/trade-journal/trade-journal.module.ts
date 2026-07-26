import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TradeJournalController } from './trade-journal.controller';
import { TradeJournalService } from './trade-journal.service';
import { TradeJournal, TradeJournalSchema } from '../../database/schemas/trade-journal.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TradeJournal.name, schema: TradeJournalSchema },
    ]),
  ],
  controllers: [TradeJournalController],
  providers: [TradeJournalService],
  exports: [TradeJournalService],
})
export class TradeJournalModule {}
