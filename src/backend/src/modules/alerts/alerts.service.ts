import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Alert, AlertDocument } from '../../database/schemas/alert.schema';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectModel(Alert.name)
    private readonly model: Model<AlertDocument>,
  ) {}

  async findAll(userId?: string): Promise<Alert[]> {
    const query = userId ? { userId } : {};
    return this.model.find(query).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<AlertDocument> {
    const alert = await this.model.findById(id).exec();
    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }
    return alert;
  }

  async create(createAlertDto: {
    userId: string;
    symbol: string;
    condition: string;
    type: string;
    value: number | string;
    isActive?: boolean;
  }): Promise<Alert> {
    const created = new this.model({
      userId: createAlertDto.userId,
      symbol: createAlertDto.symbol,
      condition: createAlertDto.condition,
      type: createAlertDto.type,
      value: Number(createAlertDto.value),
      isActive: createAlertDto.isActive ?? true,
    });

    return created.save();
  }

  async remove(id: string): Promise<AlertDocument> {
    const alert = await this.findOne(id);
    await this.model.findByIdAndDelete(id).exec();
    return alert;
  }

  async toggle(id: string): Promise<AlertDocument> {
    const alert = await this.findOne(id);
    alert.isActive = !alert.isActive;
    return alert.save();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAlerts() {
    const activeAlerts = await this.model.find({ isActive: true }).exec();

    for (const alert of activeAlerts) {
      const shouldTrigger = Math.random() > 0.95;
      if (shouldTrigger) {
        alert.triggeredAt = new Date();
        await alert.save();
        this.logger.log(`Alert triggered: ${alert.symbol} ${alert.condition}`);
      }
    }
  }
}
