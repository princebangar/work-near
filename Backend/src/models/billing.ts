import { Schema, model } from 'mongoose';

/** Subscription plans (₹30 / month, ₹300 / year). Price edits apply to future purchases only. */
const planSchema = new Schema(
  {
    _id: { type: String, required: true }, // 'monthly' | 'yearly' | custom slug
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, // INR, tax inclusive
    period: { type: String, enum: ['month', 'year'], required: true },
    features: { type: [String], default: [] },
    badge: String,
    active: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);
export const Plan = model('Plan', planSchema);

/** One row per user — the current entitlement. History lives in payments. */
const subscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    plan: { type: String, ref: 'Plan' },
    status: { type: String, enum: ['none', 'active', 'expired', 'pending'], default: 'none', index: true },
    startAt: Date,
    endAt: { type: Date, index: true },
    renewal: { type: String, enum: ['manual'], default: 'manual' },
    source: { type: String, enum: ['payment', 'admin_grant'], default: 'payment' },
    reminderSentAt: Date,
  },
  { timestamps: true, versionKey: false },
);
export const Subscription = model('Subscription', subscriptionSchema);

/** Gateway transactions. `orderId` is unique so duplicate callbacks/webhooks are idempotent. */
const paymentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, ref: 'Plan', required: true },
    planName: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    gateway: { type: String, enum: ['razorpay', 'test', 'admin'], required: true },
    orderId: { type: String, required: true, unique: true },
    paymentId: String,
    status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending', index: true },
    refundId: String,
    failureReason: String,
    paidAt: Date,
  },
  { timestamps: true, versionKey: false },
);
paymentSchema.index({ createdAt: -1 });
export const Payment = model('Payment', paymentSchema);
