import { Link, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, CircleUserRound, LogOut, Menu as MenuIcon, Search, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ThemeToggle } from '@/components/system';
import { Avatar } from '@/components/ui';
import { adminLogout } from '@/api/admin';
import { useAuth, useSettings } from '@/store';
import { isAdminPlus, maskEmail, roleLabel } from '../lib';
import { IconBtn, Kbd, Menu, MenuItem, Pill } from '../components/kit';
import { NAV, itemForPath } from './nav';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

function MaintenanceChip({ linked }: { linked: boolean }) {
  const cls = 'inline-flex h-9 items-center gap-2 rounded-full border border-danger/25 bg-danger-soft px-3 text-xs font-bold text-danger';
  const body = (
    <>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" />
        <span className="relative size-2 rounded-full bg-danger" />
      </span>
      <span className="hidden sm:inline">Maintenance ON</span>
    </>
  );
  const title = 'Maintenance mode is ON — the app is closed for users';
  return linked ? <Link to="/admin/settings" title={title} className={cls}>{body}</Link> : <span title={title} role="status" className={cls}>{body}</span>;
}

export function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const admin = useAuth((s) => s.admin)!;
  const maintenance = useSettings((s) => s.settings?.maintenance?.enabled);
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const item = itemForPath(loc.pathname);
  const section = item && NAV.find((s) => s.items.includes(item))?.title;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
        <IconBtn label="Open menu" onClick={onMenu} className="lg:hidden"><MenuIcon size={20} /></IconBtn>

        {item && (
          <div className="hidden min-w-0 shrink-0 xl:block">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-ink-3">
              Admin <ChevronRight size={12} /> {section}
            </p>
            <p className="max-w-56 truncate text-sm font-bold text-ink">{item.label}</p>
          </div>
        )}

        <button
          type="button"
          onClick={onSearch}
          aria-label="Search pages and users"
          aria-keyshortcuts="Control+K Meta+K"
          className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface-2/70 px-3 text-sm text-ink-3 transition hover:border-primary/40 hover:text-ink-2 sm:max-w-md xl:ml-6"
        >
          <Search size={16} className="shrink-0" />
          <span className="truncate">Search…</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd></span>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {maintenance && <MaintenanceChip linked={isAdminPlus(admin.role)} />}

          <ThemeToggle variant="fold" className="text-ink-2 hover:bg-surface-2 hover:text-ink" />

          <Menu
            label="Account menu"
            width="w-72"
            buttonClassName="flex h-10 items-center gap-2 rounded-xl px-1.5 transition hover:bg-surface-2 sm:pr-2"
            button={
              <>
                <Avatar name={admin.name} size={34} />
                <span className="hidden min-w-0 text-left md:block">
                  <span className="block max-w-36 truncate text-[13px] leading-tight font-bold text-ink">{admin.name}</span>
                  <span className="block text-[11px] leading-tight text-ink-3">{roleLabel(admin.role)}</span>
                </span>
                <ChevronDown size={15} className="hidden text-ink-3 md:block" />
              </>
            }
          >
            {(close) => (
              <>
                <div className="mb-1.5 border-b border-line px-3 pt-2 pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={admin.name} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{admin.name}</p>
                      <p className="truncate text-xs text-ink-3">{maskEmail(admin.email)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Pill tone="primary" dot={false}>{roleLabel(admin.role)}</Pill>
                    {admin.mfaEnabled ? (
                      <Pill tone="success" dot={false}><ShieldCheck size={12} /> MFA on</Pill>
                    ) : (
                      <Pill tone="warning" dot={false}><ShieldAlert size={12} /> MFA off</Pill>
                    )}
                  </div>
                </div>
                <MenuItem icon={<CircleUserRound size={16} />} onClick={() => { close(); nav('/admin/account'); }}>My account</MenuItem>
                <MenuItem
                  danger
                  icon={<LogOut size={16} />}
                  onClick={() => {
                    close();
                    adminLogout(qc);
                    nav('/admin/login', { replace: true });
                  }}
                >
                  Log out
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>
    </header>
  );
}
