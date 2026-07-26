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

  // Security: CORS with support for both browser frontend AND Chrome extension service worker
  // Chrome extension service workers use chrome-extension://<id> as origin.
  // In production, set CORS_ORIGIN to a comma-separated list of allowed origins.
  // For development, we allow all origins so the extension can connect freely.
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : process.env.NODE_ENV === 'production'
      ? ['http://localhost:3000']
      : true; // Allow all origins in development (needed for chrome-extension:// origins)
  app.enableCors({
    origin: corsOrigins,
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
