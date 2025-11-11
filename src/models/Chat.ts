import { Schema, model, type Document, Types } from 'mongoose';

export interface ChatDoc extends Document {
  userId: Types.ObjectId;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<ChatDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, default: 'Нов Чат' },
  },
  { timestamps: true }
);

ChatSchema.index({ userId: 1, createdAt: -1 });

export const Chat = model<ChatDoc>('Chat', ChatSchema);

