import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowDown, ArrowUp, Check, ExternalLink, FileText, GalleryHorizontalEnd, HelpCircle, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui';
import { ak, errText, useAdminBanners, useAdminFaqs, useAdminPages, useDeleteBanner, useDeleteFaq, useSaveBanner, useSaveFaq, useSavePage } from '@/api/admin';
import { toast } from '@/store';
import { cn, timeAgo } from '@/lib/format';
import type { AdminBanner, AdminFaq, AdminLegalPage, BannerInput, FaqInput, LegalSlug } from '@/types/admin';
import { dateTime } from '../lib';
import { Btn, ConfirmDialog, Drawer, EmptyBlock, ErrorBlock, Field, IconBtn, MicroLabel, PageHeader, Switch, Tabs, TextAreaField, TextField } from '../components/kit';

type Tab = 'banners' | 'faqs' | 'legal';

export function CmsPage() {
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') ?? 'banners') as Tab;
  return (
    <>
      <PageHeader eyebrow="Content" title="CMS" sub="Home banners, help-centre FAQs and the legal pages users accept. Changes are live in the app right away." />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(t) => setSp(t === 'banners' ? {} : { tab: t }, { replace: true })}
        items={[
          { value: 'banners', label: 'Banners', icon: <GalleryHorizontalEnd size={15} /> },
          { value: 'faqs', label: 'FAQs', icon: <HelpCircle size={15} /> },
          { value: 'legal', label: 'Legal pages', icon: <FileText size={15} /> },
        ]}
      />
      {tab === 'banners' && <BannersTab />}
      {tab === 'faqs' && <FaqsTab />}
      {tab === 'legal' && <LegalTab />}
    </>
  );
}

/** Re-number `sort` after a move; only rows whose position changed are PATCHed. */
function useReorder<T extends { id: string; sort: number }>(save: (v: { id: string; body: { sort: number } }) => Promise<unknown>, key: readonly unknown[]) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const move = async (list: T[], index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[index], next[j]] = [next[j]!, next[index]!];
    const changes = next.map((x, i) => ({ x, sort: i })).filter(({ x, sort }) => x.sort !== sort);
    setBusy(true);
    qc.setQueryData<T[]>(key, next.map((x, i) => ({ ...x, sort: i })));
    try {
      await Promise.all(changes.map(({ x, sort }) => save({ id: x.id, body: { sort } })));
      toast('Order updated', 'success');
    } catch (e) {
      toast(errText(e), 'error');
      qc.invalidateQueries({ queryKey: key });
    } finally {
      setBusy(false);
    }
  };
  return { move, busy };
}

// ======================================================================
// Banners
// ======================================================================
const TINTS = [
  { value: 'from-indigo-600 to-violet-500', label: 'Indigo' },
  { value: 'from-emerald-600 to-teal-500', label: 'Emerald' },
  { value: 'from-amber-500 to-orange-500', label: 'Amber' },
  { value: 'from-rose-500 to-pink-500', label: 'Rose' },
  { value: 'from-sky-500 to-blue-600', label: 'Sky' },
  { value: 'from-violet-600 to-fuchsia-500', label: 'Violet' },
  { value: 'from-slate-700 to-slate-900', label: 'Slate' },
];

function BannerPreview({ b, className }: { b: Pick<AdminBanner, 'title' | 'subtitle' | 'tint' | 'link'>; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white', b.tint || TINTS[0]!.value, className)}>
      <div className="pointer-events-none absolute -top-10 -right-8 size-32 rounded-full bg-white/15" aria-hidden />
      <div className="pointer-events-none absolute -bottom-12 right-16 size-24 rounded-full bg-white/10" aria-hidden />
      <p className="relative text-lg leading-snug font-extrabold">{b.title || 'Banner title'}</p>
      <p className="relative mt-1 text-sm text-white/85">{b.subtitle || 'Short supporting line'}</p>
      {b.link && <span className="relative mt-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold"><ExternalLink size={11} />{b.link}</span>}
    </div>
  );
}

function BannersTab() {
  const banners = useAdminBanners();
  const save = useSaveBanner();
  const silentSave = useSaveBanner(true);
  const del = useDeleteBanner();
  const [editing, setEditing] = useState<AdminBanner | 'new' | null>(null);
  const [removing, setRemoving] = useState<AdminBanner | null>(null);
  const { move, busy } = useReorder<AdminBanner>(silentSave.mutateAsync, ak.banners);
  const list = banners.data ?? [];

  if (banners.isError) return <ErrorBlock error={banners.error} onRetry={() => banners.refetch()} />;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">{list.filter((b) => b.active).length} active of {list.length} · shown on the home screen in this order (when the Banners feature is on).</p>
        <Btn tone="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>New banner</Btn>
      </div>
      {banners.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
      ) : !list.length ? (
        <div className="rounded-2xl border border-line bg-surface"><EmptyBlock icon={<GalleryHorizontalEnd size={26} />} title="No banners yet" sub="Create one to highlight offers or features on the home screen." /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((b, i) => (
            <article key={b.id} className="flex flex-col rounded-2xl border border-line bg-surface p-3">
              <BannerPreview b={b} className={cn(!b.active && 'opacity-45 grayscale-[.4]')} />
              <div className="mt-3 flex items-center gap-2 px-1">
                <Switch checked={b.active} label={`${b.title} active`} disabled={save.isPending} onChange={(v) => save.mutate({ id: b.id, body: { active: v } })} />
                <span className={cn('text-xs font-semibold', b.active ? 'text-success' : 'text-ink-3')}>{b.active ? 'Active' : 'Off'}</span>
                <span className="ml-1 text-[11px] text-ink-3">#{i + 1}</span>
                <div className="ml-auto flex items-center">
                  <IconBtn label="Move earlier" disabled={i === 0 || busy} onClick={() => move(list, i, -1)}><ArrowUp size={15} /></IconBtn>
                  <IconBtn label="Move later" disabled={i === list.length - 1 || busy} onClick={() => move(list, i, 1)}><ArrowDown size={15} /></IconBtn>
                  <IconBtn label={`Edit ${b.title}`} onClick={() => setEditing(b)}><Pencil size={15} /></IconBtn>
                  <IconBtn label={`Delete ${b.title}`} danger onClick={() => setRemoving(b)}><Trash2 size={15} /></IconBtn>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <BannerDrawer
          key={editing === 'new' ? 'new' : editing.id}
          banner={editing === 'new' ? null : editing}
          nextSort={list.length ? Math.max(...list.map((b) => b.sort)) + 1 : 0}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Delete this banner?"
        description={removing && <>“{removing.title}” is removed from the app immediately. To pause it instead, switch it off.</>}
        confirmLabel="Delete banner"
        tone="danger"
        loading={del.isPending}
        onConfirm={() => removing && del.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </>
  );
}

function BannerDrawer({ banner, nextSort, onClose }: { banner: AdminBanner | null; nextSort: number; onClose: () => void }) {
  const save = useSaveBanner();
  const [f, setF] = useState<BannerInput>(() => ({
    title: banner?.title ?? '',
    subtitle: banner?.subtitle ?? '',
    tint: banner?.tint || TINTS[0]!.value,
    link: banner?.link ?? '',
    active: banner?.active ?? true,
    sort: banner?.sort ?? nextSort,
  }));
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof BannerInput>(k: K, v: BannerInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const submit = () => {
    if (f.title.trim().length < 2) return setErr('Title must be at least 2 characters');
    const link = f.link?.trim();
    if (link && !/^(\/(?!\/)|https:\/\/)/.test(link)) return setErr('Link must start with / (in-app page) or https://');
    setErr(null);
    save.mutate({ id: banner?.id, body: { ...f, title: f.title.trim(), subtitle: f.subtitle.trim(), link: link || '' } }, { onSuccess: onClose });
  };
  return (
    <Drawer
      open
      onClose={onClose}
      title={banner ? 'Edit banner' : 'New banner'}
      sub="Preview updates as you type"
      footer={
        <>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" loading={save.isPending} onClick={submit}>{banner ? 'Save banner' : 'Create banner'}</Btn>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-5">
        <BannerPreview b={f} />
        <TextField label="Title" data-autofocus maxLength={60} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Zero Commission, Always" hint={`${f.title.length}/60`} />
        <TextField label="Subtitle" maxLength={120} value={f.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="e.g. Pay workers directly. No hidden cuts." hint={`${f.subtitle.length}/120`} />
        <TextField label="Link (optional)" maxLength={120} value={f.link ?? ''} onChange={(e) => set('link', e.target.value)} placeholder="/onboarding or https://…" hint="Where a tap on the banner goes." />
        <Field label="Colour">
          <div role="radiogroup" aria-label="Banner colour" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {TINTS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={f.tint === t.value}
                aria-label={t.label}
                title={t.label}
                onClick={() => set('tint', t.value)}
                className={cn('grid h-11 place-items-center rounded-xl bg-gradient-to-br text-white transition', t.value, f.tint === t.value ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : 'opacity-85 hover:opacity-100')}
              >
                {f.tint === t.value && <Check size={16} />}
              </button>
            ))}
          </div>
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-line p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Active</p>
            <p className="text-xs text-ink-3">Inactive banners are kept but not shown.</p>
          </div>
          <Switch checked={f.active} onChange={(v) => set('active', v)} label="Banner active" />
        </div>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}

// ======================================================================
// FAQs
// ======================================================================
function FaqsTab() {
  const faqs = useAdminFaqs();
  const save = useSaveFaq();
  const silentSave = useSaveFaq(true);
  const del = useDeleteFaq();
  const [editing, setEditing] = useState<AdminFaq | 'new' | null>(null);
  const [removing, setRemoving] = useState<AdminFaq | null>(null);
  const { move, busy } = useReorder<AdminFaq>(silentSave.mutateAsync, ak.faqs);
  const list = faqs.data ?? [];

  if (faqs.isError) return <ErrorBlock error={faqs.error} onRetry={() => faqs.refetch()} />;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">{list.filter((f) => f.active).length} of {list.length} questions shown in Help.</p>
        <Btn tone="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>Add FAQ</Btn>
      </div>
      {faqs.isPending ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : !list.length ? (
        <div className="rounded-2xl border border-line bg-surface"><EmptyBlock icon={<HelpCircle size={26} />} title="No FAQs yet" /></div>
      ) : (
        <ol className="space-y-2">
          {list.map((f, i) => (
            <li key={f.id} className={cn('flex gap-3 rounded-2xl border border-line bg-surface p-4', !f.active && 'opacity-70')}>
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{f.q}</p>
                <p className="mt-1 line-clamp-2 text-sm text-ink-2">{f.a}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <Switch checked={f.active} label={`Show “${f.q}”`} disabled={save.isPending} onChange={(v) => save.mutate({ id: f.id, body: { active: v } })} />
                  <span className={cn('mr-2 ml-1 text-xs font-semibold', f.active ? 'text-success' : 'text-ink-3')}>{f.active ? 'Shown' : 'Hidden'}</span>
                  <IconBtn label="Move up" disabled={i === 0 || busy} onClick={() => move(list, i, -1)}><ArrowUp size={15} /></IconBtn>
                  <IconBtn label="Move down" disabled={i === list.length - 1 || busy} onClick={() => move(list, i, 1)}><ArrowDown size={15} /></IconBtn>
                  <IconBtn label="Edit FAQ" onClick={() => setEditing(f)}><Pencil size={15} /></IconBtn>
                  <IconBtn label="Delete FAQ" danger onClick={() => setRemoving(f)}><Trash2 size={15} /></IconBtn>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {editing && (
        <FaqDrawer
          key={editing === 'new' ? 'new' : editing.id}
          faq={editing === 'new' ? null : editing}
          nextSort={list.length ? Math.max(...list.map((f) => f.sort)) + 1 : 0}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Delete this FAQ?"
        description={removing?.q}
        confirmLabel="Delete"
        tone="danger"
        loading={del.isPending}
        onConfirm={() => removing && del.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </>
  );
}

function FaqDrawer({ faq, nextSort, onClose }: { faq: AdminFaq | null; nextSort: number; onClose: () => void }) {
  const save = useSaveFaq();
  const [f, setF] = useState<FaqInput>(() => ({ q: faq?.q ?? '', a: faq?.a ?? '', active: faq?.active ?? true, sort: faq?.sort ?? nextSort }));
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    if (f.q.trim().length < 5) return setErr('Question must be at least 5 characters');
    if (f.a.trim().length < 5) return setErr('Answer must be at least 5 characters');
    setErr(null);
    save.mutate({ id: faq?.id, body: { ...f, q: f.q.trim(), a: f.a.trim() } }, { onSuccess: onClose });
  };
  return (
    <Drawer
      open
      onClose={onClose}
      title={faq ? 'Edit FAQ' : 'Add FAQ'}
      footer={
        <>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" loading={save.isPending} onClick={submit}>{faq ? 'Save' : 'Add FAQ'}</Btn>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
        <TextField label="Question" data-autofocus maxLength={200} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="e.g. Does WorkNear take commission?" />
        <TextAreaField label="Answer" rows={7} maxLength={1500} value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })} hint={`${f.a.length}/1500`} />
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-line p-4">
          <p className="text-sm font-semibold text-ink">Show in Help</p>
          <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Show in Help" />
        </div>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}

// ======================================================================
// Legal pages
// ======================================================================
const SLUGS: { value: LegalSlug; label: string }[] = [
  { value: 'terms', label: 'Terms of use' },
  { value: 'privacy', label: 'Privacy' },
  { value: 'refund', label: 'Refunds' },
  { value: 'safety', label: 'Safety' },
];

function LegalTab() {
  const pages = useAdminPages();
  const [slug, setSlug] = useState<LegalSlug>('terms');
  const [dirty, setDirty] = useState(false);
  const [pendingSlug, setPendingSlug] = useState<LegalSlug | null>(null);
  const page: AdminLegalPage = pages.data?.find((p) => p.slug === slug) ?? { slug, title: SLUGS.find((s) => s.value === slug)!.label, body: [''] };

  const pick = (s: LegalSlug) => (dirty ? setPendingSlug(s) : setSlug(s));

  if (pages.isError) return <ErrorBlock error={pages.error} onRetry={() => pages.refetch()} />;
  return (
    <>
      <Tabs className="mb-4" value={slug} onChange={pick} items={SLUGS} />
      {pages.isPending ? <Skeleton className="h-96 rounded-2xl" /> : <LegalEditor key={`${slug}-${page.updatedAt ?? ''}`} page={page} onDirty={setDirty} />}
      <ConfirmDialog
        open={!!pendingSlug}
        onClose={() => setPendingSlug(null)}
        title="Discard unsaved changes?"
        description="Your edits to this page haven't been published."
        confirmLabel="Discard"
        tone="danger"
        onConfirm={() => {
          setDirty(false);
          setSlug(pendingSlug!);
          setPendingSlug(null);
        }}
      />
    </>
  );
}

function LegalEditor({ page, onDirty }: { page: AdminLegalPage; onDirty: (d: boolean) => void }) {
  const save = useSavePage();
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState<string[]>(page.body.length ? page.body : ['']);
  const [err, setErr] = useState<string | null>(null);
  const dirty = title !== page.title || JSON.stringify(body) !== JSON.stringify(page.body);

  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const update = (fn: (b: string[]) => string[]) => setBody((b) => fn(b));
  const moveP = (i: number, d: -1 | 1) =>
    update((b) => {
      const n = [...b];
      [n[i], n[i + d]] = [n[i + d]!, n[i]!];
      return n;
    });
  const publish = () => {
    const paras = body.map((p) => p.trim()).filter(Boolean);
    if (title.trim().length < 2) return setErr('Title must be at least 2 characters');
    if (!paras.length) return setErr('Add at least one paragraph');
    setErr(null);
    save.mutate({ slug: page.slug, title: title.trim(), body: paras });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-3">{page.updatedAt ? <>Last published {timeAgo(page.updatedAt)} · {dateTime(page.updatedAt)}</> : 'Not published yet'}</p>
          <Btn tone="primary" icon={<Save size={16} />} loading={save.isPending} disabled={!dirty} onClick={publish}>Publish</Btn>
        </div>
        <TextField label="Page title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
        <MicroLabel className="mt-5 mb-2">Paragraphs ({body.length}/50)</MicroLabel>
        <ol className="space-y-3">
          {body.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2.5 w-5 shrink-0 text-right text-xs font-bold text-ink-3">{i + 1}</span>
              <textarea
                aria-label={`Paragraph ${i + 1}`}
                value={p}
                maxLength={2000}
                rows={Math.min(8, Math.max(2, Math.ceil(p.length / 90)))}
                onChange={(e) => update((b) => b.map((x, j) => (j === i ? e.target.value : x)))}
                className="min-w-0 flex-1 resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <div className="flex flex-col">
                <IconBtn label="Move paragraph up" disabled={i === 0} onClick={() => moveP(i, -1)}><ArrowUp size={14} /></IconBtn>
                <IconBtn label="Move paragraph down" disabled={i === body.length - 1} onClick={() => moveP(i, 1)}><ArrowDown size={14} /></IconBtn>
                <IconBtn label="Remove paragraph" disabled={body.length <= 1} danger onClick={() => update((b) => b.filter((_, j) => j !== i))}><Trash2 size={14} /></IconBtn>
              </div>
            </li>
          ))}
        </ol>
        {body.length < 50 && <Btn size="sm" tone="ghost" className="mt-3" icon={<Plus size={14} />} onClick={() => update((b) => [...b, ''])}>Add paragraph</Btn>}
        {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      </section>

      <aside className="rounded-2xl border border-line bg-surface-2/50 p-5 xl:sticky xl:top-24 xl:self-start">
        <MicroLabel className="mb-3">Preview</MicroLabel>
        <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-surface p-5">
          <h3 className="text-xl font-extrabold text-ink">{title || 'Untitled'}</h3>
          <div className="mt-3 space-y-3">
            {body.filter((p) => p.trim()).map((p, i) => <p key={i} className="text-sm leading-relaxed text-ink-2">{p}</p>)}
          </div>
        </div>
      </aside>
    </div>
  );
}
