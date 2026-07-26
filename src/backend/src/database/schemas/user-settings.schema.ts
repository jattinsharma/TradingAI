import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserSettingsDocument = UserSettings & Document;

@Schema({ timestamps: true, collection: 'user_settings' })
export class UserSettings {
  _id!: string;

  @Prop({ required: true, unique: true, index: true })
  userId!: string;

  @Prop({ default: 'dark' })
  theme!: string;

  @Prop({ type: Object, default: { email: true, push: true, sound: true } })
  notifications!: { email: boolean; push: boolean; sound: boolean };

  @Prop({
    type: Object,
    default: { defaultTimeframe: '1D', defaultChartType: 'candlestick', riskTolerance: 'medium' },
  })
  tradingPreferences!: {
    defaultTimeframe: string;
    defaultChartType: string;
    riskTolerance: 'low' | 'medium' | 'high';
  };

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);
