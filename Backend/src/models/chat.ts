import { Schema, model } from 'mongoose';

const sideState = {
  unread: { type: Number, default: 0 },
  muted: { type: Boolean, default: false },
  lastReadAt: { type: Date, default: () => new Date(0) },
};

/** Customer ↔ Worker thread. One per (customer, worker) pair; per-side unread/mute state. */
const conversationSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    worker: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    customerState: sideState,
    workerState: sideState,
    workerReplied: { type: Boolean, default: false }, // review eligibility
  },
  { timestamps: true, versionKey: false },
);
conversationSchema.index({ customer: 1, worker: 1 }, { unique: true });
conversationSchema.index({ customer: 1, lastMessageAt: -1 });
conversationSchema.index({ worker: 1, lastMessageAt: -1 });
export const Conversation = model('Conversation', conversationSchema);

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'image'], default: 'text' },
    text: { type: String, default: '', maxlength: 2000 },
    image: String,
    moderation: { type: String, enum: ['ok', 'flagged', 'removed'], default: 'ok' },
    readAt: Date,
    sentAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
messageSchema.index({ conversation: 1, sentAt: -1 });
messageSchema.index({ sentAt: -1 });
export const Message = model('Message', messageSchema);
