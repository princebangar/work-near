// Native port of Frontend/src/features/help.tsx — help & FAQs, complaint form, legal pages.
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, FileText, Mail, MessageSquareWarning, Paperclip, Phone, X } from 'lucide-react-native';
import { Badge, Button, Card, Chip, Divided, EmptyState, ErrorState, Skeleton, Textarea, TopBar, Txt } from '@/components/ui';
import { PullRefresh } from '@/components/PullRefresh';
import { errorMessage, fieldErrors, isApiError, toastError, useCreateComplaint, useFaqs, useLegalPage, useMyComplaints } from '@/api';
import { useFeature, toast } from '@/store';
import { useSupport } from '@/hooks/useAppSettings';
import { useT } from '@/i18n';
import { date } from '@/lib/format';
import { pickFiles } from '@/lib/media';
import { alpha, useColors } from '@/theme';

const statusTone = { open: 'warning', in_progress: 'primary', resolved: 'success', escalated: 'danger' };
export const ComplaintStatusBadge = ({ s }) => <Badge tone={statusTone[s] ?? 'neutral'}>{s.replace('_', ' ')}</Badge>;

export function Help() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const complaintsOn = useFeature('complaints');
  const support = useSupport();
  const faqs = useFaqs();
  const complaints = useMyComplaints(complaintsOn);
  const [open, setOpen] = useState(null);
  const tile = [st.tile, { borderColor: alpha(c.line, 0.7), backgroundColor: c.surface }];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title={t('helpSupport')} />
      <ScrollView refreshControl={<PullRefresh />} contentContainerStyle={{ gap: 20, padding: 16, paddingBottom: 16 + insets.bottom }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {complaintsOn && (
            <Card onPress={() => router.push('/help/complaint')} style={{ flex: 1, padding: 16 }}>
              <MessageSquareWarning size={24} color={c.primary} style={{ marginBottom: 8 }} /><Txt w={700} size={14}>{t('raiseComplaint')}</Txt>
            </Card>
          )}
          {support.email ? (
            <Pressable onPress={() => Linking.openURL(`mailto:${support.email}`)} style={[tile, { flex: 1 }]}>
              <Mail size={24} color={c.primary} style={{ marginBottom: 8 }} /><Txt w={700} size={14}>{t('contactUs')}</Txt><Txt size={12} c="ink2" numberOfLines={1}>{support.email}</Txt>
            </Pressable>
          ) : null}
        </View>
        {support.phone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${support.phone.replace(/\s/g, '')}`)} style={[tile, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <Phone size={24} color={c.primary} /><Txt w={700} size={14} style={{ flex: 1 }}>{t('callSupport')}</Txt><Txt size={14} c="ink2">{support.phone}</Txt>
          </Pressable>
        ) : null}

        {complaintsOn && (
          <View>
            <Txt w={700} style={{ marginBottom: 8 }}>{t('myComplaints')}</Txt>
            {complaints.isLoading ? <Skeleton style={{ height: 80 }} /> : complaints.isError ? (
              <ErrorState message={errorMessage(complaints.error)} onRetry={() => complaints.refetch()} />
            ) : complaints.data?.length ? (
              <Card>
                <Divided>
                  {complaints.data.map((x) => (
                    <View key={x.id} style={{ padding: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Txt w={700} size={14} numberOfLines={1} style={{ flexShrink: 1 }}>#{x.id} · {x.category}</Txt><ComplaintStatusBadge s={x.status} />
                      </View>
                      <Txt size={14} c="ink2" numberOfLines={3} style={{ marginTop: 4 }}>{x.description}</Txt>
                      {x.resolution ? (
                        <Txt size={12} style={{ marginTop: 6, borderRadius: 8, backgroundColor: c.successSoft, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden' }}>
                          <Txt w={700} size={12} c="success">{t('resolution')}:</Txt> {x.resolution}
                        </Txt>
                      ) : null}
                      <Txt size={12} c="ink3" style={{ marginTop: 4 }}>{date(x.createdAt)}</Txt>
                    </View>
                  ))}
                </Divided>
              </Card>
            ) : (
              <Txt size={14} c="ink2" style={{ borderRadius: 12, backgroundColor: c.surface2, padding: 16, textAlign: 'center', overflow: 'hidden' }}>{t('noComplaints')}</Txt>
            )}
          </View>
        )}

        <View>
          <Txt w={700} style={{ marginBottom: 8 }}>{t('faqs')}</Txt>
          {faqs.isLoading ? <Skeleton style={{ height: 160 }} /> : faqs.isError ? (
            <ErrorState message={errorMessage(faqs.error)} onRetry={() => faqs.refetch()} />
          ) : (
            <Card>
              <Divided>
                {(faqs.data ?? []).map((f) => (
                  <Pressable key={f.id} onPress={() => setOpen(open === f.id ? null : f.id)} accessibilityState={{ expanded: open === f.id }} style={{ padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Txt w={700} size={14} style={{ flex: 1 }}>{f.q}</Txt>
                      <ChevronDown size={18} color={c.ink3} style={{ transform: [{ rotate: open === f.id ? '180deg' : '0deg' }] }} />
                    </View>
                    {open === f.id && <Txt size={14} c="ink2" style={{ marginTop: 8 }}>{f.a}</Txt>}
                  </Pressable>
                ))}
              </Divided>
            </Card>
          )}
        </View>
        {support.email ? <Txt size={12} c="ink3" style={{ textAlign: 'center' }}>{t('urgentNote')} {support.email}</Txt> : null}
      </ScrollView>
    </View>
  );
}

const CATS = ['Fake profile', 'Fraud', 'Abusive behaviour', 'Payment / subscription', 'App issue', 'Other'];
export function ComplaintForm() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const on = useFeature('complaints');
  const [category, setCat] = useState('');
  const [description, setDesc] = useState('');
  const [files, setFiles] = useState([]);
  const m = useCreateComplaint();
  if (!on) return <Redirect href="/help" />;
  const errs = fieldErrors(m.error);
  const len = description.trim().length;
  const submit = () =>
    m.mutate(
      { category, description: description.trim(), targetType: category === 'Fraud' ? 'fraud' : 'other', files },
      {
        onSuccess: (x) => { toast(`${t('complaintSubmitted')} #${x.id}`); router.back(); },
        onError: (e) => { if (!Object.keys(fieldErrors(e)).length || isApiError(e, 'FEATURE_DISABLED')) toastError(e); },
      },
    );
  const attach = async () => {
    const fs = await pickFiles({ multiple: true, allowPdf: true, max: 3 - files.length });
    if (fs.length) setFiles((p) => [...p, ...fs].slice(0, 3));
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title={t('raiseComplaint')} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, padding: 16 }}>
        <Txt w={500} size={14} c="ink2">{t('category')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{CATS.map((x) => <Chip key={x} active={category === x} onPress={() => setCat(x)}>{x}</Chip>)}</View>
        {errs.category && <Txt size={12} c="danger">{errs.category}</Txt>}
        <Textarea label={t('describeIssue')} value={description} maxLength={2000} rows={5} onChangeText={setDesc}
          error={errs.description} hint={`${len}/2000${len < 10 ? ` · ${t('min10')}` : ''}`} />
        <View>
          <Txt w={500} size={14} c="ink2" style={{ marginBottom: 8 }}>{t('evidence')} <Txt size={14} c="ink3">({t('optional')}, {files.length}/3)</Txt></Txt>
          <View style={{ gap: 8 }}>
            {files.map((f, i) => (
              <View key={`${f.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: c.surface2, paddingHorizontal: 12, paddingVertical: 8 }}>
                <FileText size={16} color={c.primary} /><Txt size={14} numberOfLines={1} style={{ flex: 1 }}>{f.name}</Txt>
                <Pressable accessibilityLabel={t('remove')} onPress={() => setFiles((p) => p.filter((_, j) => j !== i))} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}><X size={16} color={c.ink3} /></Pressable>
              </View>
            ))}
            {files.length < 3 && (
              <Pressable onPress={attach} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: c.line, paddingVertical: 16 }}>
                <Paperclip size={16} color={c.ink2} /><Txt size={14} c="ink2">{t('attachEvidence')}</Txt>
              </Pressable>
            )}
          </View>
          <Txt size={12} c="ink3" style={{ marginTop: 6 }}>{t('evidenceHint')}</Txt>
        </View>
      </ScrollView>
      <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: c.surface, padding: 12, paddingBottom: 12 + insets.bottom }}>
        <Button size="lg" block disabled={!category || len < 10} loading={m.isPending} onPress={submit}>{t('submit')}</Button>
      </View>
    </KeyboardAvoidingView>
  );
}

export function Legal() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { slug = 'terms' } = useLocalSearchParams();
  const { data, isLoading, error, refetch } = useLegalPage(slug);
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <TopBar title={data?.title ?? (isLoading ? '' : t('legal'))} />
      <ScrollView refreshControl={<PullRefresh />} contentContainerStyle={{ paddingBottom: 16 + insets.bottom }}>
        {isLoading && <View style={{ gap: 12, padding: 20 }}><Skeleton style={{ height: 16, width: 160 }} />{[0, 1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 64 }} />)}</View>}
        {error && (isApiError(error, 'NOT_FOUND') ? <EmptyState icon={FileText} title={t('pageNotFound')} /> : <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />)}
        {data && (
          <View style={{ gap: 12, padding: 20 }}>
            <Txt size={12} c="ink3">{t('lastUpdated')}: {date(data.updatedAt)}</Txt>
            {data.body.map((p, i) => <Txt key={i} size={15} c="ink2" style={{ lineHeight: 24 }}><Txt w={700} size={15}>{i + 1}.</Txt> {p}</Txt>)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  tile: { borderRadius: 18, borderWidth: 1, padding: 16 },
});
