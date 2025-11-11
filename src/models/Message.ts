import { Schema, model, type Document, Types } from 'mongoose';

export interface MessageDoc extends Document {
  chatId: Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<MessageDoc>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

MessageSchema.index({ chatId: 1, createdAt: 1 });

export const Message = model<MessageDoc>('Message', MessageSchema);

