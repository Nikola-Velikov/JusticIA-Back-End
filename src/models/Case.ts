import mongoose, { Schema, Types } from 'mongoose';

export interface CaseDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  chatIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const CaseSchema = new Schema<CaseDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  chatIds: { type: [Schema.Types.ObjectId], ref: 'Chat', default: [] },
}, { timestamps: true });

export const CaseModel = mongoose.model<CaseDoc>('Case', CaseSchema);

