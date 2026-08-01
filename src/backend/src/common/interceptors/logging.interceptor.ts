import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    if (!request) {
      return next.handle();
    }

    const startTime = Date.now();
    const requestId =
      request.headers['x-request-id'] || request.headers['x-correlation-id'] || randomUUID();
    
    // Attach header to outgoing response for client-side tracing
    if (response && typeof response.setHeader === 'function') {
      response.setHeader('x-request-id', requestId);
    }
    request.requestId = requestId;

    const user = request.user;
    const userId = user?.id || user?.sub || 'anonymous';
    const method = request.method;
    const url = request.originalUrl || request.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          const statusCode = response?.statusCode || 200;
          this.logger.log(
            `[${requestId}] ${method} ${url} ${statusCode} - ${durationMs}ms (user: ${userId})`,
          );
        },
        error: (error) => {
          const durationMs = Date.now() - startTime;
          const statusCode = error.status || error.statusCode || 500;
          this.logger.error(
            `[${requestId}] ${method} ${url} ${statusCode} - ${durationMs}ms (user: ${userId}) — ${error.message}`,
          );
        },
      }),
    );
  }
}
