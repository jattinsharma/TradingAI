import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  getAuditLogs(@Query('userId') userId?: string, @Query('limit') limit: number = 100) {
    return this.auditService.getAuditLogs(userId, limit);
  }

  @Get('user/:userId')
  getUserAuditLogs(@Param('userId') userId: string, @Query('limit') limit: number = 100) {
    return this.auditService.getAuditLogs(userId, limit);
  }

  @Get('stats')
  getAuditStats(@Query('days') days: number = 30) {
    return this.auditService.getAuditStats(days);
  }
}
