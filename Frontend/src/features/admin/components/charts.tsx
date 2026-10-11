// Dashboard charts (recharts). Series colours come from a palette validated for CVD separation in both themes;
// axes, grid, cursor and tooltip use design tokens (see components/styles.tsx), so they switch with the theme.
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertOctagon, CheckCircle2, CircleDot, Loader } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/store';
import { cn, inr, num } from '@/lib/format';
import type { AdminKpis, ComplaintStatus } from '@/types/admin';
import { compact } from '../lib';

// Categorical order validated with the dataviz palette checker (adjacent CVD ΔE ≥ 10, lightness band per theme).
const PALETTE = {
  light: ['#4f46e5', '#f59e0b', '#0ea5e9', '#e11d48', '#a855f7', '#10b981', '#ea580c'],
  dark: ['#6366f1', '#d97706', '#0284c7', '#e11d48', '#a855f7', '#059669', '#ea580c'],
} as const;
const OTHER = { light: '#94a3b8', dark: '#4b5268' } as const;

export function useChartColors() {
  const mode = useTheme((s) => s.mode);
  return { series: PALETTE[mode], other: OTHER[mode] };
}

interface TipLine { label: string; value: string; color?: string }
// recharts hands the tooltip loosely-typed payload entries (any[]).
function ChartTip({ active, payload, label, lines }: { active?: boolean; payload?: any[]; label?: string | number; lines: (d: any) => TipLine[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="min-w-40 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs text-ink shadow-xl shadow-black/10">
      {label !== undefined && <p className="mb-1.5 font-bold">{label}</p>}
      <ul className="space-y-1">
        {lines(d).map((l) => (
          <li key={l.label} className="flex items-center gap-2">
            {l.color && <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: l.color }} />}
            <span className="flex-1 text-ink-2">{l.label}</span>
            <b className="tabular-nums">{l.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

const LegendKey = ({ color, label, value }: { color: string; label: string; value?: string }) => (
  <span className="inline-flex items-center gap-2 text-xs text-ink-2">
    <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
    {label}
    {value && <b className="text-ink tabular-nums">{value}</b>}
  </span>
);

// ---------- Revenue (area) + payments (bars, own axis = separate small chart) ----------
export function RevenueChart({ data }: { data: AdminKpis['revenueLast6'] }) {
  const { series } = useChartColors();
  const gid = useId().replace(/:/g, '');
  const c = series[0];
  const pay = series[2];
  const total = data.reduce((s, d) => s + d.revenue, 0);
  const payments = data.reduce((s, d) => s + d.payments, 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-2xl font-extrabold tracking-tight text-ink tabular-nums">{inr(total)}</p>
        <p className="text-xs text-ink-3">{num(payments)} successful payment{payments === 1 ? '' : 's'} in 6 months</p>
      </div>
      <div className="adm-chart relative h-52">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}>
          <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={0.3} />
                <stop offset="100%" stopColor={c} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={52} allowDecimals={false} tickFormatter={(v: number) => `₹${compact(v)}`} />
            <Tooltip
              content={(p) => (
                <ChartTip {...p} lines={(d) => [{ label: 'Revenue', value: inr(d.revenue), color: c }, { label: 'Payments', value: num(d.payments), color: pay }]} />
              )}
            />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke={c} strokeWidth={2} fill={`url(#${gid})`} activeDot={{ r: 5, fill: c }} />
          </AreaChart>
        </ResponsiveContainer>
        {total === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-xs font-semibold text-ink-3">No paid subscriptions yet</p>
        )}
      </div>
      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-1 text-[11px] font-semibold text-ink-3">Successful payments per month</p>
        <div className="adm-chart h-24">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={6} />
              <YAxis hide allowDecimals={false} />
              <Tooltip content={(p) => <ChartTip {...p} lines={(d) => [{ label: 'Payments', value: num(d.payments), color: pay }]} />} />
              <Bar dataKey="payments" name="Payments" fill={pay} radius={[4, 4, 0, 0]} maxBarSize={24} minPointSize={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ---------- Sign-ups (grouped bars — accounts vs worker profiles overlap, so they are not stacked) ----------
export function SignupsChart({ data }: { data: AdminKpis['signupsLast7'] }) {
  const { series } = useChartColors();
  const [a, w] = [series[0], series[1]];
  const ta = data.reduce((s, d) => s + d.customers, 0);
  const tw = data.reduce((s, d) => s + d.workers, 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5">
        <LegendKey color={a} label="New accounts" value={num(ta)} />
        <LegendKey color={w} label="New worker profiles" value={num(tw)} />
      </div>
      <div className="adm-chart h-[17.5rem]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}>
          <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} barGap={3} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <Tooltip
              content={(p) => (
                <ChartTip
                  {...p}
                  label={p.payload?.[0]?.payload?.date ? new Date(p.payload[0].payload.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : p.label}
                  lines={(d) => [{ label: 'New accounts', value: num(d.customers), color: a }, { label: 'Worker profiles', value: num(d.workers), color: w }]}
                />
              )}
            />
            <Bar dataKey="customers" name="New accounts" fill={a} radius={[4, 4, 0, 0]} maxBarSize={16} />
            <Bar dataKey="workers" name="Worker profiles" fill={w} radius={[4, 4, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------- Workers by category (donut + clickable legend chips) ----------
export function CategoryDonut({ data }: { data: AdminKpis['workersByCategory'] }) {
  const { series, other } = useChartColors();
  const [picked, setPicked] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const slices = useMemo(() => {
    const sorted = [...data].sort((x, y) => y.count - x.count);
    const top = sorted.slice(0, 6).map((d, i) => ({ ...d, color: series[i]! }));
    const rest = sorted.slice(6);
    return rest.length ? [...top, { id: '__other', name: `Other (${rest.length})`, count: rest.reduce((s, d) => s + d.count, 0), color: other }] : top;
  }, [data, series, other]);
  const total = slices.reduce((s, d) => s + d.count, 0);
  const focus = hover ?? picked;
  const f = focus !== null ? slices[focus] : undefined;

  if (!total) return <p className="py-16 text-center text-sm text-ink-3">No worker profiles yet</p>;
  return (
    <div>
      <div className="adm-chart relative mx-auto h-52 max-w-[260px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="name"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={1.5}
              startAngle={90}
              endAngle={-270}
              onMouseEnter={(_: unknown, i: number) => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={(_: unknown, i: number) => setPicked((p) => (p === i ? null : i))}
              isAnimationActive
            >
              {slices.map((s, i) => (
                <Cell key={s.id} fill={s.color} fillOpacity={focus === null || focus === i ? 1 : 0.28} className="cursor-pointer transition-[fill-opacity]" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[26px] leading-none font-extrabold text-ink tabular-nums">{num(f ? f.count : total)}</p>
            <p className="mt-1 max-w-28 truncate text-[11px] font-semibold text-ink-3">{f ? `${f.name} · ${Math.round((f.count / total) * 100)}%` : 'Worker profiles'}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {slices.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={picked === i}
            onClick={() => setPicked((p) => (p === i ? null : i))}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition',
              picked === i ? 'border-ink/30 bg-surface-2 text-ink' : 'border-line text-ink-2 hover:text-ink',
              focus !== null && focus !== i && 'opacity-60',
            )}
          >
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.name}
            <span className="text-ink-3 tabular-nums">{s.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Complaints by status (rows with proportion bars, status colours + icon + label) ----------
const STATUS_ROWS: { key: ComplaintStatus; label: string; icon: typeof CircleDot; bar: string; text: string }[] = [
  { key: 'open', label: 'Open', icon: CircleDot, bar: 'bg-warning', text: 'text-warning' },
  { key: 'in_progress', label: 'In progress', icon: Loader, bar: 'bg-primary', text: 'text-primary' },
  { key: 'escalated', label: 'Escalated', icon: AlertOctagon, bar: 'bg-danger', text: 'text-danger' },
  { key: 'resolved', label: 'Resolved', icon: CheckCircle2, bar: 'bg-success', text: 'text-success' },
];

export function ComplaintStatusRows({ data }: { data: AdminKpis['complaintsByStatus'] }) {
  const total = STATUS_ROWS.reduce((s, r) => s + (data[r.key] ?? 0), 0);
  return (
    <ul className="space-y-1">
      {STATUS_ROWS.map((r) => {
        const n = data[r.key] ?? 0;
        const pct = total ? (n / total) * 100 : 0;
        return (
          <li key={r.key}>
            <Link to={`/admin/complaints?status=${r.key}`} className="group block rounded-xl px-2 py-2.5 transition hover:bg-surface-2">
              <div className="mb-1.5 flex items-center gap-2 text-sm">
                <r.icon size={15} className={r.text} />
                <span className="flex-1 font-semibold text-ink">{r.label}</span>
                <b className="text-ink tabular-nums">{num(n)}</b>
                <span className="w-10 text-right text-xs text-ink-3 tabular-nums">{Math.round(pct)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2 group-hover:bg-surface-3">
                <div className={cn('h-full rounded-full transition-[width] duration-700', r.bar)} style={{ width: `${pct}%` }} />
              </div>
            </Link>
          </li>
        );
      })}
      {!total && <li className="px-2 pt-2 text-xs text-ink-3">No complaints filed yet — nice.</li>}
    </ul>
  );
}
