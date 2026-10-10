import { memo, useState } from 'react';
import { useNavigate } from 'react-router';
import { MapPin } from 'lucide-react';
import { Avatar, Badge, Button, Card, Chip, Rating, Sheet, Textarea, VerifiedBadge } from './ui';
import { km } from '@/lib/format';
import { toast } from '@/store';
import { useReport } from '@/api';
import { useT } from '@/i18n';
import type { WorkerSummary } from '@/types';

export const WorkerCard = memo(function WorkerCard({ w }: { w: WorkerSummary }) {
  const nav = useNavigate();
  const t = useT();
  return (
    <Card onClick={() => nav(`/worker/${w.id}`)} className="flex gap-3 p-3">
      <div className="relative">
        <Avatar src={w.photo} name={w.name} size={64} className="rounded-2xl" />
        <span className={`absolute -right-0.5 -bottom-0.5 size-4 rounded-full border-2 border-surface ${w.available ? 'bg-success' : 'bg-ink-3'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <h3 className="truncate font-bold">{w.name}</h3>
          <VerifiedBadge type={w.verification} compact />
        </div>
        <p className="text-sm text-ink-2">
          {w.categoryName} · {w.experienceYrs} {t('years')}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-sm">
          <Rating value={w.rating} count={w.reviewCount} />
          <span className="flex items-center gap-0.5 text-ink-2"><MapPin size={13} />{km(w.distanceKm)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {w.skills.slice(0, 3).map((s) => <Badge key={s}>{s}</Badge>)}
        </div>
      </div>
      {w.priceRange && <span className="self-start text-xs font-semibold whitespace-nowrap text-ink-2">{w.priceRange}</span>}
    </Card>
  );
});

export { LocationSheet } from './LocationSheet';

const REASONS = ['Fake profile', 'Fraud / scam', 'Abusive behaviour', 'Spam', 'Inappropriate content', 'Other'];
export function ReportSheet({ open, onClose, targetType, targetId }: { open: boolean; onClose: () => void; targetType: string; targetId: string }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const m = useReport();
  const submit = () =>
    m.mutate({ targetType, targetId, reason, details }, { onSuccess: () => { toast('Report submitted. Our team will review it.'); onClose(); } });
  return (
    <Sheet open={open} onClose={onClose} title="Report">
      <div className="mb-4 flex flex-wrap gap-2">
        {REASONS.map((r) => <Chip key={r} active={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}
      </div>
      <Textarea placeholder="Add details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
      <Button block className="mt-4" variant="danger" disabled={!reason} loading={m.isPending} onClick={submit}>Submit report</Button>
    </Sheet>
  );
}
