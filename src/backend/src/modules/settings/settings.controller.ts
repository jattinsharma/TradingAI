import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(':userId')
  getUserSettings(@Param('userId') userId: string) {
    return this.settingsService.getUserSettings(userId);
  }

  @Post()
  createSettings(
    @Body()
    createSettingsDto: {
      userId: string;
      theme?: string;
      notifications?: {
        email: boolean;
        push: boolean;
        sound: boolean;
      };
      tradingPreferences?: {
        defaultTimeframe: string;
        defaultChartType: string;
        riskTolerance: 'low' | 'medium' | 'high';
      };
    },
  ) {
    return this.settingsService.createSettings(createSettingsDto);
  }

  @Put(':id')
  updateSettings(
    @Param('id') id: string,
    @Body()
    updateSettingsDto: Partial<{
      theme: string;
      notifications: {
        email: boolean;
        push: boolean;
        sound: boolean;
      };
      tradingPreferences: {
        defaultTimeframe: string;
        defaultChartType: string;
        riskTolerance: 'low' | 'medium' | 'high';
      };
    }>,
  ) {
    return this.settingsService.updateSettings(id, updateSettingsDto);
  }

  @Delete(':id')
  deleteSettings(@Param('id') id: string) {
    return this.settingsService.deleteSettings(id);
  }
}
