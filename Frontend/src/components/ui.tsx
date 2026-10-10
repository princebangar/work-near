import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, BadgeCheck, BookOpen, Brush, Car, ChefHat, Briefcase, Droplets, Hammer, Scissors, Snowflake, Sparkles,
  Star, Wrench, Zap, BrickWall, X, CheckCircle2, AlertCircle, Info, type LucideIcon,
} from 'lucide-react';
import { cn, initials } from '@/lib/format';
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

export function Input({ label, error, left, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; left?: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>}
      <span className={cn('flex h-12 items-center gap-2 rounded-xl border bg-surface px-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15', error ? 'border-danger' : 'border-line')}>
        {left}
        <input {...p} className={cn('h-full w-full bg-transparent text-[15px] outline-none placeholder:text-ink-3', className)} />
      </span>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function Textarea({ label, ...p }: InputHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>}
      <textarea {...(p as object)} rows={4} className="w-full rounded-xl border border-line bg-surface p-3.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
    </label>
  );
}

export const Card = ({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) => (
  <div onClick={onClick} className={cn('rounded-card border border-line/70 bg-surface', onClick && 'cursor-pointer active:scale-[.99] transition', className)}>
    {children}
  </div>
);

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition',
        active ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-ink-2', className)}
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

export function Avatar({ src, name, size = 44, className }: { src?: string; name: string; size?: number; className?: string }) {
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-bold text-primary', className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
      {src && <img src={src} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />}
    </span>
  );
}

export const Stars = ({ value, size = 14 }: { value: number; size?: number }) => (
  <span className="inline-flex">
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= Math.round(value) ? 'fill-accent text-accent' : 'text-line'} />)}
  </span>
);

export const Rating = ({ value, count }: { value: number; count?: number }) => (
  <span className="inline-flex items-center gap-1 text-sm font-semibold">
    <Star size={14} className="fill-accent text-accent" />
    {value.toFixed(1)}
    {count !== undefined && <span className="font-normal text-ink-3">({count})</span>}
  </span>
);

const vLabel: Record<VerificationType, string> = { phone: 'Phone verified', id: 'ID verified', id_address: 'ID + Address verified' };
export const VerifiedBadge = ({ type, compact }: { type: VerificationType | null; compact?: boolean }) =>
  type ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary" title={vLabel[type]}>
      <BadgeCheck size={16} className="fill-primary text-white" />
      {!compact && vLabel[type]}
    </span>
  ) : null;

const icons: Record<string, LucideIcon> = {
  zap: Zap, droplets: Droplets, hammer: Hammer, 'paint-roller': Brush, snowflake: Snowflake, sparkles: Sparkles, wrench: Wrench,
  scissors: Scissors, 'book-open': BookOpen, car: Car, 'chef-hat': ChefHat, 'brick-wall': BrickWall,
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
          <button aria-label="Back" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} className="grid size-10 place-items-center rounded-full hover:bg-surface-2">
            <ArrowLeft size={22} />
          </button>
        )}
        <h1 className={cn('flex-1 truncate text-[17px] font-bold', !back && 'pl-2')}>{title}</h1>
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
      <div className="animate-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="animate-sheet pb-safe relative text-ink max-h-[88dvh] w-full max-w-[var(--app-max-w)] overflow-y-auto rounded-t-3xl bg-surface">
        <div className="sticky top-0 z-10 flex items-center bg-surface px-5 pt-3 pb-2">
          <span className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
          <h3 className="mt-2 flex-1 text-lg font-bold">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="mt-2 grid size-9 place-items-center rounded-full bg-surface-2"><X size={18} /></button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-primary' : 'bg-line')}>
      <span className={cn('absolute top-1 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
    </button>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton rounded-xl', className)} />;

export function EmptyState({ icon, title, sub, action }: { icon: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 grid size-20 place-items-center rounded-full bg-primary-soft text-primary">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {sub && <p className="mt-1 text-sm text-ink-2">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const SectionTitle = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-[17px] font-bold">{children}</h2>
    {action}
  </div>
);

export function Toaster() {
  const t = useToast((s) => s.toast);
  if (!t) return null;
  const I = t.kind === 'error' ? AlertCircle : t.kind === 'info' ? Info : CheckCircle2;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div key={t.id} className="animate-fade flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg">
        <I size={18} className={t.kind === 'error' ? 'text-red-300' : 'text-emerald-300'} />
        {t.text}
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
