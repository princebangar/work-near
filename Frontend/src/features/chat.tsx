import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Ban, BellOff, Check, CheckCheck, Flag, MessageCircle, MoreVertical, Search, SendHorizontal, ShieldAlert } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, Sheet, Skeleton, TopBar } from '@/components/ui';
import { ReportSheet } from '@/components/shared';
import { useConversations, useMessages, useSendMessage, useUpdateConversation } from '@/api';
import { useT } from '@/i18n';
import { clock, cn, timeAgo } from '@/lib/format';
import { toast } from '@/store';

export function ChatList() {
  const t = useT();
  const nav = useNavigate();
  const { data, isLoading } = useConversations();
  const [q, setQ] = useState('');
  const list = data?.filter((c) => c.peer.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="min-h-full bg-surface">
      <TopBar back={false} title={t('chats')} />
      <div className="px-4 py-3">
        <label className="flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-3">
          <Search size={18} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="w-full bg-transparent outline-none" />
        </label>
      </div>
      {isLoading && <div className="space-y-2 px-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>}
      {list?.length === 0 && <EmptyState icon={<MessageCircle size={32} />} title={t('noChats')} sub={t('noChatsSub')} action={<Button onClick={() => nav('/search')}>{t('search')}</Button>} />}
      <ul>
        {list?.map((c) => (
          <li key={c.id}>
            <button onClick={() => nav(`/chats/${c.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
              <Avatar src={c.peer.photo} name={c.peer.name} size={52} />
              <span className="min-w-0 flex-1 border-b border-line pb-3">
                <span className="flex items-center gap-2">
                  <b className="flex-1 truncate">{c.peer.name}</b>
                  <span className={cn('text-xs', c.unread ? 'font-semibold text-primary' : 'text-ink-3')}>{timeAgo(c.lastMessageAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm text-ink-2">{c.blocked ? 'Blocked' : c.lastMessage || c.peer.subtitle}</span>
                  {c.muted && <BellOff size={14} className="text-ink-3" />}
                  {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">{c.unread}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChatThread() {
  const t = useT();
  const { id = '' } = useParams();
  const nav = useNavigate();
  const convs = useConversations();
  const c = convs.data?.find((x) => x.id === id);
  const { data: msgs, isLoading } = useMessages(id);
  const send = useSendMessage(id);
  const update = useUpdateConversation();
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [msgs?.length]);

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    send.mutate(v);
    setText('');
  };

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <TopBar
        title={c && (
          <button onClick={() => c.peer.role === 'worker' && nav(`/worker/${c.peer.id}`)} className="flex items-center gap-2.5 text-left">
            <Avatar src={c.peer.photo} name={c.peer.name} size={36} />
            <span><span className="block text-[15px] leading-tight">{c.peer.name}</span><span className="block text-xs font-normal text-ink-2">{c.peer.subtitle}</span></span>
          </button>
        )}
        right={<button aria-label="More" onClick={() => setMenu(true)} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><MoreVertical size={20} /></button>}
      />
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        <div className="mx-auto mb-3 flex max-w-xs items-start gap-2 rounded-xl bg-warning-soft p-3 text-xs text-ink-2">
          <ShieldAlert size={16} className="shrink-0 text-warning" />
          Never pay advance before work. WorkNear takes zero commission — pay the worker directly after the job.
        </div>
        {isLoading && <Skeleton className="h-40" />}
        {msgs?.map((m) => {
          const mine = m.senderId === 'me';
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] shadow-sm', mine ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md bg-surface')}>
                {m.text}
                <span className={cn('mt-0.5 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-white/70' : 'text-ink-3')}>
                  {clock(m.sentAt)}
                  {mine && (m.status === 'read' ? <CheckCheck size={13} /> : m.status === 'delivered' ? <CheckCheck size={13} className="opacity-60" /> : <Check size={13} />)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {c?.blocked ? (
        <div className="pb-safe border-t border-line bg-surface p-4 text-center text-sm text-ink-2">
          You blocked this user. <button className="font-semibold text-primary" onClick={() => update.mutate({ id, blocked: false })}>{t('unblock')}</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="pb-safe flex items-end gap-2 border-t border-line bg-surface p-2.5">
          <textarea
            rows={1} value={text} maxLength={2000} placeholder={t('typeMessage')} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl bg-surface-2 px-4 py-2.5 text-[15px] outline-none"
          />
          <button type="submit" aria-label="Send" disabled={!text.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-40">
            <SendHorizontal size={20} />
          </button>
        </form>
      )}
      <Sheet open={menu} onClose={() => setMenu(false)} title="Chat options">
        {c && <>
          <button onClick={() => { update.mutate({ id, muted: !c.muted }); setMenu(false); toast(c.muted ? 'Unmuted' : 'Muted'); }} className="flex w-full items-center gap-3 py-3.5 font-medium"><BellOff size={20} />{c.muted ? t('unmute') : t('mute')} <Badge className="ml-auto">{c.muted ? 'On' : 'Off'}</Badge></button>
          <button onClick={() => { update.mutate({ id, blocked: !c.blocked }); setMenu(false); toast(c.blocked ? 'Unblocked' : 'Blocked'); }} className="flex w-full items-center gap-3 py-3.5 font-medium"><Ban size={20} />{c.blocked ? t('unblock') : t('block')}</button>
          <button onClick={() => { setMenu(false); setReport(true); }} className="flex w-full items-center gap-3 py-3.5 font-medium text-danger"><Flag size={20} />{t('report')}</button>
        </>}
      </Sheet>
      <ReportSheet open={report} onClose={() => setReport(false)} targetType="message" targetId={id} />
    </div>
  );
}
