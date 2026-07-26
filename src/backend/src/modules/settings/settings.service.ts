import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserSettings, UserSettingsDocument } from '../../database/schemas/user-settings.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(UserSettings.name)
    private readonly model: Model<UserSettingsDocument>,
  ) {}

  async getUserSettings(userId: string): Promise<UserSettings | null> {
    return this.model.findOne({ userId }).exec();
  }

  async createSettings(createSettingsDto: {
    userId: string;
    theme?: string;
    notifications?: { email: boolean; push: boolean; sound: boolean };
    tradingPreferences?: {
      defaultTimeframe: string;
      defaultChartType: string;
      riskTolerance: 'low' | 'medium' | 'high';
    };
  }): Promise<UserSettings> {
    const existing = await this.model.findOne({ userId: createSettingsDto.userId }).exec();
    if (existing) {
      return this.updateSettings(String(existing._id), createSettingsDto);
    }

    const created = new this.model({
      userId: createSettingsDto.userId,
      theme: createSettingsDto.theme ?? 'dark',
      notifications: {
        email: createSettingsDto.notifications?.email ?? true,
        push: createSettingsDto.notifications?.push ?? true,
        sound: createSettingsDto.notifications?.sound ?? true,
      },
      tradingPreferences: {
        defaultTimeframe: createSettingsDto.tradingPreferences?.defaultTimeframe ?? '1D',
        defaultChartType: createSettingsDto.tradingPreferences?.defaultChartType ?? 'candlestick',
        riskTolerance: createSettingsDto.tradingPreferences?.riskTolerance ?? 'medium',
      },
    });

    return created.save();
  }

  async updateSettings(
    id: string,
    updateSettingsDto: Partial<{
      theme: string;
      notifications: { email: boolean; push: boolean; sound: boolean };
      tradingPreferences: {
        defaultTimeframe: string;
        defaultChartType: string;
        riskTolerance: 'low' | 'medium' | 'high';
      };
    }>,
  ): Promise<UserSettings> {
    const settings = await this.model.findById(id).exec();
    if (!settings) {
      throw new NotFoundException(`Settings with ID ${id} not found`);
    }

    if (updateSettingsDto.theme !== undefined) settings.theme = updateSettingsDto.theme;
    if (updateSettingsDto.notifications !== undefined) {
      settings.notifications = { ...settings.notifications, ...updateSettingsDto.notifications };
    }
    if (updateSettingsDto.tradingPreferences !== undefined) {
      settings.tradingPreferences = { ...settings.tradingPreferences, ...updateSettingsDto.tradingPreferences };
    }

    return settings.save();
  }

  async deleteSettings(id: string): Promise<void> {
    const settings = await this.model.findById(id).exec();
    if (!settings) {
      throw new NotFoundException(`Settings with ID ${id} not found`);
    }
    await this.model.findByIdAndDelete(id).exec();
  }
}
