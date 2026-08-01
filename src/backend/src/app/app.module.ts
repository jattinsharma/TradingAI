import * as dns from 'dns';

// Force Node.js to use public DNS servers instead of the system DNS
// Fixes 'querySrv ECONNREFUSED' error with MongoDB Atlas on some networks
// where the Windows DNS resolver refuses SRV record queries from Node.js
dns.setServers(['8.8.8.8', '1.1.1.1']);

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
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
import { PredictionsModule } from '../modules/predictions/predictions.module';
import { PerformanceModule } from '../modules/performance/performance.module';

// ═══ AI Engine V2 Modules ═══
import { MultiAgentModule } from '../modules/multi-agent/multi-agent.module';
import { MemoryModule } from '../modules/memory/memory.module';
import { DecisionModule } from '../modules/decision/decision.module';
import { CoachModule } from '../modules/coach/coach.module';

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
    PredictionsModule,
    PerformanceModule,
    CacheModule,
    LoggerModule,
    WebsocketModule,
    MonitoringModule,

    // AI Engine V2 — Multi-agent pipeline, memory, decision, coach
    MultiAgentModule,
    MemoryModule,
    DecisionModule,
    CoachModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
