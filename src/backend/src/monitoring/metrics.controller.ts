import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CacheService } from '../cache/cache.service';
import { SocketGateway } from '../websocket/socket.gateway';
import { AiService } from '../modules/ai/ai.service';

@ApiTags('Monitoring')
@Controller()
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly cacheService: CacheService,
    private readonly socketGateway: SocketGateway,
    private readonly aiService: AiService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Simple health check (liveness)' })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Readiness probe — checks all dependent services' })
  async getReadiness() {
    const checks: Record<string, string> = {};

    // Check Redis
    const redisOk = await this.cacheService.ping();
    checks.redis = redisOk ? 'ok' : 'degraded';

    // Check AI
    checks.ai = this.aiService.isAvailable() ? 'ok' : 'degraded';

    // Check database connectivity (via env)
    checks.database = process.env.MONGODB_URI ? 'configured' : 'not-configured';

    const allOk = Object.values(checks).every((s) => s === 'ok' || s === 'configured');
    const status = allOk ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
    };
  }

  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe — always returns ok if process is alive' })
  getLiveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus-format metrics' })
  async getMetrics(): Promise<string> {
    const lines: string[] = [];

    // App info
    lines.push('# HELP app_info Application information');
    lines.push('# TYPE app_info gauge');
    lines.push(`app_info{name="universal-ai-trading-copilot",version="1.0.0"} 1`);

    // Uptime
    lines.push('# HELP app_uptime_seconds Application uptime in seconds');
    lines.push('# TYPE app_uptime_seconds gauge');
    lines.push(`app_uptime_seconds ${Math.floor((Date.now() - this.startTime) / 1000)}`);

    // Redis
    const redisOk = await this.cacheService.ping();
    lines.push('# HELP redis_up Redis connection status (1 = up, 0 = down)');
    lines.push('# TYPE redis_up gauge');
    lines.push(`redis_up ${redisOk ? 1 : 0}`);

    // AI
    lines.push('# HELP ai_available AI service availability (1 = available, 0 = unavailable)');
    lines.push('# TYPE ai_available gauge');
    lines.push(`ai_available ${this.aiService.isAvailable() ? 1 : 0}`);

    // WebSocket connections
    lines.push('# HELP websocket_connections Current WebSocket connections');
    lines.push('# TYPE websocket_connections gauge');
    lines.push(`websocket_connections ${this.socketGateway.getConnectedClients()}`);

    // Active users
    lines.push('# HELP websocket_users Currently connected users');
    lines.push('# TYPE websocket_users gauge');
    lines.push(`websocket_users ${this.socketGateway.getConnectedUsers().length}`);

    // Memory usage
    const memUsage = process.memoryUsage();
    lines.push('# HELP process_memory_bytes Process memory usage in bytes');
    lines.push('# TYPE process_memory_bytes gauge');
    lines.push(`process_memory_bytes{type="rss"} ${memUsage.rss}`);
    lines.push(`process_memory_bytes{type="heapTotal"} ${memUsage.heapTotal}`);
    lines.push(`process_memory_bytes{type="heapUsed"} ${memUsage.heapUsed}`);

    // Node event loop lag approximation
    lines.push('# HELP process_start_time_seconds Start time of the process');
    lines.push('# TYPE process_start_time_seconds gauge');
    lines.push(`process_start_time_seconds ${Math.floor(this.startTime / 1000)}`);

    return lines.join('\n');
  }
}
