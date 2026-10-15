// Admin UI kit — token-only colours (light + dark), keyboard friendly, responsive (table → cards on mobile).
import {
  useEffect, useId, useRef, useState, type ButtonHTMLAttributes,
  type InputHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CalendarRange, ChevronDown, Inbox, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { Skeleton } from '@/components/ui';
import { cn, num } from '@/lib/format';
import { errText } from '@/api/admin';
import { presetRange, type PillTone, type RangePreset } from '../lib';

// ======================================================================
// Layout pieces
// ======================================================================
export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-bold tracking-[.18em] text-primary uppercase">{eyebrow}</p>}
        <h1 className="text-[22px] leading-tight font-extrabold tracking-tight text-ink sm:text-[26px]">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, sub, actions, children, className, bodyClassName, icon }: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; icon?: ReactNode;
}) {
  return (
    <section className={cn('rounded-2xl border border-line bg-surface dark:border-white/[.06] dark:bg-gradient-to-b dark:from-surface-2/60 dark:to-surface dark:shadow-[inset_0_1px_0_rgba(255,255,255,.04)]', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div className="flex min-w-0 items-start gap-3">
            {icon}
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-bold text-ink">{title}</h2>}
              {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
            </div>
          </div>
          {actions}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export const MicroLabel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('text-[10.5px] font-bold tracking-[.14em] text-ink-3 uppercase', className)}>{children}</p>
);

const pillTone: Record<PillTone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};
export function Pill({ tone = 'neutral', children, dot = true, className }: { tone?: PillTone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold whitespace-nowrap', pillTone[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-flex h-5 items-center rounded-md border border-line bg-surface px-1.5 font-sans text-[10.5px] font-semibold text-ink-3">{children}</kbd>
);

export function KeyVals({ items, className }: { items: { label: string; value: ReactNode; wide?: boolean }[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-3', className)}>
      {items.map((it) => (
        <div key={it.label} className={cn('min-w-0', it.wide && 'col-span-2')}>
          <dt className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{it.label}</dt>
          <dd className="mt-0.5 text-sm break-words text-ink">{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyBlock({ icon, title, sub, action, className }: { icon?: ReactNode; title: string; sub?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-surface-2 text-ink-3">{icon ?? <Inbox size={26} />}</div>
      <p className="font-bold text-ink">{title}</p>
      {sub && <p className="mt-1 max-w-sm text-sm text-ink-2">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBlock({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center rounded-2xl border border-danger/25 bg-danger-soft/50 px-6 py-10 text-center', className)}>
      <AlertTriangle className="mb-2 text-danger" size={26} />
      <p className="font-bold text-ink">Couldn’t load this</p>
      <p className="mt-1 text-sm text-ink-2">{errText(error)}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2">
          <RotateCcw size={15} /> Try again
        </button>
      )}
    </div>
  );
}

// ======================================================================
// Buttons
// ======================================================================
// No tailwind-merge in the project: never pass a className that fights a base class (e.g. text-*, h-*) —
// use the tone / size props instead.
type BtnTone = 'primary' | 'outline' | 'ghost' | 'danger' | 'dangerGhost' | 'soft' | 'success' | 'successGhost';
const btnTone: Record<BtnTone, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-600 shadow-sm shadow-primary/25',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-95',
  dangerGhost: 'text-danger hover:bg-danger-soft',
  soft: 'bg-primary-soft text-primary hover:brightness-95',
  success: 'bg-success text-white hover:brightness-95',
  successGhost: 'text-success hover:bg-success-soft',
};
const btnSize = { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-[15px]' };
export function Btn({ tone = 'outline', size = 'md', loading, icon, className, children, type = 'button', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: BtnTone; size?: keyof typeof btnSize; loading?: boolean; icon?: ReactNode;
}) {
  return (
    <button
      type={type}
      {...p}
      disabled={p.disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
        btnSize[size],
        btnTone[tone],
        className,
      )}
    >
      {loading ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconBtn({ label, children, className, danger, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...p}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-xl text-ink-2 transition disabled:opacity-40',
        danger ? 'hover:bg-danger-soft hover:text-danger' : 'hover:bg-surface-2 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ======================================================================
// Form fields
// ======================================================================
const fieldBase = 'w-full rounded-xl border bg-surface text-ink outline-none transition placeholder:text-ink-3 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60';

export function Field({ label, hint, error, children, className, htmlFor }: { label?: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('block', className)}>
      {label && <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-ink-2">{label}</label>}
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function TextField({ label, hint, error, className, inputClassName, left, trailing, tall, ...p }: InputHTMLAttributes<HTMLInputElement> & {
  label?: string; hint?: ReactNode; error?: string; inputClassName?: string; left?: ReactNode;
  /** Element pinned inside the right edge (e.g. show-password button). */
  trailing?: ReactNode;
  tall?: boolean;
}) {
  const auto = useId();
  const id = p.id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} className={className} htmlFor={id}>
      <div className="relative">
        {left && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">{left}</span>}
        <input
          id={id}
          aria-invalid={!!error || undefined}
          {...p}
          className={cn(fieldBase, 'text-sm', tall ? 'h-11' : 'h-10', left ? 'pl-9' : 'pl-3', trailing ? 'pr-11' : 'pr-3', error ? 'border-danger' : 'border-line', inputClassName)}
        />
        {trailing && <span className="absolute top-1/2 right-1.5 -translate-y-1/2">{trailing}</span>}
      </div>
    </Field>
  );
}

export function TextAreaField({ label, hint, error, className, rows = 4, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode; error?: string }) {
  const auto = useId();
  const id = p.id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} className={className} htmlFor={id}>
      <textarea id={id} rows={rows} aria-invalid={!!error || undefined} {...p} className={cn(fieldBase, 'resize-y px-3 py-2.5 text-sm leading-relaxed', error ? 'border-danger' : 'border-line')} />
    </Field>
  );
}

export function SelectField({ label, hint, className, options, ...p }: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string; hint?: ReactNode; options: { value: string; label: string; disabled?: boolean }[];
}) {
  const auto = useId();
  const id = p.id ?? auto;
  return (
    <Field label={label} hint={hint} className={className} htmlFor={id}>
      <div className="relative">
        <select id={id} {...p} className={cn(fieldBase, 'h-10 cursor-pointer appearance-none border-line pr-9 pl-3 text-sm')}>
          {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" />
      </div>
    </Field>
  );
}

export function Switch({ checked, onChange, disabled, label, tone = 'primary', size = 'md' }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; tone?: 'primary' | 'danger'; size?: 'md' | 'lg';
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'lg' ? 'h-8 w-14' : 'h-6 w-11',
        checked ? (tone === 'danger' ? 'bg-danger' : 'bg-primary') : 'bg-surface-3 ring-1 ring-line ring-inset',
      )}
    >
      <span
        className={cn(
          'absolute top-1 rounded-full bg-white shadow-sm transition-all duration-200',
          size === 'lg' ? 'size-6' : 'size-4',
          checked ? (size === 'lg' ? 'left-7' : 'left-6') : 'left-1',
        )}
      />
    </button>
  );
}

export function SearchField({ value, onChange, placeholder = 'Search…', className, label = 'Search', wide }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; label?: string; wide?: boolean;
}) {
  return (
    <div className={cn('relative w-full', wide ? 'sm:w-80' : 'sm:w-72', className)}>
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(fieldBase, 'h-10 border-line pr-9 pl-9 text-sm [&::-webkit-search-cancel-button]:hidden')}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
];
const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Compact date filter: one button ("All dates" / "1 Oct – 15 Oct") that opens presets + From / To inputs. */
export function DateRangeField({ from, to, onChange, className }: { from?: string; to?: string; onChange: (r: { from?: string; to?: string }) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const active = !!(from || to);
  const label = !active ? 'All dates' : from && to ? `${shortDate(from)} – ${shortDate(to)}` : from ? `From ${shortDate(from)}` : `Till ${shortDate(to!)}`;
  const preset = RANGE_PRESETS.find((p) => { const r = presetRange(p.value); return r.from === from && r.to === to; })?.value;
  const input = cn(fieldBase, 'h-9 border-line px-2.5 text-sm');
  return (
    <div ref={root} className={cn('relative', className)}>
      <div className={cn('flex h-10 items-center rounded-xl border bg-surface transition', active ? 'border-primary/40' : 'border-line hover:border-ink-3/50')}>
        <button
          ref={btn}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-full items-center gap-2 pr-2 pl-3 text-sm font-semibold whitespace-nowrap text-ink"
        >
          <CalendarRange size={16} className={active ? 'text-primary' : 'text-ink-3'} />
          {label}
          {!active && <ChevronDown size={14} className="text-ink-3" />}
        </button>
        {active && (
          <button type="button" aria-label="Clear dates" onClick={() => onChange({})} className="mr-1.5 grid size-7 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div role="dialog" aria-label="Filter by date" className="adm-pop absolute top-full right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-3 text-ink shadow-xl shadow-black/10">
          <div className="grid grid-cols-2 gap-1.5">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={preset === p.value}
                onClick={() => { onChange(presetRange(p.value)); setOpen(false); }}
                className={cn('h-8 rounded-lg border text-[13px] font-semibold transition', preset === p.value ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink-2 hover:text-ink')}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
            <label className="text-[11px] font-bold tracking-wide text-ink-3 uppercase">
              From
              <input type="date" value={from ?? ''} max={to || undefined} onChange={(e) => onChange({ from: e.target.value || undefined, to })} className={cn(input, 'mt-1 font-normal tracking-normal normal-case')} />
            </label>
            <label className="text-[11px] font-bold tracking-wide text-ink-3 uppercase">
              To
              <input type="date" value={to ?? ''} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value || undefined })} className={cn(input, 'mt-1 font-normal tracking-normal normal-case')} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterChips<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition',
              on ? 'border-primary bg-primary text-on-primary shadow-sm shadow-primary/25' : 'border-line bg-surface text-ink-2 hover:border-ink-3/50 hover:text-ink',
            )}
          >
            {o.label}
            {!!o.count && <span className={cn('rounded-full px-1.5 text-[11px] font-bold', on ? 'bg-white/20' : 'bg-surface-2 text-ink-2')}>{num(o.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; icon?: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cn('no-scrollbar inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface-2 p-1', className)}>
      {items.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold transition',
            t.value === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Filter row container: wraps nicely from 360px up. */
export const Toolbar = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center', className)}>{children}</div>
);

// ======================================================================
// Data table (md+) / stacked cards (mobile)
// ======================================================================
export interface Column<R> {
  key: string;
  header: ReactNode;
  cell: (r: R) => ReactNode;
  className?: string;
  /** 'title' = card heading on mobile; 'hide' = desktop only. */
  mobile?: 'title' | 'hide';
  align?: 'right';
}

export function DataTable<R>({ rows, columns, rowKey, loading, onRowClick, empty, skeletonRows = 8, rowLabel, dim }: {
  rows: R[]; columns: Column<R>[]; rowKey: (r: R) => string; loading?: boolean; onRowClick?: (r: R) => void;
  empty?: ReactNode; skeletonRows?: number; rowLabel?: (r: R) => string; dim?: boolean;
}) {
  if (loading && !rows.length)
    return (
      <div className="space-y-2 rounded-2xl border border-line bg-surface p-3">
        {Array.from({ length: skeletonRows }, (_, i) => <Skeleton key={i} className="h-12" />)}
      </div>
    );
  if (!rows.length) return <div className="rounded-2xl border border-line bg-surface">{empty ?? <EmptyBlock title="Nothing here yet" />}</div>;
  const title = columns.find((c) => c.mobile === 'title') ?? columns[0]!;
  const rest = columns.filter((c) => c !== title && c.mobile !== 'hide');
  const onKey = (e: ReactKeyboardEvent, r: R) => {
    // Only when the row itself is focused — Enter/Space on a switch or button inside the row must not open it.
    if (onRowClick && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onRowClick(r);
    }
  };
  return (
    <div className={cn('transition-opacity', dim && 'opacity-60')}>
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/60">
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={cn('px-4 py-3 text-[10.5px] font-bold tracking-[.1em] whitespace-nowrap text-ink-3 uppercase', c.align === 'right' && 'text-right')}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={rowKey(r)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onKeyDown={(e) => onKey(e, r)}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(r) : undefined}
                  className={cn('border-b border-line/70 transition-colors last:border-0 hover:bg-surface-2/60', onRowClick && 'cursor-pointer focus-visible:bg-surface-2 focus-visible:outline-none')}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3 align-middle text-ink', c.align === 'right' && 'text-right', c.className)}>{c.cell(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ul className="space-y-2.5 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)}>
            <div
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={(e) => onKey(e, r)}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : undefined}
              aria-label={onRowClick && rowLabel ? rowLabel(r) : undefined}
              className={cn('rounded-2xl border border-line bg-surface p-4', onRowClick && 'cursor-pointer transition active:scale-[.99]')}
            >
              <div className="mb-3">{title.cell(r)}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                {rest.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[10px] font-bold tracking-[.1em] text-ink-3 uppercase">{c.header}</dt>
                    <dd className="mt-0.5 text-sm text-ink">{c.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Showing 25 of 120 · Load more" for cursor-paginated lists. */
export function LoadMore({ shown, total, hasMore, loading, onMore, noun = 'records' }: {
  shown: number; total: number; hasMore: boolean; loading: boolean; onMore: () => void; noun?: string;
}) {
  if (!total) return null;
  return (
    <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <p className="text-xs text-ink-3">Showing <b className="text-ink-2">{num(shown)}</b> of <b className="text-ink-2">{num(total)}</b> {noun}</p>
      {hasMore && <Btn size="sm" onClick={onMore} loading={loading}>Load more</Btn>}
    </div>
  );
}

// ======================================================================
// Overlays: Drawer, Dialog, Menu (Esc closes the topmost layer only, focus is trapped and restored)
// ======================================================================
const layers: number[] = [];
let layerSeq = 0;

function useLayer(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const id = ++layerSeq;
    layers.push(id);
    const prevFocus = document.activeElement as HTMLElement | null;
    const auto = ref.current?.querySelector<HTMLElement>('[data-autofocus]');
    (auto ?? ref.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && layers[layers.length - 1] === id) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', onKey);
      layers.splice(layers.indexOf(id), 1);
      if (!layers.length) document.body.style.overflow = '';
      prevFocus?.focus?.();
    };
  }, [open]);
  return ref;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';
function trapTab(e: ReactKeyboardEvent<HTMLElement>) {
  if (e.key !== 'Tab') return;
  const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
  if (!els.length) return;
  const first = els[0]!, last = els[els.length - 1]!;
  if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function Drawer({ open, onClose, title, sub, icon, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; icon?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useLayer(open, onClose);
  const id = useId();
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[51] flex justify-end text-ink">
      <div className="animate-fade absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={cn('adm-slide relative flex h-full w-full flex-col border-l border-line bg-surface shadow-2xl outline-none', wide ? 'max-w-2xl' : 'max-w-xl')}
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 id={id} className="truncate text-lg font-bold">{title}</h2>
            {sub && <div className="mt-0.5 text-sm text-ink-2">{sub}</div>}
          </div>
          <IconBtn label="Close" onClick={onClose} className="-mr-1 bg-surface-2"><X size={18} /></IconBtn>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Dialog({ open, onClose, title, description, children, footer, size = 'md', icon }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' | 'xl'; icon?: ReactNode;
}) {
  const ref = useLayer(open, onClose);
  const id = useId();
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[54] flex items-end justify-center p-0 text-ink sm:items-center sm:p-4">
      <div className="animate-fade absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={cn(
          'adm-pop relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-2xl outline-none sm:rounded-3xl',
          { md: 'sm:max-w-md', lg: 'sm:max-w-2xl', xl: 'sm:max-w-5xl' }[size],
        )}
      >
        <header className="flex items-start gap-3 px-5 pt-5 pb-3">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 id={id} className="text-lg leading-snug font-bold">{title}</h2>
            {description && <div className="mt-1 text-sm text-ink-2">{description}</div>}
          </div>
          <IconBtn label="Close" onClick={onClose} className="-mt-1 -mr-1"><X size={18} /></IconBtn>
        </header>
        {children && <div className="overflow-y-auto px-5 pb-4">{children}</div>}
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', tone = 'primary', loading, icon }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; description?: ReactNode; confirmLabel?: string; tone?: 'primary' | 'danger'; loading?: boolean; icon?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={icon}
      footer={
        <>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
          <Btn tone={tone} loading={loading} onClick={onConfirm} data-autofocus={tone === 'danger' ? undefined : true}>{confirmLabel}</Btn>
        </>
      }
    />
  );
}

/** Asks for a reason. Quick-pick presets fill the field. */
export function ReasonDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', tone = 'primary', loading, presets, required = true, label = 'Reason', placeholder, children }: {
  open: boolean; onClose: () => void; onConfirm: (reason: string) => void; title: string; description?: ReactNode; confirmLabel?: string;
  tone?: 'primary' | 'danger'; loading?: boolean; presets?: string[]; required?: boolean; label?: string; placeholder?: string; children?: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason('');
      setTouched(false);
    }
  }
  const short = required && reason.trim().length < 3;
  const submit = () => {
    setTouched(true);
    if (!short) onConfirm(reason.trim());
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
          <Btn tone={tone} loading={loading} onClick={submit}>{confirmLabel}</Btn>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
        {children}
        {presets && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button key={p} type="button" onClick={() => setReason(p)} className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold transition', reason === p ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink-2 hover:text-ink')}>
                {p}
              </button>
            ))}
          </div>
        )}
        <TextAreaField
          data-autofocus
          label={required ? label : `${label} (optional)`}
          rows={3}
          maxLength={500}
          value={reason}
          placeholder={placeholder ?? 'Write a short reason'}
          onChange={(e) => setReason(e.target.value)}
          error={touched && short ? 'Please add a reason (at least 3 characters)' : undefined}
        />
      </form>
    </Dialog>
  );
}

/** Small anchored dropdown menu. */
export function Menu({ button, label, children, align = 'right', className, buttonClassName, width = 'w-60' }: {
  button: ReactNode; label: string; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; className?: string; buttonClassName?: string; width?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={root} className={cn('relative', className)}>
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)} className={buttonClassName}>
        {button}
      </button>
      {open && (
        <div role="menu" className={cn('adm-pop absolute top-full z-40 mt-2 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-xl shadow-black/10', width, align === 'right' ? 'right-0' : 'left-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, danger, disabled, hint }: { icon?: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean; hint?: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition disabled:opacity-50', danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-surface-2')}
    >
      {icon && <span className={cn('shrink-0', danger ? 'text-danger' : 'text-ink-3')}>{icon}</span>}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
    </button>
  );
}
