import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AlertDocument = Alert & Document;

@Schema({ timestamps: true, collection: 'alerts' })
export class Alert {
  _id!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  symbol!: string;

  @Prop({ required: true })
  condition!: string;

  @Prop({ required: true })
  type!: string;

  @Prop({ type: Number, required: true })
  value!: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  triggeredAt?: Date;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);
