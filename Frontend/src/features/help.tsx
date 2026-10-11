import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ChevronDown, FileText, Mail, MessageSquareWarning, Paperclip, Phone, X } from 'lucide-react';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Skeleton, Textarea, TopBar, type Tone } from '@/components/ui';
import { FilePicker } from '@/components/shared';
import { errorMessage, fieldErrors, isApiError, toastError, useCreateComplaint, useFaqs, useLegalPage, useMyComplaints } from '@/api';
import { useFeature, toast } from '@/store';
import { useSupport } from '@/hooks/useAppSettings';
import { useT } from '@/i18n';
import { cn, date } from '@/lib/format';
import type { ComplaintStatus } from '@/types';

const statusTone: Record<ComplaintStatus, Tone> = { open: 'warning', in_progress: 'primary', resolved: 'success', escalated: 'danger' };
export const ComplaintStatusBadge = ({ s }: { s: ComplaintStatus }) => <Badge tone={statusTone[s] ?? 'neutral'}>{s.replace('_', ' ')}</Badge>;

export function Help() {
  const t = useT();
  const nav = useNavigate();
  const complaintsOn = useFeature('complaints');
  const support = useSupport();
  const faqs = useFaqs();
  const complaints = useMyComplaints(complaintsOn);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="min-h-dvh">
      <TopBar title={t('helpSupport')} />
      <div className="space-y-5 p-4">
        <div className={cn('grid gap-3', complaintsOn ? 'grid-cols-2' : 'grid-cols-1')}>
          {complaintsOn && (
            <Card onClick={() => nav('/help/complaint')} className="p-4">
              <MessageSquareWarning className="mb-2 text-primary" /><b className="text-sm">{t('raiseComplaint')}</b>
            </Card>
          )}
          <a href={`mailto:${support.email}`} className="block rounded-card border border-line/70 bg-surface p-4 active:scale-[.99]">
            <Mail className="mb-2 text-primary" /><b className="block text-sm">{t('contactUs')}</b><span className="block truncate text-xs text-ink-2">{support.email}</span>
          </a>
        </div>
        {support.phone && (
          <a href={`tel:${support.phone.replace(/\s/g, '')}`} className="flex items-center gap-3 rounded-card border border-line/70 bg-surface p-4">
            <Phone className="text-primary" /><b className="flex-1 text-sm">{t('callSupport')}</b><span className="text-sm text-ink-2">{support.phone}</span>
          </a>
        )}

        {complaintsOn && (
          <section>
            <h2 className="mb-2 font-bold">{t('myComplaints')}</h2>
            {complaints.isLoading ? <Skeleton className="h-20" /> : complaints.isError ? (
              <ErrorState message={errorMessage(complaints.error)} onRetry={() => complaints.refetch()} />
            ) : complaints.data?.length ? (
              <Card className="divide-y divide-line">
                {complaints.data.map((c) => (
                  <div key={c.id} className="p-3.5">
                    <div className="flex items-center justify-between gap-2"><b className="min-w-0 truncate text-sm">#{c.id} · {c.category}</b><ComplaintStatusBadge s={c.status} /></div>
                    <p className="mt-1 line-clamp-3 text-sm text-ink-2">{c.description}</p>
                    {c.resolution && <p className="mt-1.5 rounded-lg bg-success-soft px-2.5 py-1.5 text-xs text-ink"><b className="text-success">{t('resolution')}:</b> {c.resolution}</p>}
                    <span className="mt-1 block text-xs text-ink-3">{date(c.createdAt)}</span>
                  </div>
                ))}
              </Card>
            ) : (
              <p className="rounded-xl bg-surface-2 p-4 text-center text-sm text-ink-2">{t('noComplaints')}</p>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-2 font-bold">{t('faqs')}</h2>
          {faqs.isLoading ? <Skeleton className="h-40" /> : faqs.isError ? (
            <ErrorState message={errorMessage(faqs.error)} onRetry={() => faqs.refetch()} />
          ) : (
            <Card className="divide-y divide-line">
              {faqs.data?.map((f) => (
                <button key={f.id} onClick={() => setOpen(open === f.id ? null : f.id)} aria-expanded={open === f.id} className="block w-full p-3.5 text-left">
                  <span className="flex items-center gap-2"><b className="flex-1 text-sm">{f.q}</b><ChevronDown size={18} className={cn('shrink-0 text-ink-3 transition', open === f.id && 'rotate-180')} /></span>
                  {open === f.id && <p className="mt-2 text-sm text-ink-2">{f.a}</p>}
                </button>
              ))}
            </Card>
          )}
        </section>
        <p className="text-center text-xs text-ink-3">{t('urgentNote')} {support.email}</p>
      </div>
    </div>
  );
}

const CATS = ['Fake profile', 'Fraud', 'Abusive behaviour', 'Payment / subscription', 'App issue', 'Other'];
export function ComplaintForm() {
  const t = useT();
  const nav = useNavigate();
  const on = useFeature('complaints');
  const [category, setCat] = useState('');
  const [description, setDesc] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const m = useCreateComplaint();
  if (!on) return <Navigate to="/help" replace />;
  const errs = fieldErrors(m.error);
  const len = description.trim().length;
  const submit = () =>
    m.mutate(
      { category, description: description.trim(), targetType: category === 'Fraud' ? 'fraud' : 'other', files },
      {
        onSuccess: (c) => { toast(`${t('complaintSubmitted')} #${c.id}`); nav('/help', { replace: true }); },
        onError: (e) => { if (!Object.keys(fieldErrors(e)).length || isApiError(e, 'FEATURE_DISABLED')) toastError(e); },
      },
    );
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopBar title={t('raiseComplaint')} />
      <div className="flex-1 space-y-4 p-4">
        <p className="text-sm font-medium text-ink-2">{t('category')}</p>
        <div className="flex flex-wrap gap-2">{CATS.map((c) => <Chip key={c} active={category === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
        {errs.category && <p className="text-xs text-danger">{errs.category}</p>}
        <Textarea label={t('describeIssue')} value={description} maxLength={2000} rows={5} onChange={(e) => setDesc(e.target.value)}
          error={errs.description} hint={`${len}/2000${len < 10 ? ` · ${t('min10')}` : ''}`} />
        <div>
          <p className="mb-2 text-sm font-medium text-ink-2">{t('evidence')} <span className="text-ink-3">({t('optional')}, {files.length}/3)</span></p>
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <FileText size={16} className="shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate">{f.name}</span>
                <button aria-label={t('remove')} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-full text-ink-3"><X size={16} /></button>
              </div>
            ))}
            {files.length < 3 && (
              <FilePicker multiple allowPdf max={3 - files.length} onFiles={(fs) => setFiles((p) => [...p, ...fs].slice(0, 3))}>
                {(open) => (
                  <button type="button" onClick={open} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-4 text-sm text-ink-2">
                    <Paperclip size={16} />{t('attachEvidence')}
                  </button>
                )}
              </FilePicker>
            )}
          </div>
          <p className="mt-1.5 text-xs text-ink-3">{t('evidenceHint')}</p>
        </div>
      </div>
      <div className="pb-safe sticky bottom-0 border-t border-line bg-surface p-3 dark:shadow-[0_-10px_28px_-14px_rgba(0,0,0,0.9)]">
        <Button size="lg" block disabled={!category || len < 10} loading={m.isPending} onClick={submit}>{t('submit')}</Button>
      </div>
    </div>
  );
}

export function Legal() {
  const t = useT();
  const { slug = 'terms' } = useParams();
  const { data, isLoading, error, refetch } = useLegalPage(slug);
  return (
    <div className="min-h-dvh bg-surface">
      <TopBar title={data?.title ?? (isLoading ? '' : t('legal'))} />
      {isLoading && <div className="space-y-3 p-5"><Skeleton className="h-4 w-40" />{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>}
      {error && (isApiError(error, 'NOT_FOUND')
        ? <EmptyState icon={<FileText size={32} />} title={t('pageNotFound')} />
        : <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />)}
      {data && (
        <article className="space-y-3 p-5 text-[15px] leading-relaxed text-ink-2">
          <p className="text-xs text-ink-3">{t('lastUpdated')}: {date(data.updatedAt)}</p>
          {data.body.map((p, i) => <p key={i}><b className="text-ink">{i + 1}.</b> {p}</p>)}
        </article>
      )}
    </div>
  );
}
