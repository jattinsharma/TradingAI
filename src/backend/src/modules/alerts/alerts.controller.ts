import { Controller, Get, Post, Body, Param, Delete, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll(@Query('userId') userId?: string) {
    return this.alertsService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.alertsService.findOne(id);
  }

  @Post()
  create(
    @Body()
    createAlertDto: {
      userId: string;
      symbol: string;
      condition: string; // e.g., "price > 100", "rsi < 30"
      type: string; // e.g., "price", "indicator", "news"
      value: number | string;
      isActive?: boolean;
    },
  ) {
    return this.alertsService.create(createAlertDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.alertsService.remove(id);
  }

  @Post(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.alertsService.toggle(id);
  }
}
