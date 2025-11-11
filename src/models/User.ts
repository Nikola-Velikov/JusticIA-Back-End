import { Schema, model, type Document } from 'mongoose';

export interface UserDoc extends Document {
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

// Unique index is declared on the field; no need to repeat via schema.index

export const User = model<UserDoc>('User', UserSchema);
