import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CacheModule } from '../cache/cache.module';
import { LoggerModule } from '../logger/logger.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { MarketDataModule } from '../modules/market-data/market-data.module';
import { NewsModule } from '../modules/news/news.module';
import { BrokersModule } from '../modules/brokers/brokers.module';
import { RecommendationsModule } from '../modules/recommendations/recommendations.module';
import { AlertsModule } from '../modules/alerts/alerts.module';
import { WatchlistsModule } from '../modules/watchlists/watchlists.module';
import { SettingsModule } from '../modules/settings/settings.module';
import { AnalyticsModule } from '../modules/analytics/analytics.module';
import { AuditModule } from '../modules/audit/audit.module';
import { AnalysisModule } from '../modules/analysis/analysis.module';
import { TradeJournalModule } from '../modules/trade-journal/trade-journal.module';
import { AiModule } from '../modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // MongoDB connection - no Docker required
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        uri:
          process.env.MONGODB_URI ||
          'mongodb://localhost:27017/trading_copilot',
        connectionFactory: (connection) => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          connection.on('connected', () => {
            console.log('[MongoDB] Connected successfully');
          });
          connection.on('error', (err: Error) => {
            console.error('[MongoDB] Connection error:', err.message);
          });
          connection.on('disconnected', () => {
            console.warn('[MongoDB] Disconnected');
          });
          return connection;
        },
      }),
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    AuthModule,
    UsersModule,
    MarketDataModule,
    NewsModule,
    BrokersModule,
    RecommendationsModule,
    AlertsModule,
    WatchlistsModule,
    SettingsModule,
    AnalyticsModule,
    AuditModule,
    AnalysisModule,
    TradeJournalModule,
    AiModule,
    CacheModule,
    LoggerModule,
    WebsocketModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
