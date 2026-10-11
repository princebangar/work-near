import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, BadgeCheck, BookOpen, Brush, Car, ChefHat, Briefcase, Droplets, Hammer, Scissors, Snowflake, Sparkles,
  Star, Wrench, Zap, BrickWall, X, CheckCircle2, AlertCircle, Info, RefreshCw, type LucideIcon,
} from 'lucide-react';
import { cn, initials } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { useToast } from '@/store';
import type { VerificationType } from '@/types';

type BtnVariant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger';
export function Button({ variant = 'primary', size = 'md', block, loading, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; block?: boolean; loading?: boolean;
}) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none',
        { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-sm', lg: 'h-13 px-5 text-base' }[size],
        {
          primary: 'bg-primary text-on-primary hover:bg-primary-600 shadow-sm shadow-primary/30',
          soft: 'bg-primary-soft text-primary hover:brightness-95',
          ghost: 'text-ink-2 hover:bg-surface-2',
          outline: 'border border-line bg-surface text-ink hover:bg-surface-2',
          danger: 'bg-danger text-white hover:brightness-95',
        }[variant],
        block && 'w-full',
        className,
      )}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Input({ label, error, hint, left, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: ReactNode; left?: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>}
      <span className={cn('flex h-12 items-center gap-2 rounded-xl border bg-surface px-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15', error ? 'border-danger' : 'border-line', p.disabled && 'bg-surface-2')}>
        {left}
        <input {...p} className={cn('h-full w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3 disabled:text-ink-2', className)} />
      </span>
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Textarea({ label, error, hint, rows = 4, className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>}
      <textarea
        {...p}
        rows={rows}
        className={cn(
          'w-full resize-none rounded-xl border bg-surface p-3.5 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-primary focus:ring-2 focus:ring-primary/15',
          error ? 'border-danger' : 'border-line',
          className,
        )}
      />
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export const Card = ({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) => (
  <div
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined}
    className={cn('rounded-card border border-line/70 bg-surface', onClick && 'cursor-pointer active:scale-[.99] transition', className)}
  >
    {children}
  </div>
);

export function Chip({ active, children, onClick, className, disabled }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition',
        active ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-ink-2', disabled && 'opacity-50', className)}
    >
      {children}
    </button>
  );
}

const badgeTone = {
  neutral: 'bg-surface-2 text-ink-2', primary: 'bg-primary-soft text-primary', success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger',
};
export type Tone = keyof typeof badgeTone;
export const Badge = ({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', badgeTone[tone], className)}>{children}</span>
);

/** Profile picture with initials fallback. `src` may be an API media path — resolved with mediaUrl(). */
export function Avatar({ src, name, size = 44, className }: { src?: string; name: string; size?: number; className?: string }) {
  const url = mediaUrl(src);
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-bold text-primary', className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name || '?')}
      {url && <img key={url} src={url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />}
    </span>
  );
}

export const Stars = ({ value, size = 14 }: { value: number; size?: number }) => (
  <span className="inline-flex" aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= Math.round(value) ? 'fill-accent text-accent' : 'text-line'} />)}
  </span>
);

export const Rating = ({ value, count }: { value: number; count?: number }) => (
  <span className="inline-flex items-center gap-1 text-sm font-semibold">
    <Star size={14} className="fill-accent text-accent" />
    {count === 0 ? <span className="font-medium text-ink-3">New</span> : value.toFixed(1)}
    {count !== undefined && count > 0 && <span className="font-normal text-ink-3">({count})</span>}
  </span>
);

export const verificationLabel: Record<VerificationType, string> = { phone: 'Phone verified', id: 'ID verified', id_address: 'ID + Address verified' };
export const VerifiedBadge = ({ type, compact }: { type: VerificationType | null; compact?: boolean }) =>
  type ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary" title={verificationLabel[type]}>
      <BadgeCheck size={16} className="fill-primary text-on-primary" />
      {!compact && verificationLabel[type]}
    </span>
  ) : null;

const icons: Record<string, LucideIcon> = {
  zap: Zap, droplets: Droplets, hammer: Hammer, 'paint-roller': Brush, snowflake: Snowflake, sparkles: Sparkles, wrench: Wrench,
  scissors: Scissors, 'book-open': BookOpen, car: Car, 'chef-hat': ChefHat, 'brick-wall': BrickWall, briefcase: Briefcase,
};
export const CategoryIcon = ({ name, size = 24 }: { name: string; size?: number }) => {
  const I = icons[name] ?? Briefcase;
  return <I size={size} strokeWidth={1.8} />;
};

export function TopBar({ title, back = true, right, transparent }: { title?: ReactNode; back?: boolean; right?: ReactNode; transparent?: boolean }) {
  const nav = useNavigate();
  return (
    <header className={cn('pt-safe sticky top-0 z-30', !transparent && 'border-b border-line/60 bg-surface/90 backdrop-blur')}>
      <div className="flex h-14 items-center gap-2 px-2">
        {back && (
          <button aria-label="Back" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} className="grid size-10 place-items-center rounded-full text-ink hover:bg-surface-2">
            <ArrowLeft size={22} />
          </button>
        )}
        <h1 className={cn('min-w-0 flex-1 truncate text-[17px] font-bold text-ink', !back && 'pl-2')}>{title}</h1>
        {right}
      </div>
    </header>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="animate-fade absolute inset-0 bg-black/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="animate-sheet pb-safe relative max-h-[88dvh] w-full max-w-[var(--app-max-w)] overflow-y-auto rounded-t-3xl bg-surface text-ink">
        <div className="sticky top-0 z-10 flex items-center bg-surface px-5 pt-3 pb-2">
          <span className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
          <h3 className="mt-2 flex-1 text-lg font-bold">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="mt-2 grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2"><X size={18} /></button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50', checked ? 'bg-primary' : 'bg-surface-3 ring-1 ring-line ring-inset')}
    >
      <span className={cn('absolute top-1 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
    </button>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton rounded-xl', className)} />;

export function EmptyState({ icon, title, sub, action }: { icon: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 grid size-20 place-items-center rounded-full bg-primary-soft text-primary">{icon}</div>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {sub && <p className="mt-1 text-sm text-ink-2">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Inline load failure with retry. */
export function ErrorState({ message, onRetry, retryLabel = 'Try again' }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      <div className="mb-3 grid size-16 place-items-center rounded-full bg-surface-2 text-ink-3"><AlertCircle size={28} /></div>
      <p className="text-sm text-ink-2">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}><RefreshCw size={15} />{retryLabel}</Button>}
    </div>
  );
}

export const SectionTitle = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-[17px] font-bold text-ink">{children}</h2>
    {action}
  </div>
);

export function Toaster() {
  const t = useToast((s) => s.toast);
  if (!t) return null;
  const I = t.kind === 'error' ? AlertCircle : t.kind === 'info' ? Info : CheckCircle2;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div key={t.id} role="status" className="animate-fade flex max-w-[calc(var(--app-max-w)-32px)] items-center gap-2.5 rounded-2xl bg-ink py-2.5 pr-4 pl-2.5 text-sm font-medium text-surface shadow-lg">
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', t.kind === 'error' ? 'bg-danger-soft text-danger' : t.kind === 'info' ? 'bg-primary-soft text-primary' : 'bg-success-soft text-success')}>
          <I size={16} />
        </span>
        <span className="min-w-0">{t.text}</span>
      </div>
    </div>
  );
}

/** Route-loading skeleton — same markup/classes as the boot skeleton in index.html, so refresh shows one continuous skeleton. */
export const Spinner = () => (
  <div aria-busy="true">
    <div className="bs-h" />
    <div className="bs-p">
      <div className="bs-k" style={{ height: 128 }} />
      <div className="bs-g">{[0, 1, 2, 3].map((i) => <div key={i} className="bs-k" style={{ height: 64 }} />)}</div>
      <div className="bs-k" style={{ height: 100 }} />
      <div className="bs-k" style={{ height: 100 }} />
    </div>
  </div>
);

/** Small centred spinner for in-page loading. */
export const Loader = ({ className }: { className?: string }) => (
  <div className={cn('grid place-items-center py-10', className)}>
    <span className="size-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
  </div>
);
