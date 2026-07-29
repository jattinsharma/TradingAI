import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { json } from 'express';
import { AppModule } from './app/app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    rawBody: true,
  });

  // Security: Helmet for security headers
  app.use(helmet());

  // Security: CORS with support for Chrome extension origins.
  // Chrome extensions use chrome-extension://<extension-id> as their origin,
  // which cannot be known at build time. The cors npm package does NOT support
  // wildcard patterns like 'chrome-extension://*' in origin arrays.
  //
  // Strategy:
  // - If CORS_ORIGIN env var is set, parse it (comma-separated).
  //   If any entry is '*' or 'chrome-extension://*', use `true` (allow all).
  // - If CORS_ORIGIN is NOT set, use `true` in both development AND production
  //   because the Chrome extension's origin is dynamic and unpredictable.
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : true;

  // Normalize: if any wildcard pattern ('*' or 'chrome-extension://*') is in
  // the list, use `true` (allow all) because the cors package does exact string
  // matching and does NOT support wildcard patterns in origin arrays.
  const normalizedOrigin = Array.isArray(corsOrigins)
    ? corsOrigins.some(o => o === '*' || o === 'chrome-extension://*')
      ? true
      : corsOrigins
    : corsOrigins;

  app.enableCors({
    origin: normalizedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Performance: Compression for responses
  app.use(compression());

  // Security: Request body size limit
  app.use(json({ limit: '1mb' }));

  // Global exception filter for consistent error responses
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new GlobalExceptionFilter(httpAdapter));

  // Global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API Documentation: Swagger
  const config = new DocumentBuilder()
    .setTitle('Universal AI Trading Copilot API')
    .setDescription('Backend API for the Universal AI Trading Copilot')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`API Documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  Logger.error('Failed to start application:', err);
  process.exit(1);
});
