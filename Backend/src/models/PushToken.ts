import { Schema, model } from 'mongoose';

/** One row per device/browser. A user can have many; a token belongs to exactly one user. */
const pushTokenSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['web', 'android', 'ios'], default: 'web' },
    userAgent: { type: String, maxlength: 300 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

// Browsers rotate tokens; drop ones not refreshed for 60 days.
pushTokenSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 60 * 24 * 3600 });

export const PushToken = model('PushToken', pushTokenSchema);
