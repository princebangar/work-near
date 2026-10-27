// Native port of Frontend/src/features/subscription.tsx. Razorpay Standard Checkout has no Expo-compatible native SDK,
// so — as the only WebView in the app — the gateway's own checkout.js runs in a WebView for the payment step only.
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, CircleAlert, Clock, Crown, FlaskConical, Receipt, X } from 'lucide-react-native';
import { Badge, Button, Card, Divided, ErrorState, Sheet, Skeleton, TopBar, Txt } from '@/components/ui';
import { PullRefresh } from '@/components/PullRefresh';
import { errorMessage, toastError, useCheckout, useMySubscription, usePayments, usePlans, useVerifyPayment } from '@/api';
import { useFeature, toast } from '@/store';
import { env, APP } from '@/config/env';
import { useT } from '@/i18n';
import { date, inr } from '@/lib/format';
import { alpha, useColors } from '@/theme';

const payTone = { success: 'success', failed: 'danger', pending: 'warning', refunded: 'neutral' };

function checkoutHtml(options) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:transparent">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function post(m){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  try {
    var o = ${JSON.stringify(options)};
    o.handler = function (r) { post({ type: 'success', r: r }); };
    o.modal = { ondismiss: function () { post({ type: 'dismiss' }); } };
    var rzp = new Razorpay(o);
    rzp.on('payment.failed', function (r) { post({ type: 'failed', description: r && r.error && r.error.description }); });
    rzp.open();
  } catch (e) { post({ type: 'error' }); }
</script></body></html>`;
}

/** Razorpay checkout page in a WebView; reports success / failure / dismiss back to the screen. */
function RazorpayCheckout({ order, color, onSuccess, onFailed, onDismiss, onError }) {
  const c = useColors();
  const failReason = useRef(undefined);
  const [loading, setLoading] = useState(true);
  if (!order) return null;
  const options = {
    key: order.keyId ?? env.razorpayKeyId, order_id: order.orderId, amount: order.amount * 100, currency: order.currency, name: APP.name,
    description: `${order.planName} plan`, prefill: order.prefill, theme: { color },
  };
  const onMessage = (e) => {
    let m;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'success') onSuccess({ orderId: m.r.razorpay_order_id, paymentId: m.r.razorpay_payment_id, signature: m.r.razorpay_signature });
    else if (m.type === 'failed') failReason.current = m.description;
    else if (m.type === 'dismiss') {
      if (failReason.current) onFailed(failReason.current);
      else onDismiss();
    }
    else if (m.type === 'error') onError();
  };
  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => (failReason.current ? onFailed(failReason.current) : onDismiss())}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <WebView
          source={{ html: checkoutHtml(options), baseUrl: env.webOrigin }}
          originWhitelist={['*']}
          onMessage={onMessage}
          onLoadEnd={() => setLoading(false)}
          onError={onError}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          // UPI apps / intents open outside the WebView
          onShouldStartLoadWithRequest={(req) => {
            if (/^https?:|^about:|^data:/.test(req.url)) return true;
            Linking.openURL(req.url).catch(() => toast('No app found to complete this payment', 'error'));
            return false;
          }}
        />
        {loading && <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator size="large" color={c.surface} /></View>}
      </View>
    </Modal>
  );
}

export function SubscriptionPage() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const on = useFeature('subscriptions');
  const plans = usePlans(on);
  const sub = useMySubscription(on);
  const payments = usePayments(on);
  const checkout = useCheckout();
  const verify = useVerifyPayment();
  const [sel, setSel] = useState(null);
  const [testOrder, setTestOrder] = useState(null);
  const [rzpOrder, setRzpOrder] = useState(null);
  const [result, setResult] = useState(null);

  if (!on) return <Redirect href="/" />;
  const list = plans.data?.filter((p) => p.active) ?? [];
  const selected = sel ?? list.find((p) => p.badge)?.id ?? list[0]?.id;
  const plan = list.find((p) => p.id === selected);
  const s = sub.data;
  const active = s?.status === 'active';

  const verifyPay = (body) =>
    verify.mutate(body, {
      onSuccess: (r) => {
        setTestOrder(null);
        const ok = r.payment.status === 'success' && r.subscription.status === 'active';
        setResult({ ok, sub: r.subscription, orderId: r.payment.orderId, message: ok ? undefined : t('paymentNotCompleted') });
      },
      onError: (e) => { setTestOrder(null); setResult({ ok: false, orderId: body.orderId, message: errorMessage(e) }); },
    });

  const pay = () =>
    plan &&
    checkout.mutate(plan.id, {
      onSuccess: (o) => (o.gateway === 'test' ? setTestOrder(o) : setRzpOrder(o)),
      onError: (e) => toastError(e),
    });

  const statusCard = () => {
    if (sub.isLoading) return <Skeleton style={{ height: 96 }} />;
    if (sub.isError) return <ErrorState message={errorMessage(sub.error)} onRetry={() => sub.refetch()} />;
    if (!s || s.status === 'none') return null;
    const cfg = {
      active: { border: alpha(c.success, 0.3), bg: c.successSoft, tone: 'success', label: t('subActive') },
      expired: { border: alpha(c.warning, 0.3), bg: c.warningSoft, tone: 'warning', label: t('subExpired') },
      pending: { border: alpha(c.primary, 0.25), bg: c.primarySoft, tone: 'primary', label: t('subPending') },
    }[s.status];
    return (
      <Card style={{ padding: 16, borderColor: cfg.border, backgroundColor: cfg.bg }}>
        <Badge tone={cfg.tone}>{cfg.label}</Badge>
        <Txt w={700} size={18} style={{ marginTop: 8 }}>{t('currentPlan')}: {s.planName ?? s.planId}</Txt>
        {s.status === 'active' && s.endAt ? <Txt size={14} c="ink2">{s.startAt ? `${date(s.startAt)} → ` : ''}{date(s.endAt)} · {t('manualRenewal')}</Txt> : null}
        {s.status === 'expired' && s.endAt ? <Txt size={14} c="ink2">{t('expiredOn')} {date(s.endAt)}. {t('renewToContinue')}</Txt> : null}
        {s.status === 'pending' && <Txt size={14} c="ink2">{t('subPendingSub')}</Txt>}
      </Card>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <TopBar title={t('subscription')} />
      <ScrollView refreshControl={<PullRefresh />} contentContainerStyle={{ gap: 16, padding: 16 }}>
        {statusCard()}
        <View style={{ alignItems: 'center' }}>
          <Crown size={36} color={c.accent} style={{ marginBottom: 8 }} />
          <Txt w={800} size={20}>{active ? t('extendPlan') : t('choosePlan')}</Txt>
          <Txt size={14} c="ink2" style={{ textAlign: 'center' }}>{active ? t('extendNote') : t('subSeparate')}</Txt>
        </View>
        {plans.isLoading && <><Skeleton style={{ height: 160 }} /><Skeleton style={{ height: 160 }} /></>}
        {plans.isError && <ErrorState message={errorMessage(plans.error)} onRetry={() => plans.refetch()} />}
        {plans.isSuccess && list.length === 0 && <Txt size={14} c="ink2" style={{ paddingVertical: 24, textAlign: 'center' }}>{t('noPlans')}</Txt>}
        <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
          {list.map((p) => {
            const on2 = selected === p.id;
            return (
              <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: on2 }} onPress={() => setSel(p.id)}
                style={{ borderRadius: 18, borderWidth: 2, padding: 16, borderColor: on2 ? c.primary : c.line, backgroundColor: on2 ? c.primarySoft : c.surface }}>
                {p.badge ? <Badge tone="success" style={{ position: 'absolute', top: 16, right: 16 }}>{p.badge}</Badge> : null}
                <Txt w={600} size={14} c="ink2">{p.name}</Txt>
                <Txt w={800} size={30}>{inr(p.price)}<Txt w={500} size={16} c="ink2">{p.period === 'month' ? t('perMonth') : t('perYear')}</Txt></Txt>
                <View style={{ marginTop: 12, gap: 6 }}>
                  {p.features.map((f) => <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Check size={16} color={c.success} /><Txt size={14} style={{ flex: 1 }}>{f}</Txt></View>)}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Txt size={12} c="ink3" style={{ textAlign: 'center' }}>
          {t('inclTax')} <Txt size={12} c="primary" style={{ textDecorationLine: 'underline' }} onPress={() => router.push('/legal/refund')}>{t('refundPolicy')}</Txt>
        </Txt>

        <View style={{ paddingTop: 8 }}>
          <View style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Receipt size={18} color={c.primary} /><Txt w={700}>{t('paymentHistory')}</Txt></View>
          {payments.isLoading ? <Skeleton style={{ height: 64 }} /> : payments.isError ? (
            <ErrorState message={errorMessage(payments.error)} onRetry={() => payments.refetch()} />
          ) : payments.data?.length ? (
            <Card>
              <Divided>
                {payments.data.map((p) => (
                  <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt w={700} size={14}>{p.planName} · {inr(p.amount)}</Txt>
                      <Txt size={12} c="ink3" numberOfLines={1}>{date(p.paidAt ?? p.createdAt)} · #{p.id}</Txt>
                    </View>
                    <Badge tone={payTone[p.status] ?? 'neutral'}>{p.status}</Badge>
                  </View>
                ))}
              </Divided>
            </Card>
          ) : (
            <Txt size={14} c="ink2" style={{ borderRadius: 12, backgroundColor: c.surface2, padding: 16, textAlign: 'center', overflow: 'hidden' }}>{t('noPayments')}</Txt>
          )}
        </View>
      </ScrollView>
      <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: c.surface, padding: 12, paddingBottom: 12 + insets.bottom }}>
        <Button size="lg" block disabled={!plan} loading={checkout.isPending || verify.isPending} onPress={pay}>{t('payNow')} {plan ? inr(plan.price) : ''}</Button>
      </View>

      <RazorpayCheckout
        order={rzpOrder}
        color={c.primary}
        onSuccess={(b) => { setRzpOrder(null); verifyPay(b); }}
        onFailed={(msg) => { const o = rzpOrder; setRzpOrder(null); setResult({ ok: false, orderId: o.orderId, message: msg || t('paymentFailed') }); }}
        onDismiss={() => { setRzpOrder(null); toast(t('paymentCancelled'), 'info'); }}
        onError={() => { setRzpOrder(null); toast(t('gatewayLoadFailed'), 'error'); }}
      />

      {/* Dev/test gateway (backend without Razorpay keys). */}
      <Sheet open={!!testOrder} onClose={() => !verify.isPending && setTestOrder(null)} title={t('testPayment')}>
        {testOrder && (
          <>
            <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 12, backgroundColor: c.warningSoft, padding: 12 }}>
              <FlaskConical size={18} color={c.warning} style={{ marginTop: 2 }} /><Txt size={14} c="ink2" style={{ flex: 1 }}>{t('testPaymentNote')}</Txt>
            </View>
            <View style={{ marginBottom: 20, gap: 4 }}>
              {[[t('plan'), testOrder.planName], [t('amount'), inr(testOrder.amount)], [t('orderId'), testOrder.orderId]].map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Txt size={14} c="ink2">{k}</Txt><Txt w={700} size={14} numberOfLines={1} style={{ flexShrink: 1 }}>{v}</Txt></View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button variant="outline" grow disabled={verify.isPending} onPress={() => verifyPay({ orderId: testOrder.orderId, status: 'failed' })}>{t('payFail')}</Button>
              <Button grow loading={verify.isPending} onPress={() => verifyPay({ orderId: testOrder.orderId, status: 'success' })}>{t('paySuccess')}</Button>
            </View>
          </>
        )}
      </Sheet>

      <Sheet open={!!result} onClose={() => setResult(null)} title={result?.ok ? t('paymentSuccessful') : t('paymentFailed')}>
        {result && (
          <View style={{ paddingVertical: 8, alignItems: 'center' }}>
            <View style={{ marginBottom: 12, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: result.ok ? c.successSoft : c.dangerSoft }}>
              {result.ok ? <Check size={32} color={c.success} /> : <X size={32} color={c.danger} />}
            </View>
            {result.ok && result.sub ? (
              <>
                <Txt w={700} size={18} style={{ textAlign: 'center' }}>{result.sub.planName ?? plan?.name} · {t('subActive')}</Txt>
                {result.sub.endAt ? <Txt size={14} c="ink2" style={{ marginTop: 4 }}>{t('validTill')} {date(result.sub.endAt)}</Txt> : null}
              </>
            ) : (
              <>
                <Txt w={700} size={18}>{t('planNotActivated')}</Txt>
                {result.message ? <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}><CircleAlert size={14} color={c.ink2} /><Txt size={14} c="ink2">{result.message}</Txt></View> : null}
              </>
            )}
            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}><Clock size={12} color={c.ink3} /><Txt size={12} c="ink3">{t('receipt')}: {result.orderId}</Txt></View>
            <Button block style={{ marginTop: 20, alignSelf: 'stretch' }} onPress={() => setResult(null)}>{result.ok ? t('done') : t('close')}</Button>
          </View>
        )}
      </Sheet>
    </View>
  );
}
