import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WatchlistDocument = Watchlist & Document;

@Schema({ timestamps: true, collection: 'watchlists' })
export class Watchlist {
  _id!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: [String], default: [] })
  symbols!: string[];

  @Prop()
  description?: string;

  @Prop({ default: false })
  isPublic!: boolean;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const WatchlistSchema = SchemaFactory.createForClass(Watchlist);

WatchlistSchema.index({ userId: 1, name: 1 });
WatchlistSchema.index({ userId: 1, createdAt: -1 });
