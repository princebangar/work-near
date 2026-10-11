import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { HttpError, logger } from '../../lib/core.js';
import { notify } from '../../lib/notify.js';
import { Payment, Plan, Subscription } from '../../models/billing.js';

export const planDto = (p: { _id: string; name: string; price: number; period: string; features: string[]; badge?: string | null; active: boolean }) => ({
  id: p._id, name: p.name, price: p.price, period: p.period, features: p.features, badge: p.badge ?? undefined, active: p.active,
});

export async function subscriptionDto(userId: string) {
  const s = await Subscription.findOne({ user: userId }).lean();
  if (!s) return { planId: null, status: 'none', renewal: 'manual' };
  const expired = s.status === 'active' && s.endAt && s.endAt < new Date();
  const plan = s.plan ? await Plan.findById(s.plan, { name: 1 }).lean() : null;
  return {
    planId: s.plan ?? null, planName: plan?.name, status: expired ? 'expired' : s.status, startAt: s.startAt?.toISOString(),
    endAt: s.endAt?.toISOString(), renewal: 'manual', source: s.source,
  };
}

const addPeriod = (from: Date, period: 'month' | 'year') => {
  const d = new Date(from);
  if (period === 'year') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
};

/** Extends (or starts) the entitlement. Renewing early stacks on top of the current end date. */
export async function grant(userId: string | Types.ObjectId, planId: string, source: 'payment' | 'admin_grant') {
  const plan = await Plan.findById(planId).lean();
  if (!plan) throw HttpError.notFound('Plan not found');
  const cur = await Subscription.findOne({ user: userId }).lean();
  const now = new Date();
  const base = cur?.status === 'active' && cur.endAt && cur.endAt > now ? cur.endAt : now;
  const endAt = addPeriod(base, plan.period as 'month' | 'year');
  await Subscription.updateOne(
    { user: userId },
    { $set: { plan: planId, status: 'active', endAt, source, reminderSentAt: null, ...(base === now && { startAt: now }) }, $setOnInsert: { user: userId } },
    { upsert: true },
  );
  return endAt;
}

/**
 * Marks a payment successful exactly once (duplicate callbacks/webhooks are no-ops) and activates the plan.
 * Never called from client claims alone — only after signature verification (SRS 5.6, AC-08).
 */
export async function settle(orderId: string, paymentId?: string) {
  const p = await Payment.findOneAndUpdate(
    { orderId, status: { $in: ['pending', 'failed'] } },
    { status: 'success', paymentId, paidAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!p) return (await Payment.findOne({ orderId }).lean()) ?? null; // already settled (idempotent)
  const endAt = await grant(p.user, p.plan, 'payment');
  void notify(p.user, { type: 'subscription', title: `${p.planName} plan activated ✅`, body: `Valid till ${endAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Receipt: ${p.orderId}`, link: '/subscription' });
  return p.toObject();
}

export async function markFailed(orderId: string, reason?: string) {
  await Payment.updateOne({ orderId, status: 'pending' }, { status: 'failed', failureReason: reason?.slice(0, 200) });
}

// ---------- Razorpay (REST, no SDK) ----------
const rzpAuth = () => 'Basic ' + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');

export async function createGatewayOrder(amountInr: number, receipt: string, notes: Record<string, string>) {
  if (!env.razorpayEnabled) {
    if (env.isProd) throw new HttpError(503, 'PAYMENTS_DISABLED', 'Payments are not configured');
    return { gateway: 'test' as const, orderId: `test_${randomBytes(10).toString('hex')}` };
  }
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: rzpAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(amountInr * 100), currency: 'INR', receipt, notes }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await r.json()) as { id?: string; error?: { description?: string } };
  if (!r.ok || !j.id) {
    logger.error({ status: r.status, j }, 'Razorpay order create failed');
    throw new HttpError(502, 'GATEWAY_ERROR', 'Payment gateway error. Please try again.');
  }
  return { gateway: 'razorpay' as const, orderId: j.id };
}

const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const verifyCheckoutSignature = (orderId: string, paymentId: string, signature: string) =>
  safeEq(createHmac('sha256', env.RAZORPAY_KEY_SECRET ?? '').update(`${orderId}|${paymentId}`).digest('hex'), signature);

export const verifyWebhookSignature = (raw: Buffer, signature: string) =>
  !!env.RAZORPAY_WEBHOOK_SECRET && safeEq(createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex'), signature);

export async function refundPayment(paymentId: string, amountInr: number) {
  if (!env.razorpayEnabled || paymentId.startsWith('test_')) return `rfnd_test_${randomBytes(6).toString('hex')}`;
  const r = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: 'POST', headers: { Authorization: rzpAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(amountInr * 100) }), signal: AbortSignal.timeout(15_000),
  });
  const j = (await r.json()) as { id?: string; error?: { description?: string } };
  if (!r.ok || !j.id) throw new HttpError(502, 'REFUND_FAILED', j.error?.description ?? 'Refund failed at gateway');
  return j.id;
}

/** Hourly: expire lapsed plans and send a reminder 3 days before expiry (SRS 5.6 / 5.8). */
export function startSubscriptionJobs() {
  const run = async () => {
    const now = new Date();
    // Checkouts the user closed without paying never get a callback — close them after 30 min.
    // (A late Razorpay webhook can still settle a 'failed' order, see settle().)
    await Payment.updateMany({ status: 'pending', createdAt: { $lt: new Date(now.getTime() - 30 * 60_000) } }, { status: 'failed', failureReason: 'Checkout abandoned' });
    const soon = new Date(now.getTime() + 3 * 86_400_000);
    // Each row is *claimed* with a conditional update before notifying, so when several API instances run this
    // job at the same time (load balancer), every user still gets exactly one reminder / expiry notice.
    const expiring = await Subscription.find({ status: 'active', endAt: { $gt: now, $lte: soon }, reminderSentAt: null }, { _id: 1, user: 1 }).lean();
    for (const s of expiring) {
      const claimed = await Subscription.updateOne({ _id: s._id, reminderSentAt: null }, { reminderSentAt: now });
      if (claimed.modifiedCount) void notify(s.user, { type: 'subscription', title: 'Subscription expiring soon', body: 'Your plan expires in less than 3 days. Renew to keep all benefits.', link: '/subscription' });
    }
    const lapsed = await Subscription.find({ status: 'active', endAt: { $lte: now } }, { _id: 1, user: 1 }).lean();
    for (const s of lapsed) {
      const claimed = await Subscription.updateOne({ _id: s._id, status: 'active', endAt: { $lte: now } }, { status: 'expired' }); // not if renewed meanwhile
      if (claimed.modifiedCount) void notify(s.user, { type: 'subscription', title: 'Subscription expired', body: 'Renew anytime from Account → Subscription.', link: '/subscription' });
    }
  };
  const tick = () => run().catch((err) => logger.error({ err }, 'subscription job failed'));
  setTimeout(tick, 15_000).unref();
  setInterval(tick, 15 * 60_000).unref(); // every 15 min (cheap indexed queries)
}
