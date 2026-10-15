import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/** Admin / support staff accounts — separate from app users, password + MFA (SRS 5.1, 11). */
const adminSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'admin', 'support', 'sub_admin'], default: 'support' },
    // sub_admin only: { [module]: { view, create, edit, delete } } — see lib/permissions.ts
    permissions: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    mfaSecret: String, // base32 TOTP secret; when set, login requires an authenticator code
    lastLoginAt: Date,
    loginHistory: { type: [{ at: Date, ip: String, ok: Boolean }], default: [] },
  },
  { timestamps: true, versionKey: false },
);
export const Admin = model('Admin', adminSchema);

/** Complaints & reports (user reports of profiles/messages/reviews also land here). */
const complaintSchema = new Schema(
  {
    code: { type: String, required: true, unique: true }, // human id, e.g. C1042
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: ['profile', 'message', 'review', 'fraud', 'other'], default: 'other' },
    targetId: String,
    targetUser: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    category: { type: String, required: true },
    description: { type: String, default: '', maxlength: 2000 },
    evidence: { type: [String], default: [] },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'escalated'], default: 'open', index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Admin', index: true },
    resolution: String,
    history: { type: [{ at: Date, by: String, action: String, note: String }], default: [] },
  },
  { timestamps: true, versionKey: false },
);
complaintSchema.index({ createdAt: -1 });
export const Complaint = model('Complaint', complaintSchema);
export type ComplaintLean = InferSchemaType<typeof complaintSchema> & { _id: Types.ObjectId };

/** In-app notification inbox (SRS 5.8). */
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['chat', 'subscription', 'verification', 'complaint', 'system'], required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: String,
    broadcast: { type: Schema.Types.ObjectId, ref: 'Broadcast' }, // set when sent by an admin broadcast (lets admin recall it)
    readAt: Date,
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ broadcast: 1 }, { sparse: true });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 }); // keep 6 months
export const Notification = model('Notification', notificationSchema);

/** Admin → users announcements (inbox + push). History for the Broadcast page. */
const broadcastSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, required: true, trim: true, maxlength: 500 },
    link: { type: String, default: '' },
    kind: { type: String, enum: ['announcement', 'offer'], default: 'announcement' }, // offers respect the user's "Offers" setting
    audience: { type: String, enum: ['all', 'customers', 'workers', 'custom'], required: true },
    targetIds: { type: [Schema.Types.ObjectId], default: [] },
    status: { type: String, enum: ['sending', 'sent', 'failed'], default: 'sending' },
    recipients: { type: Number, default: 0 },
    pushSent: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    createdByName: String,
    error: String,
  },
  { timestamps: true, versionKey: false },
);
broadcastSchema.index({ createdAt: -1 });
export const Broadcast = model('Broadcast', broadcastSchema);

/** Search analytics for the dashboard ("searches today", demand by category). Auto-expires after 90 days. */
const searchLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    q: String,
    category: String,
    radiusKm: Number,
    results: Number,
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
searchLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
export const SearchLog = model('SearchLog', searchLogSchema);

/** Sequential counters (complaint codes etc). */
const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = model('Counter', counterSchema);
export const nextSeq = async (key: string, start = 1000) => {
  const c = await Counter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' }).lean();
  return start + (c?.seq ?? 1);
};
