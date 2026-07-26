import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly model: Model<AuditLogDocument>,
  ) {}

  async getAuditLogs(userId?: string, limit: number = 100): Promise<AuditLog[]> {
    const where = userId ? { userId } : {};
    return this.model.find(where).sort({ timestamp: -1 }).limit(limit).exec();
  }

  async logAction(auditData: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const created = new this.model({
      userId: auditData.userId,
      action: auditData.action,
      resourceType: auditData.resourceType,
      resourceId: auditData.resourceId,
      details: auditData.details || {},
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
    });

    return created.save();
  }

  async getAuditStats(days: number = 30): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    actionsByUser: Record<string, number>;
    dailyActivity: Array<{ date: string; count: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.model.find({
      timestamp: { $gte: startDate, $lte: new Date() },
    }).exec();

    const actionsByType: Record<string, number> = {};
    const actionsByUser: Record<string, number> = {};
    const dailyActivityMap: Map<string, number> = new Map();

    for (const log of logs) {
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
      actionsByUser[log.userId] = (actionsByUser[log.userId] || 0) + 1;

      const dateString = log.timestamp.toISOString().split('T')[0];
      dailyActivityMap.set(dateString, (dailyActivityMap.get(dateString) || 0) + 1);
    }

    const dailyActivity = Array.from(dailyActivityMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      totalActions: logs.length,
      actionsByType,
      actionsByUser,
      dailyActivity,
    };
  }
}
