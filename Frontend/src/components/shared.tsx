import { memo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, X } from 'lucide-react';
import { Avatar, Badge, Button, Card, Chip, Rating, Sheet, Textarea, VerifiedBadge } from './ui';
import { cn, km } from '@/lib/format';
import { checkImage, mediaUrl } from '@/lib/media';
import { toast } from '@/store';
import { isApiError, toastError, useReport, useSubmitReview } from '@/api';
import { useT } from '@/i18n';
import type { ReportTarget, WorkerSummary } from '@/types';

export const WorkerCard = memo(function WorkerCard({ w }: { w: WorkerSummary }) {
  const nav = useNavigate();
  const t = useT();
  return (
    <Card onClick={() => nav(`/worker/${w.id}`)} className="flex gap-3 p-3">
      <div className="relative">
        <Avatar src={w.photo} name={w.name} size={64} className="rounded-2xl" />
        <span className={cn('absolute -right-0.5 -bottom-0.5 size-4 rounded-full border-2 border-surface', w.available ? 'bg-success' : 'bg-ink-3')} title={w.available ? t('available') : t('busy')} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <h3 className="truncate font-bold text-ink">{w.name}</h3>
          <VerifiedBadge type={w.verification} compact />
        </div>
        <p className="truncate text-sm text-ink-2">
          {w.categoryName}{w.experienceYrs > 0 && ` · ${w.experienceYrs} ${t('years')}`}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-sm">
          <Rating value={w.rating} count={w.reviewCount} />
          <span className="flex min-w-0 items-center gap-0.5 text-ink-2"><MapPin size={13} className="shrink-0" /><span className="truncate">{km(w.distanceKm)} · {w.locality}</span></span>
        </div>
        {w.skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {w.skills.slice(0, 3).map((s) => <Badge key={s}>{s}</Badge>)}
          </div>
        )}
      </div>
      {w.priceRange && <span className="self-start text-xs font-semibold whitespace-nowrap text-ink-2">{w.priceRange}</span>}
    </Card>
  );
});

export { LocationSheet } from './LocationSheet';

const REASONS = ['Fake profile', 'Fraud / scam', 'Abusive behaviour', 'Spam', 'Inappropriate content', 'Other'];
export function ReportSheet({ open, onClose, targetType, targetId }: { open: boolean; onClose: () => void; targetType: ReportTarget; targetId: string }) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const m = useReport();
  const close = () => { setReason(''); setDetails(''); onClose(); };
  const submit = () =>
    m.mutate(
      { targetType, targetId, reason, details: details.trim() || undefined },
      {
        onSuccess: (r) => { toast(`${t('reportSubmitted')} (#${r.id})`); close(); },
        onError: (e) => { toastError(e); if (isApiError(e, 'FEATURE_DISABLED')) close(); },
      },
    );
  return (
    <Sheet open={open} onClose={close} title={t('report')}>
      <p className="mb-3 text-sm text-ink-2">{t('reportWhy')}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {REASONS.map((r) => <Chip key={r} active={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}
      </div>
      <Textarea placeholder={t('addDetails')} value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} />
      <Button block className="mt-4" disabled={!reason} loading={m.isPending} onClick={submit}>{t('submitReport')}</Button>
    </Sheet>
  );
}

export function ReviewSheet({ open, onClose, workerId, workerName }: { open: boolean; onClose: () => void; workerId: string; workerName?: string }) {
  const t = useT();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const m = useSubmitReview();
  const close = () => { setStars(0); setText(''); onClose(); };
  return (
    <Sheet open={open} onClose={close} title={t('rateExperience')}>
      {workerName && <p className="-mt-1 mb-3 text-sm text-ink-2">{workerName}</p>}
      <div className="mb-4 flex justify-center gap-2" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} type="button" role="radio" aria-checked={stars === s} aria-label={`${s} stars`} onClick={() => setStars(s)}
            className={cn('text-4xl transition active:scale-90', s <= stars ? 'text-accent' : 'text-line')}>★</button>
        ))}
      </div>
      <Textarea placeholder={t('reviewPlaceholder')} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
      <p className="mt-2 text-xs text-ink-3">{t('reviewRule')}</p>
      <Button block className="mt-4" disabled={!stars} loading={m.isPending}
        onClick={() => m.mutate({ workerId, stars, text: text.trim() }, {
          onSuccess: () => { toast(t('reviewThanks')); close(); },
          onError: (e) => { toastError(e); if (isApiError(e, 'DUPLICATE_REVIEW') || isApiError(e, 'REVIEW_NOT_ALLOWED') || isApiError(e, 'FEATURE_DISABLED')) close(); },
        })}>
        {t('submit')}
      </Button>
    </Sheet>
  );
}

/** Full-screen photo viewer (portfolio / chat images). */
export function ImageViewer({ src, onClose }: { src: string | null; onClose: () => void }) {
  if (!src) return null;
  return (
    <div className="animate-fade fixed inset-0 z-[55] flex items-center justify-center bg-black/90 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onClose} className="pt-safe absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-white/15 text-white"><X size={22} /></button>
      <img src={mediaUrl(src)} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
    </div>
  );
}

/**
 * Hidden file input + validation. `children` renders the trigger; call `open()` from it.
 * Invalid files are rejected client-side with a toast (server re-checks the content).
 */
export function FilePicker({ onFiles, multiple, allowPdf, max, children }: {
  onFiles: (files: File[]) => void; multiple?: boolean; allowPdf?: boolean; max?: number; children: (open: () => void) => ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref} type="file" hidden multiple={multiple}
        accept={`image/jpeg,image/png,image/webp${allowPdf ? ',application/pdf' : ''}`}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = '';
          const ok: File[] = [];
          for (const f of picked) {
            const err = checkImage(f, 5, allowPdf);
            if (err) toast(`${f.name}: ${err}`, 'error');
            else ok.push(f);
          }
          if (max !== undefined && ok.length > max) toast(`You can add ${max} more file${max === 1 ? '' : 's'}`, 'error');
          const files = max !== undefined ? ok.slice(0, Math.max(0, max)) : ok;
          if (files.length) onFiles(files);
        }}
      />
      {children(() => ref.current?.click())}
    </>
  );
}
