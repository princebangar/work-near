// Fixed left navigation. Always dark (its own palette in both themes), collapsible on desktop, slide-over on mobile.
import { useMemo, useState, type FocusEvent, type MouseEvent } from 'react';
import { NavLink } from 'react-router';
import { ChevronsLeft, MapPin, Search, X } from 'lucide-react';
import { useAdminBadges } from '@/api/admin';
import { cn } from '@/lib/format';
import type { AdminRole } from '@/types/admin';
import { roleLabel } from '../lib';
import { navFor, type NavItem } from './nav';

const SIDEBAR_BG = 'bg-[#0f1117]';

export function Sidebar({ role, collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: {
  role: AdminRole; collapsed: boolean; onToggleCollapse: () => void; mobileOpen: boolean; onCloseMobile: () => void;
}) {
  const sections = useMemo(() => navFor(role), [role]);
  const [filter, setFilter] = useState('');
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const { data: badges } = useAdminBadges();

  const f = filter.trim().toLowerCase();
  const shown = f
    ? sections
      .map((s) => ({ ...s, items: s.items.filter((i) => `${i.label} ${s.title} ${i.keywords ?? ''}`.toLowerCase().includes(f)) }))
      .filter((s) => s.items.length)
    : sections;

  // Collapsed rail: tooltips are rendered fixed so the scrolling nav doesn't clip them.
  const showTip = (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, item: NavItem, count: number) => {
    if (!collapsed || !matchMedia('(min-width: 1024px)').matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label: count ? `${item.label} · ${count}` : item.label, top: r.top + r.height / 2 });
  };
  const hideTip = () => setTip(null);

  return (
    <>
      {mobileOpen && <div className="animate-fade fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px] lg:hidden" onClick={onCloseMobile} aria-hidden />}
      <aside
        aria-label="Admin navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] flex-col border-r border-white/[.06] text-white/70 transition-[width,transform] duration-300 ease-out',
          SIDEBAR_BG,
          collapsed ? 'lg:w-20' : 'lg:w-72',
          mobileOpen ? 'translate-x-0 shadow-2xl shadow-black/50' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(99,102,241,.24),transparent_70%)]" aria-hidden />

        {/* Brand */}
        <div className={cn('relative flex h-16 shrink-0 items-center gap-3 px-5', collapsed && 'lg:justify-center lg:px-0')}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
            <MapPin size={20} strokeWidth={2.2} />
          </span>
          <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
            <p className="text-[15px] leading-tight font-extrabold text-white">WorkNear</p>
            <p className="mt-0.5 text-[10px] font-bold tracking-[.22em] text-indigo-300/85">ADMIN PANEL</p>
          </div>
          <button type="button" aria-label="Close menu" onClick={onCloseMobile} className="grid size-9 place-items-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Menu filter */}
        <div className={cn('relative px-4 pt-1 pb-2', collapsed && 'lg:hidden')}>
          <Search size={15} className="pointer-events-none absolute top-1/2 left-7 mt-0.5 -translate-y-1/2 text-white/35" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
            placeholder="Filter menu…"
            aria-label="Filter menu"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[.04] pr-3 pl-9 text-sm text-white outline-none placeholder:text-white/35 focus:border-indigo-400/60 focus:bg-white/[.06]"
          />
        </div>

        {/* Sections */}
        <nav className="adm-scroll relative flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4" onScroll={hideTip}>
          {shown.map((s) => (
            <div key={s.title} className="mt-4 first:mt-2">
              <p className={cn('px-3 pb-1.5 text-[10px] font-bold tracking-[.16em] text-white/35 uppercase', collapsed && 'lg:hidden')}>{s.title}</p>
              {collapsed && <div className="mx-auto mb-2 hidden h-px w-8 bg-white/10 lg:block" aria-hidden />}
              <ul className="space-y-0.5">
                {s.items.map((i) => {
                  const count = i.badge ? badges?.[i.badge] ?? 0 : 0;
                  const amber = i.badgeTone === 'amber';
                  return (
                    <li key={i.to}>
                      <NavLink
                        to={i.to ? `/admin/${i.to}` : '/admin'}
                        end={i.to === ''}
                        onClick={onCloseMobile}
                        onMouseEnter={(e) => showTip(e, i, count)}
                        onMouseLeave={hideTip}
                        onFocus={(e) => showTip(e, i, count)}
                        onBlur={hideTip}
                        aria-label={count ? `${i.label} (${count} pending)` : undefined}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex h-10 items-center gap-3 rounded-xl border px-3 text-[13.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400',
                            collapsed && 'lg:justify-center lg:px-0',
                            isActive ? 'border-white/10 bg-white/10 text-white' : 'border-transparent text-white/60 hover:bg-white/[.05] hover:text-white',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && <span className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-indigo-400" aria-hidden />}
                            <i.icon size={18} className={cn('shrink-0', isActive ? 'text-indigo-300' : 'text-white/45 group-hover:text-white/80')} />
                            <span className={cn('truncate', collapsed && 'lg:hidden')}>{i.label}</span>
                            {count > 0 && (
                              <span
                                className={cn(
                                  'ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                                  amber ? 'bg-amber-400 text-amber-950' : 'bg-rose-500 text-white',
                                  collapsed && 'lg:hidden',
                                )}
                              >
                                {count > 99 ? '99+' : count}
                              </span>
                            )}
                            {count > 0 && collapsed && (
                              <span className={cn('absolute top-2 right-4 hidden size-2 rounded-full ring-2 ring-[#0f1117] lg:block', amber ? 'bg-amber-400' : 'bg-rose-500')} aria-hidden />
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!shown.length && <p className="px-3 py-8 text-center text-sm text-white/40">Nothing matches “{filter}”</p>}
        </nav>

        {/* Footer */}
        <div className="relative shrink-0 border-t border-white/[.06] p-3">
          <p className={cn('px-3 pb-2 text-[11px] text-white/35 lg:hidden')}>Signed in as {roleLabel(role)}</p>
          <button
            type="button"
            onClick={() => {
              hideTip();
              onToggleCollapse();
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={cn('hidden h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/55 transition hover:bg-white/[.06] hover:text-white lg:flex', collapsed && 'lg:justify-center lg:px-0')}
          >
            <ChevronsLeft size={18} className={cn('shrink-0 transition-transform duration-300', collapsed && 'rotate-180')} />
            <span className={cn(collapsed && 'lg:hidden')}>Collapse</span>
          </button>
        </div>
      </aside>

      {tip && (
        <div
          role="tooltip"
          className="adm-pop pointer-events-none fixed left-[88px] z-[58] -translate-y-1/2 rounded-lg bg-[#1d2130] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-xl ring-1 ring-white/10"
          style={{ top: tip.top }}
        >
          {tip.label}
        </div>
      )}
    </>
  );
}
