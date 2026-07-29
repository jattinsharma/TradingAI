import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ApiKeyDocument = ApiKey & Document;

@Schema({ timestamps: true, collection: 'api_keys' })
export class ApiKey {
  _id!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  lastUsedAt?: Date;

  @Prop()
  expiresAt?: Date;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);

ApiKeySchema.index({ userId: 1, isActive: 1 });
