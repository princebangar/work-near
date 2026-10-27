// Native port of Frontend/src/features/chat.tsx — conversation list + thread.
import { useEffect, useMemo, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertCircle, Ban, BellOff, Check, CheckCheck, Clock, Flag, ImagePlus, MessageCircle, MoreVertical, Search, SendHorizontal, ShieldAlert, Star, UserRound, X,
} from 'lucide-react-native';
import { Avatar, Badge, Button, EmptyState, ErrorState, IconButton, Sheet, Skeleton, TopBar, Txt } from '@/components/ui';
import { PullRefresh } from '@/components/PullRefresh';
import { ImageViewer, ReportSheet, ReviewSheet, usePhotoSource } from '@/components/shared';
import { TAB_BAR_SPACE, useTabScroll } from '@/components/TabBar';
import {
  activeThread, errorMessage, isApiError, useConversations, useLoadOlder, useMarkConversationRead, useSendImage, useSendMessage, useThread, useUpdateConversation,
} from '@/api';
import { useT } from '@/i18n';
import { clock, timeAgo } from '@/lib/format';
import { mediaUrl, pickFiles } from '@/lib/media';
import { useAuth, useFeature, toast } from '@/store';
import { fonts, useColors } from '@/theme';

export function ChatList() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const onScroll = useTabScroll();
  const roles = useAuth((s) => s.user?.roles);
  const { data, isLoading, isError, error, refetch } = useConversations();
  const [q, setQ] = useState('');
  const dual = (roles?.length ?? 0) > 1;
  const needle = q.trim().toLowerCase();
  const list = data?.filter((x) => !needle || x.peer.name.toLowerCase().includes(needle) || x.lastMessage.toLowerCase().includes(needle));
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <TopBar back={false} title={t('chats')} />
      <FlatList refreshControl={<PullRefresh />}
        data={list ?? []}
        keyExtractor={(x) => x.id}
        onScroll={onScroll}
        scrollEventThrottle={32}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + insets.bottom }}
        ListHeaderComponent={
          <>
            {(data?.length ?? 0) > 0 && (
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <View style={[st.search, { backgroundColor: c.surface2 }]}>
                  <Search size={18} color={c.ink3} />
                  <TextInput value={q} onChangeText={setQ} placeholder={t('searchChats')} accessibilityLabel={t('searchChats')} placeholderTextColor={c.ink3} selectionColor={c.primary}
                    style={{ flex: 1, height: '100%', color: c.ink, fontFamily: fonts[400], fontSize: 15, padding: 0 }} />
                  {q ? <Pressable accessibilityLabel="Clear" onPress={() => setQ('')} hitSlop={8}><X size={16} color={c.ink3} /></Pressable> : null}
                </View>
              </View>
            )}
            {isLoading && <View style={{ gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} style={{ height: 64 }} />)}</View>}
            {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
            {data?.length === 0 && <EmptyState icon={MessageCircle} title={t('noChats')} sub={t('noChatsSub')} action={<Button onPress={() => router.navigate('/search')}>{t('search')}</Button>} />}
            {data && data.length > 0 && list?.length === 0 && <Txt size={14} c="ink2" style={{ paddingHorizontal: 16, paddingVertical: 40, textAlign: 'center' }}>{t('noMatches')}</Txt>}
          </>
        }
        renderItem={({ item: x }) => (
          <Pressable onPress={() => router.push(`/chats/${x.id}`)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12 }, pressed && { backgroundColor: c.surface2 }]}>
            <Avatar src={x.peer.photo} name={x.peer.name} size={52} />
            <View style={{ flex: 1, minWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line, paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt w={700} numberOfLines={1} style={{ flex: 1 }}>{x.peer.name}</Txt>
                <Txt w={x.unread && !x.muted ? 600 : 400} size={12} c={x.unread && !x.muted ? 'primary' : 'ink3'}>{timeAgo(x.lastMessageAt)}</Txt>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt w={x.unread ? 500 : 400} size={14} c={x.unread ? 'ink' : 'ink2'} numberOfLines={1} style={{ flex: 1 }}>
                  {x.blocked ? t('youBlocked') : x.blockedBy ? t('unavailable') : x.lastMessage || (x.myRole === 'worker' ? t('newEnquiry') : x.peer.subtitle)}
                </Txt>
                {dual && <Badge>{x.myRole === 'worker' ? t('asWorker') : t('asCustomer')}</Badge>}
                {x.muted && <BellOff size={14} color={c.ink3} />}
                {x.unread > 0 && (
                  <View style={[st.count, { backgroundColor: x.muted ? c.surface3 : c.primary }]}><Txt w={700} size={11} c={x.muted ? 'ink2' : 'onPrimary'}>{x.unread}</Txt></View>
                )}
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};

function Bubble({ m, mine, onImage, onRetry }) {
  const t = useT();
  const c = useColors();
  const meta = mine ? 'rgba(255,255,255,0.75)' : c.ink3;
  return (
    <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <View style={[st.bubble, mine ? { borderBottomRightRadius: 6, backgroundColor: c.primary } : { borderBottomLeftRadius: 6, backgroundColor: c.surface }, m.status === 'failed' && { opacity: 0.7 }]}>
        {m.type === 'image' && m.image ? (
          <Pressable onPress={() => onImage(m.image)} accessibilityLabel={t('viewPhoto')}>
            <Image source={{ uri: mediaUrl(m.image) }} style={{ width: 240, height: 240, maxWidth: '100%', backgroundColor: c.surface2, opacity: m.status === 'sending' ? 0.6 : 1 }} contentFit="cover" cachePolicy="memory-disk" />
          </Pressable>
        ) : null}
        <View style={m.type === 'image' && !m.text ? { paddingHorizontal: 10, paddingBottom: 6 } : { paddingHorizontal: 14, paddingVertical: 8 }}>
          {m.text ? <Txt size={15} c={mine ? 'onPrimary' : 'ink'}>{m.text}</Txt> : null}
          <View style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            <Txt size={10} c={meta}>{clock(m.sentAt)}</Txt>
            {mine && (m.status === 'read' ? <CheckCheck size={13} color={meta} /> : m.status === 'sent' ? <Check size={13} color={meta} /> : m.status === 'sending' ? <Clock size={11} color={meta} /> : null)}
          </View>
        </View>
        {m.status === 'failed' && (
          <Pressable onPress={onRetry} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 12, paddingVertical: 4 }}>
            <AlertCircle size={12} color={mine ? '#fff' : c.ink} /><Txt w={600} size={11} c={mine ? 'onPrimary' : 'ink'}>{t('notSentRetry')}</Txt>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ImageComposer({ file, onClose, onSend }) {
  const t = useT();
  const c = useColors();
  const [caption, setCaption] = useState('');
  return (
    <Sheet open={!!file} onClose={() => { setCaption(''); onClose(); }} title={t('sendPhoto')}>
      {file && <Image source={{ uri: file.uri }} style={{ marginBottom: 12, height: 320, width: '100%', borderRadius: 12, backgroundColor: c.surface2 }} contentFit="contain" />}
      <TextInput value={caption} maxLength={500} onChangeText={setCaption} placeholder={t('addCaption')} placeholderTextColor={c.ink3} selectionColor={c.primary}
        style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 14, color: c.ink, fontFamily: fonts[400], fontSize: 15 }} />
      <Button block size="lg" icon={SendHorizontal} style={{ marginTop: 12 }} onPress={() => { onSend(caption.trim()); setCaption(''); }}>{t('send')}</Button>
    </Sheet>
  );
}

export function ChatThread() {
  const t = useT();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id = '' } = useLocalSearchParams();
  const me = useAuth((s) => s.user?.id);
  const chatOn = useFeature('chat');
  const attachOn = useFeature('chatAttachments');
  const reportsOn = useFeature('reports');
  const reviewsOn = useFeature('reviews');
  const convs = useConversations();
  const conv = convs.data?.find((x) => x.id === id);
  const thread = useThread(id);
  const older = useLoadOlder(id);
  const send = useSendMessage(id);
  const sendImage = useSendImage(id);
  const markRead = useMarkConversationRead();
  const update = useUpdateConversation();
  const [text, setText] = useState('');
  const [sheet, setSheet] = useState(null);
  const [img, setImg] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [visible, setVisible] = useState(AppState.currentState === 'active');
  const { choose, sheet: sourceSheet } = usePhotoSource();
  const msgs = thread.data?.items;

  // Tell realtime handlers which thread is on screen.
  useEffect(() => {
    activeThread.id = id;
    return () => { if (activeThread.id === id) activeThread.id = null; };
  }, [id]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setVisible(s === 'active'));
    return () => sub.remove();
  }, []);
  // A peer message arrived while this thread is open (or it had unread on open) → mark read once.
  useEffect(() => {
    if (conv && conv.unread > 0 && visible && thread.isSuccess && !thread.isFetching) markRead.mutate(id);
  }, [conv?.unread, visible, thread.isSuccess, thread.isFetching, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Newest at the bottom: inverted list fed newest-first, with day separators.
  const rows = useMemo(() => {
    const out = [];
    let lastDay = '';
    for (const m of msgs ?? []) {
      const day = dayLabel(m.sentAt);
      if (day !== lastDay) out.push({ key: `day-${day}-${m.id}`, day });
      lastDay = day;
      out.push({ key: m.id, m });
    }
    return out.reverse();
  }, [msgs]);

  const loadOlder = () => {
    const cursor = thread.data?.nextCursor;
    if (!cursor || older.isPending) return;
    older.mutate(cursor);
  };
  const submit = () => {
    const v = text.trim();
    if (!v || !chatOn) return;
    send.mutate({ text: v, tmpId: `tmp-${Date.now()}` });
    setText('');
  };
  const retry = (m) => send.mutate({ text: m.text, tmpId: m.id });
  const pickPhoto = async () => {
    const source = await choose();
    if (!source) return;
    const [f] = await pickFiles({ source });
    if (f) setImg(f);
  };
  const sendPhoto = (caption) => {
    if (!img) return;
    sendImage.mutate({ file: img, text: caption, tmpId: `tmp-${Date.now()}` });
    setImg(null);
  };

  const notFound = isApiError(thread.error, 'NOT_FOUND') || (convs.isSuccess && !conv && thread.isError);
  if (notFound) {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface }}>
        <TopBar title={t('chats')} />
        <EmptyState icon={MessageCircle} title={t('chatNotFound')} action={<Button onPress={() => router.replace('/chats')}>{t('chats')}</Button>} />
      </View>
    );
  }

  const disabledReason = !conv ? null : conv.blocked ? 'blocked' : conv.blockedBy ? 'blockedBy' : !chatOn ? 'off' : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TopBar
        title={conv ? (
          <Pressable onPress={() => conv.peer.role === 'worker' && router.push(`/worker/${conv.peer.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Avatar src={conv.peer.photo} name={conv.peer.name} size={36} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt w={700} size={15} numberOfLines={1}>{conv.peer.name}</Txt>
              <Txt size={12} c="ink2" numberOfLines={1}>{conv.peer.subtitle}</Txt>
            </View>
          </Pressable>
        ) : <Skeleton style={{ height: 32, width: 160 }} />}
        right={conv && <IconButton label={t('more')} onPress={() => setSheet('menu')}><MoreVertical size={20} color={c.ink} /></IconButton>}
      />
      <FlatList
        inverted
        data={rows}
        keyExtractor={(r) => r.key}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 16, gap: 8 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) =>
          item.day ? (
            <View style={{ marginVertical: 12, alignItems: 'center' }}>
              <View style={{ borderRadius: 999, backgroundColor: c.surface2, paddingHorizontal: 12, paddingVertical: 4 }}><Txt w={600} size={11} c="ink2">{item.day}</Txt></View>
            </View>
          ) : (
            <Bubble m={item.m} mine={item.m.senderId === me} onImage={setViewing} onRetry={() => retry(item.m)} />
          )
        }
        // inverted: header renders at the bottom, footer at the top
        ListHeaderComponent={
          conv?.canReview && reviewsOn ? (
            <View style={[st.reviewCard, { borderColor: c.line, backgroundColor: c.surface }]}>
              <Star size={24} color={c.accent} fill={c.accent} style={{ marginBottom: 6 }} />
              <Txt w={700} style={{ textAlign: 'center' }}>{t('howWasIt').replace('{name}', conv.peer.name)}</Txt>
              <Txt size={12} c="ink2" style={{ marginTop: 2, textAlign: 'center' }}>{t('reviewHelps')}</Txt>
              <Button size="sm" style={{ marginTop: 12 }} onPress={() => setSheet('review')}>{t('writeReview')}</Button>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={{ gap: 8 }}>
            {thread.data?.nextCursor ? (
              <View style={{ alignItems: 'center' }}><Button size="sm" variant="outline" loading={older.isPending} onPress={loadOlder}>{t('loadOlder')}</Button></View>
            ) : (
              <View style={[st.safety, { backgroundColor: c.warningSoft }]}>
                <ShieldAlert size={16} color={c.warning} />
                <Txt size={12} c="ink2" style={{ flex: 1 }}>{t('safetyTip')}</Txt>
              </View>
            )}
            {thread.isLoading && (
              <View style={{ gap: 8 }}>
                <Skeleton style={{ alignSelf: 'flex-end', height: 40, width: '66%' }} /><Skeleton style={{ height: 40, width: '50%' }} /><Skeleton style={{ alignSelf: 'flex-end', height: 40, width: '50%' }} />
              </View>
            )}
            {thread.isError && !thread.data && <ErrorState message={errorMessage(thread.error)} onRetry={() => thread.refetch()} />}
            {msgs?.length === 0 && <Txt size={14} c="ink3" style={{ paddingVertical: 24, textAlign: 'center' }}>{conv?.myRole === 'customer' ? t('sayHelloCustomer') : t('sayHelloWorker')}</Txt>}
          </View>
        }
      />

      {disabledReason ? (
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: c.surface, padding: 16, paddingBottom: 16 + insets.bottom, alignItems: 'center' }}>
          {disabledReason === 'blocked' && (
            <Txt size={14} c="ink2" style={{ textAlign: 'center' }}>
              {t('youBlockedUser')}{' '}
              <Txt w={600} size={14} c="primary" onPress={() => !update.isPending && update.mutate({ id, blocked: false }, { onSuccess: () => toast(t('unblocked')) })}>{t('unblock')}</Txt>
            </Txt>
          )}
          {disabledReason === 'blockedBy' && <Txt size={14} c="ink2">{t('cantReply')}</Txt>}
          {disabledReason === 'off' && <Txt size={14} c="ink2">{t('chatOff')}</Txt>}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: c.surface, padding: 10, paddingBottom: 10 + Math.max(insets.bottom, 6) }}>
          {attachOn && chatOn && (
            <Pressable accessibilityLabel={t('sendPhoto')} onPress={pickPhoto} disabled={!conv} style={[st.round, { opacity: conv ? 1 : 0.4 }]}><ImagePlus size={22} color={c.ink2} /></Pressable>
          )}
          <TextInput
            multiline value={text} maxLength={2000} placeholder={t('typeMessage')} accessibilityLabel={t('typeMessage')} onChangeText={setText}
            placeholderTextColor={c.ink3} selectionColor={c.primary}
            style={{ flex: 1, minHeight: 44, maxHeight: 112, borderRadius: 16, backgroundColor: c.surface2, paddingHorizontal: 16, paddingVertical: 10, color: c.ink, fontFamily: fonts[400], fontSize: 15 }}
          />
          <Pressable accessibilityLabel={t('send')} onPress={submit} disabled={!text.trim() || !conv} style={[st.round, { backgroundColor: c.primary, opacity: !text.trim() || !conv ? 0.4 : 1 }]}>
            <SendHorizontal size={20} color={c.onPrimary} />
          </Pressable>
        </View>
      )}

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={t('chatOptions')}>
        {conv && (
          <>
            {conv.peer.role === 'worker' && (
              <Pressable onPress={() => { setSheet(null); router.push(`/worker/${conv.peer.id}`); }} style={st.menuRow}><UserRound size={20} color={c.ink} /><Txt w={500}>{t('viewProfile')}</Txt></Pressable>
            )}
            <Pressable disabled={update.isPending} onPress={() => update.mutate({ id, muted: !conv.muted }, { onSuccess: (r) => { setSheet(null); toast(r.muted ? t('muted') : t('unmuted')); } })} style={st.menuRow}>
              <BellOff size={20} color={c.ink} /><Txt w={500} style={{ flex: 1 }}>{conv.muted ? t('unmute') : t('mute')}</Txt><Badge>{conv.muted ? t('on') : t('off')}</Badge>
            </Pressable>
            <Pressable disabled={update.isPending} onPress={() => update.mutate({ id, blocked: !conv.blocked }, { onSuccess: (r) => { setSheet(null); toast(r.blocked ? t('blocked') : t('unblocked')); } })} style={st.menuRow}>
              <Ban size={20} color={c.ink} /><Txt w={500}>{conv.blocked ? t('unblock') : t('block')}</Txt>
            </Pressable>
            {reportsOn && <Pressable onPress={() => setSheet('report')} style={st.menuRow}><Flag size={20} color={c.danger} /><Txt w={500} c="danger">{t('report')}</Txt></Pressable>}
          </>
        )}
      </Sheet>
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} targetType="message" targetId={id} />
      {conv && <ReviewSheet open={sheet === 'review'} onClose={() => setSheet(null)} workerId={conv.peer.id} workerName={conv.peer.name} />}
      <ImageComposer file={img} onClose={() => setImg(null)} onSend={sendPhoto} />
      <ImageViewer src={viewing} onClose={() => setViewing(null)} />
      {sourceSheet}
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  search: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12 },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '78%', overflow: 'hidden', borderRadius: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  reviewCard: { marginTop: 16, alignSelf: 'center', maxWidth: 320, alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 16 },
  safety: { alignSelf: 'center', maxWidth: 320, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 12 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
});
