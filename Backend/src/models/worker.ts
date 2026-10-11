import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/**
 * Public worker profile — 1:1 with a User that has the `worker` role.
 * The public worker id used by the API is the owning user's id.
 * `location` is a GeoJSON point (2dsphere) — never returned to clients (SRS 5.2: no exact address).
 */
const workerProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    photo: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 1000 },
    category: { type: String, ref: 'Category', required: true, index: true },
    skills: { type: [String], default: [] },
    experienceYrs: { type: Number, default: 0, min: 0, max: 60 },
    languages: { type: [String], default: ['Hindi'] },
    priceRange: { type: String, default: '', maxlength: 40 },
    hours: { type: String, default: 'Mon – Sat, 9:00 AM – 7:00 PM', maxlength: 80 },
    serviceRadiusKm: { type: Number, enum: [5, 10, 15], default: 5 },
    locality: { type: String, default: '', maxlength: 120 },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    portfolio: { type: [String], default: [] },
    available: { type: Boolean, default: true },
    visible: { type: Boolean, default: true }, // worker can pause
    restricted: { type: Boolean, default: false }, // admin can hide
    showPhone: { type: Boolean, default: false }, // phone shared only with consent (SRS 5.4)
    verification: { type: String, enum: ['phone', 'id', 'id_address', null], default: null }, // set only by admin approval
    verificationStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected', 'info_requested'], default: 'none' },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);
workerProfileSchema.index({ location: '2dsphere' });
workerProfileSchema.index({ visible: 1, restricted: 1, category: 1 });
workerProfileSchema.index({ displayName: 'text', skills: 'text', bio: 'text' });
export const WorkerProfile = model('WorkerProfile', workerProfileSchema);
export type WorkerProfileLean = InferSchemaType<typeof workerProfileSchema> & { _id: Types.ObjectId };

/** Verification submissions. Documents live in private storage; paths are never sent to non-admins. */
const verificationSchema = new Schema(
  {
    worker: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['phone', 'id', 'id_address'], required: true },
    documents: [{ name: String, path: String, mime: String, size: Number }],
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'info_requested'], default: 'pending', index: true },
    reviewer: { type: Schema.Types.ObjectId, ref: 'Admin' },
    reason: String,
    reviewedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
export const Verification = model('Verification', verificationSchema);

/** One review per conversation (the recorded interaction — SRS 5.7). */
const reviewSchema = new Schema(
  {
    reviewer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    worker: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, unique: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: '', maxlength: 1000 },
    status: { type: String, enum: ['visible', 'hidden'], default: 'visible' },
    reports: { type: Number, default: 0 },
    hiddenReason: String,
  },
  { timestamps: true, versionKey: false },
);
reviewSchema.index({ worker: 1, status: 1, createdAt: -1 });
export const Review = model('Review', reviewSchema);
