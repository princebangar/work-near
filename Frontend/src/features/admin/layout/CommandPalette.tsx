// Ctrl/Cmd+K palette: jump to any allowed page, or find a user by name / mobile (debounced server search).
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { ArrowRight, CornerDownLeft, Loader2, Search, UserRound, type LucideIcon } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { useUserSearch } from '@/api/admin';
import { mediaUrl } from '@/lib/media';
import { cn } from '@/lib/format';
import type { AdminRole } from '@/types/admin';
import { USER_STATUS_LABEL, isAdminPlus, toneOf, useDebounced } from '../lib';
import { Kbd, Pill } from '../components/kit';
import { navFor } from './nav';

type Result =
  | { kind: 'page'; key: string; label: string; section: string; to: string; icon: LucideIcon }
  | { kind: 'user'; key: string; id: string; name: string; mobile: string; avatar?: string; status: string; roles: string[] };

export function CommandPalette({ open, onClose, role }: { open: boolean; onClose: () => void; role: AdminRole }) {
  if (!open) return null;
  return createPortal(<Palette onClose={onClose} role={role} />, document.body);
}

function Palette({ onClose, role }: { onClose: () => void; role: AdminRole }) {
  const nav = useNavigate();
  const listId = useId();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const dq = useDebounced(q.trim(), 250);
  const canUsers = isAdminPlus(role);
  const users = useUserSearch(dq, canUsers);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null;
    return () => prevFocus.current?.focus?.();
  }, []);

  const results = useMemo<Result[]>(() => {
    const f = q.trim().toLowerCase();
    const pages: Result[] = navFor(role)
      .flatMap((s) => s.items.map((i) => ({ i, s: s.title })))
      .filter(({ i, s }) => !f || `${i.label} ${s} ${i.keywords ?? ''}`.toLowerCase().includes(f))
      .map(({ i, s }) => ({ kind: 'page', key: `p-${i.to}`, label: i.label, section: s, to: i.to ? `/admin/${i.to}` : '/admin', icon: i.icon }));
    const people: Result[] =
      canUsers && dq.length >= 2
        ? (users.data?.items ?? []).map((u) => ({ kind: 'user', key: `u-${u.id}`, id: u.id, name: u.name, mobile: u.mobile, avatar: u.avatar, status: u.status, roles: u.roles }))
        : [];
    return [...pages, ...people];
  }, [q, dq, role, canUsers, users.data]);

  const idx = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    document.getElementById(`${listId}-${idx}`)?.scrollIntoView({ block: 'nearest' });
  }, [idx, listId]);

  const choose = (r?: Result) => {
    if (!r) return;
    onClose();
    nav(r.kind === 'page' ? r.to : `/admin/users?user=${r.id}`);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[idx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // don't also close a drawer underneath
      onClose();
    }
  };

  const firstUser = results.findIndex((r) => r.kind === 'user');
  const searching = canUsers && q.trim().length >= 2 && (users.isFetching || dq !== q.trim());

  return (
    <div className="fixed inset-0 z-[57] flex items-start justify-center px-3 pt-[10vh] text-ink sm:pt-[14vh]">
      <div className="animate-fade absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Search" className="adm-pop relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-ink-3" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results.length ? `${listId}-${idx}` : undefined}
            aria-autocomplete="list"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder={canUsers ? 'Jump to a page or search users by name / mobile…' : 'Jump to a page…'}
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
          {searching ? <Loader2 size={16} className="shrink-0 animate-spin text-ink-3" /> : <Kbd>Esc</Kbd>}
        </div>

        <ul id={listId} role="listbox" aria-label="Results" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {results.map((r, i) => (
            <li key={r.key} role="presentation">
              {i === 0 && r.kind === 'page' && <p className="px-3 pt-1 pb-1.5 text-[10.5px] font-bold tracking-[.14em] text-ink-3 uppercase">Pages</p>}
              {i === firstUser && <p className="px-3 pt-3 pb-1.5 text-[10.5px] font-bold tracking-[.14em] text-ink-3 uppercase">Users</p>}
              <div
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === idx}
                onMouseMove={() => i !== idx && setActive(i)}
                onClick={() => choose(r)}
                className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5', i === idx ? 'bg-primary-soft' : 'hover:bg-surface-2')}
              >
                {r.kind === 'page' ? (
                  <>
                    <span className={cn('grid size-8 place-items-center rounded-lg', i === idx ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink-2')}>
                      <r.icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{r.label}</span>
                      <span className="block text-xs text-ink-3">{r.section}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <Avatar name={r.name} src={mediaUrl(r.avatar)} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                      <span className="block text-xs text-ink-3 tabular-nums">{r.mobile} · {r.roles.join(' + ')}</span>
                    </span>
                    {r.status !== 'active' && <Pill tone={toneOf('user', r.status)}>{USER_STATUS_LABEL[r.status] ?? r.status}</Pill>}
                  </>
                )}
                {i === idx && <ArrowRight size={16} className="shrink-0 text-primary" />}
              </div>
            </li>
          ))}
          {!results.length && !searching && (
            <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-ink-2">
              <UserRound size={22} className="text-ink-3" />
              No pages{canUsers ? ' or users' : ''} match “{q}”
            </li>
          )}
          {canUsers && q.trim().length === 1 && <li className="px-3 py-2 text-xs text-ink-3">Type at least 2 characters to search users</li>}
        </ul>

        <div className="flex items-center gap-4 border-t border-line bg-surface-2/50 px-4 py-2.5 text-[11px] text-ink-3">
          <span className="inline-flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="inline-flex items-center gap-1.5"><Kbd><CornerDownLeft size={11} /></Kbd> open</span>
          <span className="ml-auto hidden sm:inline">Tip: press {/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'}+K anywhere</span>
        </div>
      </div>
    </div>
  );
}
