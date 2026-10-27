// Native port of Frontend/src/components/shared.tsx.
import { memo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, X } from 'lucide-react-native';
import { Avatar, Badge, Button, Card, Chip, Rating, Sheet, Textarea, Txt, VerifiedBadge } from './ui';
import { km } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { toast } from '@/store';
import { isApiError, toastError, useReport, useSubmitReview } from '@/api';
import { useT } from '@/i18n';
import { useColors } from '@/theme';

// Worker result card: photo + name/category/rating/distance on top, skills flowing across the full width, then a
// footer with the price and whether the worker is taking jobs now. Neutral colours — green only for the live dot.
export const WorkerCard = memo(function WorkerCard({ w }) {
  const t = useT();
  const c = useColors();
  return (
    <Card onPress={() => router.push(`/worker/${w.id}`)} style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Avatar src={w.photo} name={w.name} size={60} radius={16} />
        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Txt w={700} size={16} numberOfLines={1} style={{ flexShrink: 1 }}>{w.name}</Txt>
            <VerifiedBadge type={w.verification} compact />
          </View>
          <Txt size={13} c="ink2" numberOfLines={1}>{w.categoryName}{w.experienceYrs > 0 ? ` · ${w.experienceYrs} ${t('years')}` : ''}</Txt>
          <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Rating value={w.rating} count={w.reviewCount} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 }}>
              <MapPin size={13} color={c.ink3} />
              <Txt size={13} c="ink2" numberOfLines={1} style={{ flexShrink: 1 }}>{km(w.distanceKm)}{w.locality ? ` · ${w.locality}` : ''}</Txt>
            </View>
          </View>
        </View>
      </View>
      {w.skills.length > 0 && (
        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {w.skills.slice(0, 4).map((s) => <Badge key={s}>{s}</Badge>)}
          {w.skills.length > 4 && <Badge>{`+${w.skills.length - 4}`}</Badge>}
        </View>
      )}
      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Txt w={700} size={14} numberOfLines={1} style={{ flexShrink: 1 }}>{w.priceRange}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: w.available ? c.success : c.ink3 }} />
          <Txt w={600} size={12} c="ink2">{w.available ? t('availableNow') : t('unavailable')}</Txt>
        </View>
      </View>
    </Card>
  );
});

const REASONS = ['Fake profile', 'Fraud / scam', 'Abusive behaviour', 'Spam', 'Inappropriate content', 'Other'];
export function ReportSheet({ open, onClose, targetType, targetId }) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const m = useReport();
  const close = () => { setReason(''); setDetails(''); onClose(); };
  const submit = () =>
    m.mutate(
      { targetType, targetId, reason, details: details.trim() || undefined },
      {
        onSuccess: (r) => { toast(`${t('reportSubmitted')} (#${r.id})`); close(); },
        onError: (e) => { toastError(e); if (isApiError(e, 'FEATURE_DISABLED')) close(); },
      },
    );
  return (
    <Sheet open={open} onClose={close} title={t('report')}>
      <Txt size={14} c="ink2" style={{ marginBottom: 12 }}>{t('reportWhy')}</Txt>
      <View style={{ marginBottom: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {REASONS.map((r) => <Chip key={r} active={reason === r} onPress={() => setReason(r)}>{r}</Chip>)}
      </View>
      <Textarea placeholder={t('addDetails')} value={details} maxLength={1000} onChangeText={setDetails} />
      <Button block style={{ marginTop: 16 }} disabled={!reason} loading={m.isPending} onPress={submit}>{t('submitReport')}</Button>
    </Sheet>
  );
}

export function ReviewSheet({ open, onClose, workerId, workerName }) {
  const t = useT();
  const c = useColors();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const m = useSubmitReview();
  const close = () => { setStars(0); setText(''); onClose(); };
  return (
    <Sheet open={open} onClose={close} title={t('rateExperience')}>
      {workerName ? <Txt size={14} c="ink2" style={{ marginTop: -4, marginBottom: 12 }}>{workerName}</Txt> : null}
      <View accessibilityRole="radiogroup" style={{ marginBottom: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Pressable key={s} accessibilityRole="radio" accessibilityState={{ checked: stars === s }} accessibilityLabel={`${s} stars`} onPress={() => setStars(s)}>
            <Txt size={36} c={s <= stars ? c.accent : c.line}>★</Txt>
          </Pressable>
        ))}
      </View>
      <Textarea placeholder={t('reviewPlaceholder')} value={text} maxLength={1000} onChangeText={setText} />
      <Txt size={12} c="ink3" style={{ marginTop: 8 }}>{t('reviewRule')}</Txt>
      <Button
        block style={{ marginTop: 16 }} disabled={!stars} loading={m.isPending}
        onPress={() => m.mutate({ workerId, stars, text: text.trim() }, {
          onSuccess: () => { toast(t('reviewThanks')); close(); },
          onError: (e) => { toastError(e); if (isApiError(e, 'DUPLICATE_REVIEW') || isApiError(e, 'REVIEW_NOT_ALLOWED') || isApiError(e, 'FEATURE_DISABLED')) close(); },
        })}
      >
        {t('submit')}
      </Button>
    </Sheet>
  );
}

/** Full-screen photo viewer (portfolio / chat images). */
export function ImageViewer({ src, onClose }) {
  const insets = useSafeAreaInsets();
  if (!src) return null;
  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', padding: 16, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={{ uri: mediaUrl(src) }} style={StyleSheet.absoluteFill} contentFit="contain" />
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ position: 'absolute', top: insets.top + 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
          <X size={22} color="#fff" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
