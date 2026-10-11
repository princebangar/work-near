import express, { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { HttpError, logger, ok, toId, validate } from '../../lib/core.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireFeature } from '../../middlewares/features.js';
import { Payment, Plan } from '../../models/billing.js';
import { User } from '../../models/user.js';
import {
  createGatewayOrder, markFailed, planDto, settle, subscriptionDto, verifyCheckoutSignature, verifyWebhookSignature,
} from './subscription.service.js';

export const subscriptionRouter = Router();
// Admin can switch the whole subscription model off (Customization Settings). Webhook below stays live for in-flight payments.
subscriptionRouter.use(requireFeature('subscriptions'));

subscriptionRouter.get('/plans', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  const plans = await Plan.find({ active: true }).sort({ sort: 1 }).lean();
  ok(res, plans.map(planDto));
});

subscriptionRouter.get('/me', requireAuth, async (req, res) => ok(res, await subscriptionDto(req.user!.sub)));

subscriptionRouter.get('/payments', requireAuth, async (req, res) => {
  const rows = await Payment.find({ user: req.user!.sub }).sort({ createdAt: -1 }).limit(50).lean();
  ok(res, rows.map((p) => ({ id: p.orderId, planName: p.planName, amount: p.amount, status: p.status, createdAt: (p.createdAt as Date).toISOString(), paidAt: p.paidAt?.toISOString() })));
});

/** Creates a pending payment + gateway order. The plan is NOT activated here. */
subscriptionRouter.post('/checkout', requireAuth, validate({ body: z.object({ planId: z.string().max(40) }) }), async (req, res) => {
  const plan = await Plan.findOne({ _id: (res.locals.body as { planId: string }).planId, active: true }).lean();
  if (!plan) throw HttpError.notFound('This plan is not available');
  const user = await User.findById(req.user!.sub, { name: 1, mobile: 1, email: 1 }).lean();
  const order = await createGatewayOrder(plan.price, `wn_${req.user!.sub.slice(-8)}_${Date.now()}`, { userId: req.user!.sub, planId: plan._id });
  await Payment.create({ user: toId(req.user!.sub), plan: plan._id, planName: plan.name, amount: plan.price, gateway: order.gateway, orderId: order.orderId });
  ok(res, {
    gateway: order.gateway, orderId: order.orderId, amount: plan.price, currency: 'INR', planName: plan.name,
    keyId: order.gateway === 'razorpay' ? env.RAZORPAY_KEY_ID : undefined,
    prefill: { name: user?.name, contact: user?.mobile, email: user?.email },
  }, 201);
});

const verifyBody = z.object({
  orderId: z.string().max(80),
  paymentId: z.string().max(80).optional(),
  signature: z.string().max(200).optional(),
  status: z.enum(['success', 'failed']).default('success'), // test gateway only
});
/** Client callback after checkout. Activation happens only after server-side signature verification. */
subscriptionRouter.post('/verify', requireAuth, validate({ body: verifyBody }), async (req, res) => {
  const b = res.locals.body as z.infer<typeof verifyBody>;
  const p = await Payment.findOne({ orderId: b.orderId, user: req.user!.sub }).lean();
  if (!p) throw HttpError.notFound('Payment not found');
  if (p.gateway === 'test') {
    if (env.isProd) throw HttpError.forbidden();
    if (b.status === 'failed') await markFailed(b.orderId, 'Test payment failed');
    else await settle(b.orderId, `test_pay_${Date.now()}`);
  } else {
    if (!b.paymentId || !b.signature || !verifyCheckoutSignature(b.orderId, b.paymentId, b.signature)) {
      await markFailed(b.orderId, 'Signature verification failed');
      throw HttpError.badRequest('Payment could not be verified', 'PAYMENT_UNVERIFIED');
    }
    await settle(b.orderId, b.paymentId);
  }
  const after = await Payment.findOne({ orderId: b.orderId }).lean();
  ok(res, { payment: { status: after!.status, orderId: after!.orderId }, subscription: await subscriptionDto(req.user!.sub) });
});

/**
 * Razorpay webhook (signed). Mounted with a raw-body parser in app.ts — signature is computed over exact bytes.
 * Handles duplicates idempotently and always answers 200 for events we don't care about.
 */
export const paymentsWebhook = Router();
paymentsWebhook.post('/webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
  const sig = req.get('x-razorpay-signature') ?? '';
  if (!Buffer.isBuffer(req.body) || !verifyWebhookSignature(req.body, sig)) throw HttpError.unauthorized('Invalid signature');
  const evt = JSON.parse(req.body.toString('utf8')) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string; error_description?: string } } } };
  const pay = evt.payload?.payment?.entity;
  if (pay?.order_id) {
    if (evt.event === 'payment.captured' || evt.event === 'order.paid') await settle(pay.order_id, pay.id);
    else if (evt.event === 'payment.failed') await markFailed(pay.order_id, pay.error_description);
  }
  logger.info({ event: evt.event, order: pay?.order_id }, 'payment webhook');
  ok(res, { received: true });
});
