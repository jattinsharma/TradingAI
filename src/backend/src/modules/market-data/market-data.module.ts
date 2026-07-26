import { Module } from '@nestjs/common';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';
import { BinanceProvider } from './providers/binance.provider';

@Module({
  controllers: [MarketDataController],
  providers: [MarketDataService, YahooFinanceProvider, BinanceProvider],
  exports: [MarketDataService, YahooFinanceProvider, BinanceProvider],
})
export class MarketDataModule {}
