import { useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { Check, CircleAlert, Clock, Crown, FlaskConical, Receipt, X } from 'lucide-react';
import { Badge, Button, Card, ErrorState, Sheet, Skeleton, TopBar, type Tone } from '@/components/ui';
import { errorMessage, toastError, useCheckout, useMySubscription, usePayments, usePlans, useVerifyPayment } from '@/api';
import { useFeature, toast } from '@/store';
import { env, APP } from '@/config/env';
import { useT } from '@/i18n';
import { cn, date, inr } from '@/lib/format';
import type { CheckoutOrder, PaymentStatus, Subscription, VerifyPaymentBody } from '@/types';

// ---------- Razorpay (loaded only when the user pays) ----------
interface RazorpayResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
interface RazorpayInstance { open: () => void; on: (ev: 'payment.failed', cb: (r: { error?: { description?: string } }) => void) => void }
type RazorpayCtor = new (opts: Record<string, unknown>) => RazorpayInstance;
let rzpLoading: Promise<RazorpayCtor> | null = null;
function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return (rzpLoading ??= new Promise<RazorpayCtor>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('Razorpay unavailable')));
    s.onerror = () => { rzpLoading = null; s.remove(); reject(new Error('Failed to load Razorpay')); };
    document.head.appendChild(s);
  }));
}
const brandColor = () => getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim() || '#4f46e5';

type Result = { ok: boolean; sub?: Subscription; orderId: string; message?: string };
const payTone: Record<PaymentStatus, Tone> = { success: 'success', failed: 'danger', pending: 'warning', refunded: 'neutral' };

export function SubscriptionPage() {
  const t = useT();
  const on = useFeature('subscriptions');
  const plans = usePlans(on);
  const sub = useMySubscription(on);
  const payments = usePayments(on);
  const checkout = useCheckout();
  const verify = useVerifyPayment();
  const [sel, setSel] = useState<string | null>(null);
  const [testOrder, setTestOrder] = useState<CheckoutOrder | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [opening, setOpening] = useState(false);
  const failReason = useRef<string | undefined>(undefined);

  if (!on) return <Navigate to="/" replace />;
  const list = plans.data?.filter((p) => p.active) ?? [];
  const selected = sel ?? list.find((p) => p.badge)?.id ?? list[0]?.id;
  const plan = list.find((p) => p.id === selected);
  const s = sub.data;
  const active = s?.status === 'active';

  const verifyPay = (body: VerifyPaymentBody) =>
    verify.mutate(body, {
      onSuccess: (r) => {
        setTestOrder(null);
        const ok = r.payment.status === 'success' && r.subscription.status === 'active';
        setResult({ ok, sub: r.subscription, orderId: r.payment.orderId, message: ok ? undefined : t('paymentNotCompleted') });
      },
      onError: (e) => { setTestOrder(null); setResult({ ok: false, orderId: body.orderId, message: errorMessage(e) }); },
    });

  const openRazorpay = async (o: CheckoutOrder) => {
    setOpening(true);
    try {
      const Razorpay = await loadRazorpay();
      failReason.current = undefined;
      const rzp = new Razorpay({
        key: o.keyId ?? env.razorpayKeyId, order_id: o.orderId, amount: o.amount * 100, currency: o.currency, name: APP.name,
        description: `${o.planName} plan`, prefill: o.prefill, theme: { color: brandColor() },
        handler: (r: RazorpayResponse) => verifyPay({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
        modal: {
          ondismiss: () => {
            if (failReason.current) setResult({ ok: false, orderId: o.orderId, message: failReason.current });
            else toast(t('paymentCancelled'), 'info');
          },
        },
      });
      rzp.on('payment.failed', (r) => { failReason.current = r.error?.description || t('paymentFailed'); });
      rzp.open();
    } catch {
      toast(t('gatewayLoadFailed'), 'error');
    } finally {
      setOpening(false);
    }
  };

  const pay = () =>
    plan &&
    checkout.mutate(plan.id, {
      onSuccess: (o) => (o.gateway === 'test' ? setTestOrder(o) : void openRazorpay(o)),
      onError: (e) => toastError(e),
    });

  const statusCard = () => {
    if (sub.isLoading) return <Skeleton className="h-24" />;
    if (sub.isError) return <ErrorState message={errorMessage(sub.error)} onRetry={() => sub.refetch()} />;
    if (!s || s.status === 'none') return null;
    const cfg = {
      active: { cls: 'border-success/30 bg-success-soft', tone: 'success' as Tone, label: t('subActive') },
      expired: { cls: 'border-warning/30 bg-warning-soft', tone: 'warning' as Tone, label: t('subExpired') },
      pending: { cls: 'border-primary/25 bg-primary-soft', tone: 'primary' as Tone, label: t('subPending') },
    }[s.status];
    return (
      <Card className={cn('p-4', cfg.cls)}>
        <Badge tone={cfg.tone}>{cfg.label}</Badge>
        <b className="mt-2 block text-lg">{t('currentPlan')}: {s.planName ?? s.planId}</b>
        {s.status === 'active' && s.endAt && (
          <p className="text-sm text-ink-2">{s.startAt ? `${date(s.startAt)} → ` : ''}{date(s.endAt)} · {t('manualRenewal')}</p>
        )}
        {s.status === 'expired' && s.endAt && <p className="text-sm text-ink-2">{t('expiredOn')} {date(s.endAt)}. {t('renewToContinue')}</p>}
        {s.status === 'pending' && <p className="text-sm text-ink-2">{t('subPendingSub')}</p>}
      </Card>
    );
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar title={t('subscription')} />
      <div className="flex-1 space-y-4 p-4">
        {statusCard()}
        <div className="text-center">
          <Crown className="mx-auto mb-2 text-accent" size={36} />
          <h2 className="text-xl font-extrabold">{active ? t('extendPlan') : t('choosePlan')}</h2>
          <p className="text-sm text-ink-2">{active ? t('extendNote') : t('subSeparate')}</p>
        </div>
        {plans.isLoading && <><Skeleton className="h-40" /><Skeleton className="h-40" /></>}
        {plans.isError && <ErrorState message={errorMessage(plans.error)} onRetry={() => plans.refetch()} />}
        {plans.isSuccess && list.length === 0 && <p className="py-6 text-center text-sm text-ink-2">{t('noPlans')}</p>}
        <div role="radiogroup" className="space-y-3">
          {list.map((p) => (
            <button key={p.id} role="radio" aria-checked={selected === p.id} onClick={() => setSel(p.id)}
              className={cn('relative w-full rounded-card border-2 bg-surface p-4 text-left transition', selected === p.id ? 'border-primary bg-primary-soft' : 'border-line')}>
              {p.badge && <Badge tone="success" className="absolute top-4 right-4">{p.badge}</Badge>}
              <span className="text-sm font-semibold text-ink-2">{p.name}</span>
              <div className="text-3xl font-extrabold">{inr(p.price)}<span className="text-base font-medium text-ink-2">{p.period === 'month' ? t('perMonth') : t('perYear')}</span></div>
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f) => <li key={f} className="flex items-center gap-2 text-sm"><Check size={16} className="shrink-0 text-success" />{f}</li>)}
              </ul>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-ink-3">{t('inclTax')} <Link to="/legal/refund" className="text-primary underline">{t('refundPolicy')}</Link></p>

        <section className="pt-2">
          <h3 className="mb-2 flex items-center gap-2 font-bold"><Receipt size={18} className="text-primary" />{t('paymentHistory')}</h3>
          {payments.isLoading ? <Skeleton className="h-16" /> : payments.isError ? (
            <ErrorState message={errorMessage(payments.error)} onRetry={() => payments.refetch()} />
          ) : payments.data?.length ? (
            <Card className="divide-y divide-line">
              {payments.data.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <b className="block text-sm">{p.planName} · {inr(p.amount)}</b>
                    <span className="block truncate text-xs text-ink-3">{date(p.paidAt ?? p.createdAt)} · #{p.id}</span>
                  </div>
                  <Badge tone={payTone[p.status] ?? 'neutral'}>{p.status}</Badge>
                </div>
              ))}
            </Card>
          ) : (
            <p className="rounded-xl bg-surface-2 p-4 text-center text-sm text-ink-2">{t('noPayments')}</p>
          )}
        </section>
      </div>
      <div className="pb-safe sticky bottom-0 border-t border-line bg-surface p-3 dark:shadow-[0_-10px_28px_-14px_rgba(0,0,0,0.9)]">
        <Button size="lg" block disabled={!plan} loading={checkout.isPending || opening || verify.isPending} onClick={pay}>
          {t('payNow')} {plan && inr(plan.price)}
        </Button>
      </div>

      {/* Dev/test gateway (backend without Razorpay keys). */}
      <Sheet open={!!testOrder} onClose={() => !verify.isPending && setTestOrder(null)} title={t('testPayment')}>
        {testOrder && (
          <>
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-warning-soft p-3 text-sm text-ink-2">
              <FlaskConical size={18} className="mt-0.5 shrink-0 text-warning" />{t('testPaymentNote')}
            </div>
            <div className="mb-5 space-y-1 text-sm">
              <p className="flex justify-between"><span className="text-ink-2">{t('plan')}</span><b>{testOrder.planName}</b></p>
              <p className="flex justify-between"><span className="text-ink-2">{t('amount')}</span><b>{inr(testOrder.amount)}</b></p>
              <p className="flex justify-between gap-3"><span className="text-ink-2">{t('orderId')}</span><b className="truncate">{testOrder.orderId}</b></p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" block disabled={verify.isPending} onClick={() => verifyPay({ orderId: testOrder.orderId, status: 'failed' })}>{t('payFail')}</Button>
              <Button block loading={verify.isPending} onClick={() => verifyPay({ orderId: testOrder.orderId, status: 'success' })}>{t('paySuccess')}</Button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={!!result} onClose={() => setResult(null)} title={result?.ok ? t('paymentSuccessful') : t('paymentFailed')}>
        {result && (
          <div className="py-2 text-center">
            <span className={cn('mx-auto mb-3 grid size-16 place-items-center rounded-full', result.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
              {result.ok ? <Check size={32} /> : <X size={32} />}
            </span>
            {result.ok && result.sub ? (
              <>
                <b className="text-lg">{result.sub.planName ?? plan?.name} · {t('subActive')}</b>
                {result.sub.endAt && <p className="mt-1 text-sm text-ink-2">{t('validTill')} {date(result.sub.endAt)}</p>}
              </>
            ) : (
              <>
                <b className="text-lg">{t('planNotActivated')}</b>
                {result.message && <p className="mt-1 flex items-center justify-center gap-1 text-sm text-ink-2"><CircleAlert size={14} />{result.message}</p>}
              </>
            )}
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-ink-3"><Clock size={12} />{t('receipt')}: {result.orderId}</p>
            <Button block className="mt-5" onClick={() => setResult(null)}>{result.ok ? t('done') : t('close')}</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
