import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoleDocument = Role & Document;

@Schema({ timestamps: true, collection: 'roles' })
export class Role {
  _id!: string;

  @Prop({ required: true, unique: true, index: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
