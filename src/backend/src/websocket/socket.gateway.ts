import {
  WebSocketGateway as NestWsGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@NestWsGateway({
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : true,
    credentials: true,
  },
  namespace: '/ws',
})
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SocketGateway.name);
  private connectedClients = 0;

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: AuthenticatedSocket) {
    this.connectedClients++;
    const userId = client.handshake.query.userId as string | undefined;
    if (userId) {
      client.userId = userId;
      client.join(`user:${userId}`);
      this.logger.log(`Client connected: ${client.id} (user: ${userId})`);
    } else {
      this.logger.log(`Client connected: ${client.id} (anonymous)`);
    }

    // Send welcome message
    client.emit('connected', {
      clientId: client.id,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients--;
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // --- Emit Methods ---

  emitPriceUpdate(symbol: string, price: number, change24h: number) {
    this.server?.emit('price:update', { symbol, price, change24h, timestamp: Date.now() });
  }

  emitAlert(userId: string, alert: unknown) {
    this.server?.to(`user:${userId}`).emit('alert:triggered', alert);
  }

  emitAnalysisComplete(userId: string, analysis: unknown) {
    this.server?.to(`user:${userId}`).emit('analysis:complete', analysis);
  }

  emitWatchlistUpdate(userId: string, watchlist: unknown) {
    this.server?.to(`user:${userId}`).emit('watchlist:update', watchlist);
  }

  emitBackendStatus(status: Record<string, unknown>) {
    this.server?.emit('status:update', status);
  }

  emitQueueMetrics(metrics: Record<string, number>) {
    this.server?.emit('queue:metrics', metrics);
  }

  getConnectedClients(): number {
    return this.connectedClients;
  }

  getConnectedUsers(): string[] {
    if (!this.server?.sockets?.adapter?.rooms) return [];
    try {
      const rooms = this.server.sockets.adapter.rooms;
      const userIds: string[] = [];
      for (const [room] of rooms) {
        if (room.startsWith('user:')) {
          userIds.push(room.replace('user:', ''));
        }
      }
      return userIds;
    } catch {
      return [];
    }
  }
}
