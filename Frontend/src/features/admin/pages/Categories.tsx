import { useMemo, useState, type KeyboardEvent } from 'react';
import { Check, LayoutGrid, Pencil, Plus, X } from 'lucide-react';
import { CategoryIcon } from '@/components/ui';
import { useAdminCategories, useSaveCategory, useToggleCategory } from '@/api/admin';
import { cn, num } from '@/lib/format';
import type { AdminCategory, CategoryInput } from '@/types/admin';
import { Btn, DataTable, Drawer, EmptyBlock, ErrorBlock, Field, IconBtn, MicroLabel, PageHeader, SearchField, Switch, TextField, Toolbar, type Column } from '../components/kit';

/** Icon names understood by <CategoryIcon> (the app renders the same set). */
const ICONS = ['zap', 'droplets', 'hammer', 'paint-roller', 'snowflake', 'sparkles', 'wrench', 'scissors', 'book-open', 'car', 'chef-hat', 'brick-wall', 'briefcase'] as const;
const TINTS = ['#e0e7ff', '#dbeafe', '#cffafe', '#dcfce7', '#fef3c7', '#fde68a', '#ffedd5', '#ffe4e6', '#fce7f3', '#ede9fe', '#f1f5f9'];

const Tile = ({ icon, tint, size = 40 }: { icon: string; tint: string; size?: number }) => (
  <span className="grid shrink-0 place-items-center rounded-xl text-slate-800 ring-1 ring-black/5" style={{ background: tint || '#e0e7ff', width: size, height: size }}>
    <CategoryIcon name={icon} size={Math.round(size * 0.5)} />
  </span>
);

export function CategoriesPage() {
  const cats = useAdminCategories();
  const toggle = useToggleCategory();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null);

  const rows = useMemo(() => {
    const f = q.trim().toLowerCase();
    const all = cats.data ?? [];
    return f ? all.filter((c) => `${c.name} ${c.nameHi} ${c.skills.join(' ')}`.toLowerCase().includes(f)) : all;
  }, [cats.data, q]);
  const activeCount = cats.data?.filter((c) => c.active).length ?? 0;

  const columns: Column<AdminCategory>[] = [
    {
      key: 'name',
      header: 'Category',
      mobile: 'title',
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Tile icon={c.icon} tint={c.tint} />
          <div className="min-w-0">
            <p className="font-semibold text-ink">{c.name}</p>
            <p className="font-mono text-[11px] text-ink-3">{c.id}</p>
          </div>
        </div>
      ),
    },
    { key: 'hi', header: 'Hindi name', cell: (c) => <span lang="hi" className="text-ink-2">{c.nameHi || '—'}</span> },
    {
      key: 'skills',
      header: 'Skills',
      cell: (c) => (
        <div className="flex max-w-xs flex-wrap items-center gap-1">
          {c.skills.slice(0, 3).map((s) => <span key={s} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">{s}</span>)}
          {c.skills.length > 3 && <span className="text-[11px] font-semibold text-ink-3">+{c.skills.length - 3}</span>}
          {!c.skills.length && <span className="text-ink-3">—</span>}
        </div>
      ),
    },
    { key: 'workers', header: 'Workers', align: 'right', cell: (c) => <b className="tabular-nums">{num(c.workerCount)}</b> },
    {
      key: 'active',
      header: 'Active',
      cell: (c) => (
        <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2">
          <Switch checked={c.active} label={`${c.name} active`} onChange={(v) => toggle.mutate({ id: c.id, active: v })} />
          <span className={cn('text-xs font-semibold', c.active ? 'text-success' : 'text-ink-3')}>{c.active ? 'Live' : 'Hidden'}</span>
        </span>
      ),
    },
    {
      key: 'edit',
      header: <span className="sr-only">Edit</span>,
      align: 'right',
      mobile: 'hide',
      cell: (c) => <IconBtn label={`Edit ${c.name}`} onClick={(e) => { e.stopPropagation(); setEditing(c); }}><Pencil size={16} /></IconBtn>,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Categories"
        sub={cats.data ? `${activeCount} of ${cats.data.length} categories are live in the app. Hidden categories disappear from search and onboarding.` : 'Service categories shown in the app.'}
        actions={<Btn tone="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>New category</Btn>}
      />
      <Toolbar>
        <SearchField value={q} onChange={setQ} placeholder="Filter by name or skill…" label="Filter categories" />
      </Toolbar>
      {cats.isError ? (
        <ErrorBlock error={cats.error} onRetry={() => cats.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(c) => c.id}
          loading={cats.isPending}
          onRowClick={(c) => setEditing(c)}
          rowLabel={(c) => `Edit ${c.name}`}
          empty={<EmptyBlock icon={<LayoutGrid size={26} />} title={q ? 'No category matches' : 'No categories yet'} sub={q ? undefined : 'Create the first service category.'} />}
        />
      )}
      {editing && <CategoryDrawer key={editing === 'new' ? 'new' : editing.id} cat={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function CategoryDrawer({ cat, onClose }: { cat: AdminCategory | null; onClose: () => void }) {
  const save = useSaveCategory();
  const [f, setF] = useState<CategoryInput>(() => ({
    name: cat?.name ?? '',
    nameHi: cat?.nameHi ?? '',
    icon: cat?.icon ?? 'briefcase',
    tint: cat?.tint ?? TINTS[0]!,
    skills: cat?.skills ?? [],
    active: cat?.active ?? true,
  }));
  const [skill, setSkill] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof CategoryInput>(k: K, v: CategoryInput[K]) => setF((p) => ({ ...p, [k]: v }));

  const addSkill = () => {
    const parts = skill.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setF((p) => {
      const have = new Set(p.skills.map((s) => s.toLowerCase()));
      const next = [...p.skills];
      for (const s of parts) if (!have.has(s.toLowerCase()) && next.length < 30) { next.push(s.slice(0, 40)); have.add(s.toLowerCase()); }
      return { ...p, skills: next };
    });
    setSkill('');
  };
  const onSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill();
    } else if (e.key === 'Backspace' && !skill && f.skills.length) set('skills', f.skills.slice(0, -1));
  };

  const submit = () => {
    const name = f.name.trim();
    if (name.length < 2) return setErr('Name must be at least 2 characters');
    setErr(null);
    const body = { ...f, name, nameHi: f.nameHi.trim(), skills: skill.trim() ? [...f.skills, skill.trim()] : f.skills };
    save.mutate({ id: cat?.id, body }, { onSuccess: onClose });
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={cat ? `Edit ${cat.name}` : 'New category'}
      sub={cat ? <>ID <span className="font-mono text-xs">{cat.id}</span> · {num(cat.workerCount)} workers</> : 'The ID is generated from the English name.'}
      footer={
        <>
          <Btn tone="ghost" onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" loading={save.isPending} onClick={submit}>{cat ? 'Save changes' : 'Create category'}</Btn>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-5">
        {/* Live preview */}
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface-2/60 p-4">
          <Tile icon={f.icon} tint={f.tint} size={56} />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-ink">{f.name || 'Category name'}</p>
            <p lang="hi" className="truncate text-sm text-ink-2">{f.nameHi || 'हिंदी नाम'}</p>
          </div>
          <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold', f.active ? 'bg-success-soft text-success' : 'bg-surface-3 text-ink-3')}>{f.active ? 'Live' : 'Hidden'}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name (English)" data-autofocus value={f.name} maxLength={40} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Electrician" error={err ?? undefined} />
          <TextField label="Name (Hindi)" lang="hi" value={f.nameHi} maxLength={40} onChange={(e) => set('nameHi', e.target.value)} placeholder="e.g. इलेक्ट्रीशियन" />
        </div>

        <Field label="Icon">
          <div role="radiogroup" aria-label="Icon" className="grid grid-cols-5 gap-2 sm:grid-cols-7">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={f.icon === i}
                aria-label={i}
                title={i}
                onClick={() => set('icon', i)}
                className={cn('grid aspect-square place-items-center rounded-xl border transition', f.icon === i ? 'border-primary bg-primary-soft text-primary ring-2 ring-primary/20' : 'border-line text-ink-2 hover:bg-surface-2 hover:text-ink')}
              >
                <CategoryIcon name={i} size={20} />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Tile colour" hint="Pastel tints keep icons readable in light and dark mode.">
          <div className="flex flex-wrap items-center gap-2">
            {TINTS.map((t) => (
              <button
                key={t}
                type="button"
                aria-label={`Tint ${t}`}
                aria-pressed={f.tint.toLowerCase() === t}
                onClick={() => set('tint', t)}
                className={cn('grid size-8 place-items-center rounded-full ring-1 ring-black/10 transition', f.tint.toLowerCase() === t && 'ring-2 ring-primary ring-offset-2 ring-offset-surface')}
                style={{ background: t }}
              >
                {f.tint.toLowerCase() === t && <Check size={14} className="text-slate-800" />}
              </button>
            ))}
            <label className="relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-ink-3 text-[10px] font-bold text-ink-3" title="Custom colour">
              +
              <input type="color" aria-label="Custom tint" value={/^#[0-9a-f]{6}$/i.test(f.tint) ? f.tint : '#e0e7ff'} onChange={(e) => set('tint', e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
          </div>
        </Field>

        <Field label={`Skills (${f.skills.length}/30)`} hint="Press Enter or comma to add. Workers pick from these when creating a profile.">
          <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            {f.skills.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-primary-soft py-1 pr-1 pl-2 text-xs font-semibold text-primary">
                {s}
                <button type="button" aria-label={`Remove ${s}`} onClick={() => set('skills', f.skills.filter((x) => x !== s))} className="grid size-4 place-items-center rounded hover:bg-primary/15">
                  <X size={11} />
                </button>
              </span>
            ))}
            <input
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              onKeyDown={onSkillKey}
              onBlur={addSkill}
              maxLength={40}
              disabled={f.skills.length >= 30}
              aria-label="Add skill"
              placeholder={f.skills.length ? 'Add more…' : 'e.g. Wiring, Fan installation'}
              className="h-8 min-w-36 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-3"
            />
          </div>
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-line p-4">
          <div>
            <MicroLabel>Visibility</MicroLabel>
            <p className="mt-1 text-sm text-ink-2">Live categories appear in search, home and worker onboarding.</p>
          </div>
          <Switch checked={f.active} onChange={(v) => set('active', v)} label="Category active" />
        </div>
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
