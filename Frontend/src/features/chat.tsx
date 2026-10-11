import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  AlertCircle, Ban, BellOff, Check, CheckCheck, Clock, Flag, ImagePlus, MessageCircle, MoreVertical, Search, SendHorizontal, ShieldAlert, Star, UserRound, X,
} from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, ErrorState, Sheet, Skeleton, TopBar } from '@/components/ui';
import { FilePicker, ImageViewer, ReportSheet, ReviewSheet } from '@/components/shared';
import {
  activeThread, errorMessage, isApiError, useConversations, useLoadOlder, useMarkConversationRead, useSendImage, useSendMessage, useThread, useUpdateConversation,
} from '@/api';
import { useObjectUrl } from '@/hooks/useAppSettings';
import { useT } from '@/i18n';
import { clock, cn, timeAgo } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { useAuth, useFeature, toast } from '@/store';
import type { Conversation, Message } from '@/types';

export function ChatList() {
  const t = useT();
  const nav = useNavigate();
  const roles = useAuth((s) => s.user?.roles);
  const { data, isLoading, isError, error, refetch } = useConversations();
  const [q, setQ] = useState('');
  const dual = (roles?.length ?? 0) > 1;
  const needle = q.trim().toLowerCase();
  const list = data?.filter((c) => !needle || c.peer.name.toLowerCase().includes(needle) || c.lastMessage.toLowerCase().includes(needle));
  return (
    <div className="min-h-full bg-surface">
      <TopBar back={false} title={t('chats')} />
      {(data?.length ?? 0) > 0 && (
        <div className="px-4 py-3">
          <label className="flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-3">
            <Search size={18} className="text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchChats')} aria-label={t('searchChats')} className="w-full bg-transparent text-ink outline-none placeholder:text-ink-3" />
            {q && <button aria-label="Clear" onClick={() => setQ('')}><X size={16} className="text-ink-3" /></button>}
          </label>
        </div>
      )}
      {isLoading && <div className="space-y-2 px-4 pt-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>}
      {isError && <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      {data?.length === 0 && <EmptyState icon={<MessageCircle size={32} />} title={t('noChats')} sub={t('noChatsSub')} action={<Button onClick={() => nav('/search')}>{t('search')}</Button>} />}
      {data && data.length > 0 && list?.length === 0 && <p className="px-4 py-10 text-center text-sm text-ink-2">{t('noMatches')}</p>}
      <ul>
        {list?.map((c) => (
          <li key={c.id}>
            <button onClick={() => nav(`/chats/${c.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
              <Avatar src={c.peer.photo} name={c.peer.name} size={52} />
              <span className="min-w-0 flex-1 border-b border-line pb-3">
                <span className="flex items-center gap-2">
                  <b className="min-w-0 flex-1 truncate">{c.peer.name}</b>
                  <span className={cn('shrink-0 text-xs', c.unread && !c.muted ? 'font-semibold text-primary' : 'text-ink-3')}>{timeAgo(c.lastMessageAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={cn('min-w-0 flex-1 truncate text-sm', c.unread ? 'font-medium text-ink' : 'text-ink-2')}>
                    {c.blocked ? t('youBlocked') : c.blockedBy ? t('unavailable') : c.lastMessage || (c.myRole === 'worker' ? t('newEnquiry') : c.peer.subtitle)}
                  </span>
                  {dual && <Badge className="shrink-0">{c.myRole === 'worker' ? t('asWorker') : t('asCustomer')}</Badge>}
                  {c.muted && <BellOff size={14} className="shrink-0 text-ink-3" aria-label={t('mute')} />}
                  {c.unread > 0 && (
                    <span className={cn('grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-bold', c.muted ? 'bg-surface-3 text-ink-2' : 'bg-primary text-on-primary')}>{c.unread}</span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};

function Bubble({ m, mine, onImage, onRetry }: { m: Message; mine: boolean; onImage: (src: string) => void; onRetry: () => void }) {
  const t = useT();
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[78%] overflow-hidden rounded-2xl text-[15px] shadow-sm', mine ? 'rounded-br-md bg-primary text-on-primary' : 'rounded-bl-md bg-surface text-ink', m.status === 'failed' && 'opacity-70')}>
        {m.type === 'image' && m.image && (
          <button onClick={() => onImage(m.image!)} className="block" aria-label={t('viewPhoto')}>
            <img src={mediaUrl(m.image)} alt="" loading="lazy" className={cn('max-h-72 w-full min-w-40 bg-surface-2 object-cover', m.status === 'sending' && 'opacity-60')} />
          </button>
        )}
        <div className={cn(m.type === 'image' && !m.text ? 'px-2.5 pb-1.5' : 'px-3.5 py-2')}>
          {m.text && <p className="break-words whitespace-pre-wrap">{m.text}</p>}
          <span className={cn('mt-0.5 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-white/75' : 'text-ink-3')}>
            {clock(m.sentAt)}
            {mine && (m.status === 'read' ? <CheckCheck size={13} aria-label={t('read')} /> : m.status === 'sent' ? <Check size={13} aria-label={t('sent')} /> : m.status === 'sending' ? <Clock size={11} /> : null)}
          </span>
        </div>
        {m.status === 'failed' && (
          <button onClick={onRetry} className="flex w-full items-center justify-end gap-1 bg-black/15 px-3 py-1 text-[11px] font-semibold">
            <AlertCircle size={12} />{t('notSentRetry')}
          </button>
        )}
      </div>
    </div>
  );
}

function ImageComposer({ file, onClose, onSend }: { file: File | null; onClose: () => void; onSend: (caption: string) => void }) {
  const t = useT();
  const url = useObjectUrl(file);
  const [caption, setCaption] = useState('');
  return (
    <Sheet open={!!file} onClose={() => { setCaption(''); onClose(); }} title={t('sendPhoto')}>
      {url && <img src={url} alt="" className="mb-3 max-h-80 w-full rounded-xl bg-surface-2 object-contain" />}
      <input value={caption} maxLength={500} onChange={(e) => setCaption(e.target.value)} placeholder={t('addCaption')}
        className="h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-ink outline-none placeholder:text-ink-3 focus:border-primary" />
      <Button block size="lg" className="mt-3" onClick={() => { onSend(caption.trim()); setCaption(''); }}><SendHorizontal size={18} />{t('send')}</Button>
    </Sheet>
  );
}

export function ChatThread() {
  const t = useT();
  const { id = '' } = useParams();
  const nav = useNavigate();
  const me = useAuth((s) => s.user?.id);
  const chatOn = useFeature('chat');
  const attachOn = useFeature('chatAttachments');
  const reportsOn = useFeature('reports');
  const reviewsOn = useFeature('reviews');
  const convs = useConversations();
  const c: Conversation | undefined = convs.data?.find((x) => x.id === id);
  const thread = useThread(id);
  const older = useLoadOlder(id);
  const send = useSendMessage(id);
  const sendImage = useSendImage(id);
  const markRead = useMarkConversationRead();
  const update = useUpdateConversation();
  const [text, setText] = useState('');
  const [sheet, setSheet] = useState<'menu' | 'report' | 'review' | null>(null);
  const [img, setImg] = useState<File | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const prevHeight = useRef<number | null>(null);
  const msgs = thread.data?.items;

  // Tell realtime handlers which thread is on screen.
  useEffect(() => {
    activeThread.id = id;
    return () => { if (activeThread.id === id) activeThread.id = null; };
  }, [id]);
  useEffect(() => {
    const h = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  // A peer message arrived while this thread is open (or it had unread on open) → mark read once.
  useEffect(() => {
    if (c && c.unread > 0 && visible && thread.isSuccess && !thread.isFetching) markRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.unread, visible, thread.isSuccess, thread.isFetching, id]);

  // Scroll: stick to bottom for new messages; keep position when older ones are prepended.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [msgs]);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  const loadOlder = () => {
    const cursor = thread.data?.nextCursor;
    if (!cursor || older.isPending) return;
    prevHeight.current = scroller.current?.scrollHeight ?? null;
    older.mutate(cursor, { onError: () => (prevHeight.current = null) });
  };

  const submit = () => {
    const v = text.trim();
    if (!v || !chatOn) return;
    atBottom.current = true;
    send.mutate({ text: v, tmpId: `tmp-${Date.now()}` });
    setText('');
  };
  const retry = (m: Message) => send.mutate({ text: m.text, tmpId: m.id });
  const sendPhoto = (caption: string) => {
    if (!img) return;
    atBottom.current = true;
    sendImage.mutate({ file: img, text: caption, tmpId: `tmp-${Date.now()}`, preview: URL.createObjectURL(img) });
    setImg(null);
  };

  const notFound = isApiError(thread.error, 'NOT_FOUND') || (convs.isSuccess && !c && thread.isError);
  if (notFound) {
    return (
      <div className="min-h-dvh bg-surface">
        <TopBar title={t('chats')} />
        <EmptyState icon={<MessageCircle size={32} />} title={t('chatNotFound')} action={<Button onClick={() => nav('/chats', { replace: true })}>{t('chats')}</Button>} />
      </div>
    );
  }

  const disabledReason = !c ? null : c.blocked ? 'blocked' : c.blockedBy ? 'blockedBy' : !chatOn ? 'off' : null;
  let lastDay = '';

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <TopBar
        title={c ? (
          <button onClick={() => c.peer.role === 'worker' && nav(`/worker/${c.peer.id}`)} className="flex min-w-0 items-center gap-2.5 text-left">
            <Avatar src={c.peer.photo} name={c.peer.name} size={36} />
            <span className="min-w-0"><span className="block truncate text-[15px] leading-tight">{c.peer.name}</span><span className="block truncate text-xs font-normal text-ink-2">{c.peer.subtitle}</span></span>
          </button>
        ) : <Skeleton className="h-8 w-40" />}
        right={c && <button aria-label={t('more')} onClick={() => setSheet('menu')} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><MoreVertical size={20} /></button>}
      />
      <div ref={scroller} onScroll={onScroll} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {thread.data?.nextCursor && (
          <div className="flex justify-center">
            <Button size="sm" variant="outline" loading={older.isPending} onClick={loadOlder}>{t('loadOlder')}</Button>
          </div>
        )}
        {!thread.data?.nextCursor && (
          <div className="mx-auto mb-3 flex max-w-xs items-start gap-2 rounded-xl bg-warning-soft p-3 text-xs text-ink-2">
            <ShieldAlert size={16} className="shrink-0 text-warning" />
            {t('safetyTip')}
          </div>
        )}
        {thread.isLoading && <div className="space-y-2"><Skeleton className="ml-auto h-10 w-2/3" /><Skeleton className="h-10 w-1/2" /><Skeleton className="ml-auto h-10 w-1/2" /></div>}
        {thread.isError && !thread.data && <ErrorState message={errorMessage(thread.error)} onRetry={() => thread.refetch()} />}
        {msgs?.length === 0 && <p className="py-6 text-center text-sm text-ink-3">{c?.myRole === 'customer' ? t('sayHelloCustomer') : t('sayHelloWorker')}</p>}
        {msgs?.map((m) => {
          const day = dayLabel(m.sentAt);
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {sep && <div className="my-3 flex justify-center"><span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-semibold text-ink-2">{day}</span></div>}
              <Bubble m={m} mine={m.senderId === me} onImage={setViewing} onRetry={() => retry(m)} />
            </div>
          );
        })}
        {c?.canReview && reviewsOn && (
          <div className="mx-auto mt-4 max-w-xs rounded-2xl border border-line bg-surface p-4 text-center">
            <Star className="mx-auto mb-1.5 fill-accent text-accent" />
            <b className="block text-[15px]">{t('howWasIt').replace('{name}', c.peer.name)}</b>
            <p className="mt-0.5 text-xs text-ink-2">{t('reviewHelps')}</p>
            <Button size="sm" className="mt-3" onClick={() => setSheet('review')}>{t('writeReview')}</Button>
          </div>
        )}
      </div>

      {disabledReason ? (
        <div className="pb-safe border-t border-line bg-surface p-4 text-center text-sm text-ink-2">
          {disabledReason === 'blocked' && <>{t('youBlockedUser')} <button className="font-semibold text-primary" disabled={update.isPending} onClick={() => update.mutate({ id, blocked: false }, { onSuccess: () => toast(t('unblocked')) })}>{t('unblock')}</button></>}
          {disabledReason === 'blockedBy' && t('cantReply')}
          {disabledReason === 'off' && t('chatOff')}
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="pb-safe flex items-end gap-2 border-t border-line bg-surface p-2.5">
          {attachOn && chatOn && (
            <FilePicker onFiles={([f]) => setImg(f)}>
              {(open) => (
                <button type="button" aria-label={t('sendPhoto')} onClick={open} disabled={!c} className="grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2 disabled:opacity-40">
                  <ImagePlus size={22} />
                </button>
              )}
            </FilePicker>
          )}
          <textarea
            rows={1} value={text} maxLength={2000} placeholder={t('typeMessage')} aria-label={t('typeMessage')} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl bg-surface-2 px-4 py-2.5 text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
          <button type="submit" aria-label={t('send')} disabled={!text.trim() || !c} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary disabled:opacity-40">
            <SendHorizontal size={20} />
          </button>
        </form>
      )}

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={t('chatOptions')}>
        {c && <>
          {c.peer.role === 'worker' && (
            <button onClick={() => nav(`/worker/${c.peer.id}`)} className="flex w-full items-center gap-3 py-3.5 font-medium"><UserRound size={20} />{t('viewProfile')}</button>
          )}
          <button disabled={update.isPending} onClick={() => update.mutate({ id, muted: !c.muted }, { onSuccess: (r) => { setSheet(null); toast(r.muted ? t('muted') : t('unmuted')); } })}
            className="flex w-full items-center gap-3 py-3.5 font-medium"><BellOff size={20} />{c.muted ? t('unmute') : t('mute')}<Badge className="ml-auto">{c.muted ? t('on') : t('off')}</Badge></button>
          <button disabled={update.isPending} onClick={() => update.mutate({ id, blocked: !c.blocked }, { onSuccess: (r) => { setSheet(null); toast(r.blocked ? t('blocked') : t('unblocked')); } })}
            className="flex w-full items-center gap-3 py-3.5 font-medium"><Ban size={20} />{c.blocked ? t('unblock') : t('block')}</button>
          {reportsOn && <button onClick={() => setSheet('report')} className="flex w-full items-center gap-3 py-3.5 font-medium text-danger"><Flag size={20} />{t('report')}</button>}
        </>}
      </Sheet>
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} targetType="message" targetId={id} />
      {c && <ReviewSheet open={sheet === 'review'} onClose={() => setSheet(null)} workerId={c.peer.id} workerName={c.peer.name} />}
      <ImageComposer file={img} onClose={() => setImg(null)} onSend={sendPhoto} />
      <ImageViewer src={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
