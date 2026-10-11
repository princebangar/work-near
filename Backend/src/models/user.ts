import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One account per mobile number. The same account can act as Customer and Worker (SRS 5.1 / 13) —
 * `roles` holds what the user has unlocked, `activeRole` is the side of the app they are currently using.
 */
const userSchema = new Schema(
  {
    mobile: { type: String, required: true, unique: true },
    name: { type: String, default: '', trim: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    avatar: { type: String, default: '' },
    roles: { type: [String], enum: ['customer', 'worker'], default: ['customer'] },
    activeRole: { type: String, enum: ['customer', 'worker'], default: 'customer' },
    language: { type: String, enum: ['en', 'hi'], default: 'en' },
    status: { type: String, enum: ['active', 'suspended', 'deleted_request', 'deleted'], default: 'active', index: true },
    statusReason: String,
    city: { type: String, default: '' },
    notif: {
      chat: { type: Boolean, default: true },
      subscription: { type: Boolean, default: true },
      offers: { type: Boolean, default: false },
    },
    consentVersion: String,
    consentAt: Date,
    deletionRequestedAt: Date,
    lastLoginAt: Date,
    lastActiveAt: { type: Date, default: Date.now },
    tokenVersion: { type: Number, default: 0 }, // bump to revoke every issued token (suspend / delete)
  },
  { timestamps: true, versionKey: false },
);
userSchema.index({ createdAt: -1 });
userSchema.index({ name: 'text', mobile: 'text' });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: import('mongoose').Types.ObjectId };
export const User = model('User', userSchema);

/** OTP challenges. Only a keyed HMAC-SHA256 of the code is stored; Mongo TTL removes rows after the rate window. */
const otpSchema = new Schema(
  {
    mobile: { type: String, required: true, unique: true },
    hash: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    resendAt: { type: Date, required: true },
    sent: { type: [{ type: Date }], default: [] },
    purgeAt: { type: Date, required: true },
  },
  { versionKey: false },
);
otpSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
export const Otp = model('Otp', otpSchema);

/** blocker → blocked. Blocked users cannot message the blocker (SRS 5.9). */
const blockSchema = new Schema(
  {
    blocker: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blocked: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
blockSchema.index({ blocked: 1 });
export const Block = model('Block', blockSchema);
