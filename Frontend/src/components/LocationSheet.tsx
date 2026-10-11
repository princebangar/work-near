/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Briefcase, ChevronRight, Crosshair, Home, LocateFixed, MapPin, Pencil, Plus, Search, Trash2, X, type LucideIcon } from 'lucide-react';
import { Button, Chip, Input } from './ui';
import { useAuth, useGeo, toast, type GeoPoint } from '@/store';
import { useT, type TKey } from '@/i18n';
import { useRadius } from '@/hooks/useAppSettings';
import { useAddresses, useDeleteAddress, useSaveAddress } from '@/api';
import { cn, getDeviceLocation, GpsError } from '@/lib/format';
import { autocomplete, loadMaps, mapsEnabled, placeLocation, reverseGeocodeDetail, type Suggestion } from '@/lib/maps';
import type { AddressLabel, SavedAddress } from '@/types';

const brand = () => getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim() || '#4f46e5';
// Map opens over India until we know where the user is (geographic centre, not a city default).
const INDIA = { lat: 22.35, lng: 78.67, zoom: 5 };

export interface PickedPlace { lat: number; lng: number; label: string; source: 'gps' | 'manual' }

const LABELS: { v: AddressLabel; key: TKey; icon: LucideIcon }[] = [
  { v: 'home', key: 'addrHome', icon: Home },
  { v: 'work', key: 'addrWork', icon: Briefcase },
  { v: 'other', key: 'addrOther', icon: MapPin },
];
const iconOf = (l: AddressLabel) => LABELS.find((x) => x.v === l)!.icon;

const gpsMessage = (e: unknown): TKey => (e instanceof GpsError ? (`gps_${e.reason}` as TKey) : 'gps_unavailable');

type MapMode = { kind: 'browse' } | { kind: 'save'; edit?: SavedAddress };

/**
 * Location picker (full screen).
 *  - Customer (default): search an area, use current location, saved addresses (Home / Work / Other),
 *    add an address by placing a pin. Sets the app's search location + radius (useGeo).
 *  - `onPick` mode (worker service area): straight to the map pin, nothing global changes.
 */
export function LocationSheet({ open, onClose, onPick, initial, circleKm, title }: {
  open: boolean;
  onClose: () => void;
  onPick?: (p: PickedPlace) => void;
  initial?: PickedPlace;
  circleKm?: number;
  title?: string;
}) {
  const t = useT();
  const pickMode = !!onPick;
  const [mode, setMode] = useState<MapMode | null>(null); // null = list view

  useEffect(() => { if (open) setMode(pickMode ? { kind: 'browse' } : null); }, [open, pickMode]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/50">
      <div role="dialog" aria-modal="true" aria-label={title ?? t('selectLocation')} className="animate-sheet relative flex h-dvh w-full max-w-[var(--app-max-w)] flex-col bg-bg text-ink">
        {mode ? (
          <MapView
            mode={mode} pickMode={pickMode} initial={initial} circleKm={circleKm} title={title}
            onBack={() => (pickMode ? onClose() : setMode(null))} onPick={onPick} onDone={onClose}
          />
        ) : (
          <ListView onClose={onClose} onAdd={() => setMode({ kind: 'save' })} onEdit={(a) => setMode({ kind: 'save', edit: a })} />
        )}
      </div>
    </div>
  );
}

// ---------- Search box (Places autocomplete, debounced, min 3 chars) ----------
function PlaceSearch({ onPlace, autoFocus, className }: { onPlace: (p: { lat: number; lng: number; label: string }) => void; autoFocus?: boolean; className?: string }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  useEffect(() => {
    if (!mapsEnabled || q.trim().length < 3) return setSugs([]);
    const id = setTimeout(() => autocomplete(q.trim()).then(setSugs).catch(() => setSugs([])), 300);
    return () => clearTimeout(id);
  }, [q]);
  if (!mapsEnabled) return null;
  const pick = async (s: Suggestion) => {
    setQ(''); setSugs([]);
    try {
      onPlace(await placeLocation(s.id, s.secondary ? `${s.main}, ${s.secondary.split(',')[0]}` : s.main));
    } catch {
      toast(t('placeNotFound'), 'error');
    }
  };
  return (
    <div className={cn('relative', className)}>
      <label className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 shadow-sm focus-within:border-primary">
        <Search size={18} className="shrink-0 text-ink-3" />
        <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchArea')} aria-label={t('searchArea')}
          className="h-full w-full bg-transparent text-ink outline-none placeholder:text-ink-3" />
        {q && <button type="button" aria-label="Clear" onClick={() => setQ('')}><X size={18} className="text-ink-3" /></button>}
      </label>
      {sugs.length > 0 && (
        <ul className="absolute inset-x-0 top-13 z-30 max-h-72 overflow-y-auto rounded-2xl border border-line bg-surface shadow-xl">
          {sugs.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => pick(s)} className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-surface-2">
                <MapPin size={18} className="mt-0.5 shrink-0 text-ink-3" />
                <span className="min-w-0"><b className="block truncate text-[15px]">{s.main}</b><span className="block truncate text-xs text-ink-2">{s.secondary}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- List view: search · current location · add address · saved · radius ----------
function ListView({ onClose, onAdd, onEdit }: { onClose: () => void; onAdd: () => void; onEdit: (a: SavedAddress) => void }) {
  const t = useT();
  const geo = useGeo();
  const signedIn = !!useAuth((s) => s.token);
  const { radiusKm, options, setRadius } = useRadius();
  const saved = useAddresses(signedIn);
  const [busy, setBusy] = useState(false);
  const [gpsErr, setGpsErr] = useState<TKey | null>(null);

  const commit = (p: GeoPoint) => { geo.setPoint(p); onClose(); };
  const useGps = async () => {
    setBusy(true); setGpsErr(null);
    try {
      const p = await getDeviceLocation();
      const label = mapsEnabled ? (await reverseGeocodeDetail(p.lat, p.lng).catch(() => null))?.label : null;
      commit({ lat: p.lat, lng: p.lng, label: label ?? t('currentLocation'), source: 'gps' });
    } catch (e) {
      setGpsErr(gpsMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="pt-safe sticky top-0 z-20 bg-surface/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-2">
          <button type="button" onClick={onClose} aria-label={t('back')} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><ArrowLeft size={22} /></button>
          <h1 className="text-lg font-bold">{t('selectLocation')}</h1>
        </div>
        <div className="px-4 pb-3"><PlaceSearch onPlace={(p) => commit({ ...p, source: 'manual' })} /></div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pt-3 pb-8">
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line/70 bg-surface">
          <button type="button" onClick={useGps} disabled={busy} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              {busy ? <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Crosshair size={20} strokeWidth={2.4} />}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] text-primary">{t('useCurrentLocation')}</b>
              <span className={cn('block text-xs', gpsErr ? 'text-danger' : 'text-ink-2')}>
                {busy ? t('detectingLocation') : gpsErr ? t(gpsErr) : geo.point?.source === 'gps' ? geo.point.label : t('tapToDetect')}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-ink-3" />
          </button>
          {signedIn && (
            <button type="button" onClick={onAdd} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Plus size={20} /></span>
              <b className="flex-1 text-[15px] text-primary">{t('addAddress')}</b>
              <ChevronRight size={18} className="shrink-0 text-ink-3" />
            </button>
          )}
        </div>
        {!mapsEnabled && <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">{t('mapsUnavailable')}</p>}

        {signedIn && !!saved.data?.length && (
          <section>
            <h2 className="mb-2 px-1 text-xs font-bold tracking-wide text-ink-2 uppercase">{t('savedAddresses')}</h2>
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line/70 bg-surface">
              {saved.data.map((a) => {
                const I = iconOf(a.label);
                const name = a.label === 'other' ? a.name || t('addrOther') : t(a.label === 'home' ? 'addrHome' : 'addrWork');
                const active = geo.point && Math.abs(geo.point.lat - a.lat) < 1e-5 && Math.abs(geo.point.lng - a.lng) < 1e-5;
                return (
                  <div key={a.id} className="flex items-center gap-1 pr-2">
                    <button type="button" onClick={() => commit({ lat: a.lat, lng: a.lng, label: name, source: 'manual' })} className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 text-left active:bg-surface-2">
                      <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', active ? 'bg-primary text-on-primary' : 'bg-surface-2 text-ink-2')}><I size={19} /></span>
                      <span className="min-w-0">
                        <b className="block text-[15px]">{name}</b>
                        <span className="line-clamp-2 text-xs text-ink-2">{[a.line, a.address].filter(Boolean).join(', ')}</span>
                      </span>
                    </button>
                    <button type="button" aria-label={t('editAddress')} onClick={() => onEdit(a)} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2"><Pencil size={16} /></button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 px-1 text-xs font-bold tracking-wide text-ink-2 uppercase">{t('searchRadius')}</h2>
          <div className="flex gap-2">{options.map((r) => <Chip key={r} active={radiusKm === r} onClick={() => setRadius(r)}>{r} KM</Chip>)}</div>
          <p className="mt-3 text-xs text-ink-3">{t('locationPrivacy')}</p>
        </section>
      </div>
    </>
  );
}

// ---------- Map view: drag the map under a fixed pin ----------
function MapView({ mode, pickMode, initial, circleKm, title, onBack, onPick, onDone }: {
  mode: MapMode; pickMode: boolean; initial?: PickedPlace; circleKm?: number; title?: string;
  onBack: () => void; onPick?: (p: PickedPlace) => void; onDone: () => void;
}) {
  const t = useT();
  const geo = useGeo();
  const { radiusKm } = useRadius();
  const save = useSaveAddress();
  const del = useDeleteAddress();
  const edit = mode.kind === 'save' ? mode.edit : undefined;
  const ringKm = pickMode ? circleKm : mode.kind === 'browse' ? radiusKm : undefined;
  const start = edit ? { lat: edit.lat, lng: edit.lng, label: edit.address } : initial ?? geo.point ?? null;

  const [draft, setDraft] = useState<{ lat: number; lng: number; label: string; full: string; source: 'gps' | 'manual' } | null>(
    start ? { lat: start.lat, lng: start.lng, label: start.label, full: edit?.address ?? start.label, source: 'manual' } : null,
  );
  const [label, setLabel] = useState<AddressLabel>(edit?.label ?? 'home');
  const [name, setName] = useState(edit?.name ?? '');
  const [line, setLine] = useState(edit?.line ?? '');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [mapFailed, setMapFailed] = useState(!mapsEnabled);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const circle = useRef<any>(null);
  const skipIdle = useRef(true);
  const resolving = useRef(0);

  const resolve = async (lat: number, lng: number, source: 'gps' | 'manual') => {
    const id = ++resolving.current;
    setDraft({ lat, lng, label: t('locating'), full: '', source });
    const r = await reverseGeocodeDetail(lat, lng).catch(() => ({ label: t('pinnedLocation'), full: t('pinnedLocation') }));
    if (id === resolving.current) setDraft({ lat, lng, ...r, source });
  };

  const useGps = async (silent = false) => {
    setGpsBusy(true);
    try {
      const p = await getDeviceLocation();
      skipIdle.current = true;
      map.current?.setZoom(16);
      map.current?.panTo({ lat: p.lat, lng: p.lng });
      await resolve(p.lat, p.lng, 'gps');
    } catch (e) {
      if (!silent) toast(t(gpsMessage(e)), 'error');
    } finally {
      setGpsBusy(false);
    }
  };

  // Init map once (Maps JS is loaded lazily on first use).
  useEffect(() => {
    if (mapFailed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    loadMaps().then((maps) => {
      if (cancelled || !el.current) return;
      const c0 = start ?? INDIA;
      map.current = new maps.Map(el.current, {
        center: { lat: c0.lat, lng: c0.lng }, zoom: !start ? INDIA.zoom : !ringKm ? 16 : ringKm <= 5 ? 13 : ringKm <= 10 ? 12 : 11,
        disableDefaultUI: true, zoomControl: true, clickableIcons: false, gestureHandling: 'greedy',
      });
      if (ringKm) {
        const c = brand();
        circle.current = new maps.Circle({
          map: map.current, center: map.current.getCenter(), radius: ringKm * 1000,
          strokeColor: c, strokeOpacity: 0.6, strokeWeight: 1.5, fillColor: c, fillOpacity: 0.08, clickable: false,
        });
        map.current.addListener('center_changed', () => circle.current?.setCenter(map.current.getCenter()));
      }
      // After the user stops dragging, resolve the address under the pin (debounced + cached).
      map.current.addListener('idle', () => {
        if (skipIdle.current) { skipIdle.current = false; return; }
        clearTimeout(timer);
        timer = setTimeout(() => {
          const c = map.current?.getCenter();
          if (c) void resolve(c.lat(), c.lng(), 'manual');
        }, 400);
      });
      if (!start) void useGps(true); // no location yet → try GPS once, quietly
    }).catch(() => setMapFailed(true));
    return () => { cancelled = true; clearTimeout(timer); map.current = null; circle.current = null; skipIdle.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapFailed]);

  useEffect(() => {
    if (!ringKm) return;
    circle.current?.setRadius(ringKm * 1000);
  }, [ringKm]);

  const moveTo = (p: { lat: number; lng: number; label: string }) => {
    skipIdle.current = true;
    map.current?.setZoom(ringKm ? (ringKm <= 5 ? 13 : 12) : 16);
    map.current?.panTo({ lat: p.lat, lng: p.lng });
    void resolve(p.lat, p.lng, 'manual');
  };

  const ready = !!draft && draft.label !== t('locating');
  const confirm = () => {
    if (!draft) return;
    const p: PickedPlace = { lat: draft.lat, lng: draft.lng, label: draft.label, source: draft.source };
    if (onPick) onPick(p);
    else geo.setPoint(p);
    onDone();
  };
  const saveAddress = () => {
    if (!draft) return;
    const body = { label, name: label === 'other' ? name.trim() : '', line: line.trim(), address: (draft.full || draft.label).slice(0, 200), lat: draft.lat, lng: draft.lng };
    save.mutate({ id: edit?.id, body }, {
      onSuccess: () => {
        toast(t('addressSaved'), 'success');
        const shown = label === 'other' ? body.name || t('addrOther') : t(label === 'home' ? 'addrHome' : 'addrWork');
        geo.setPoint({ lat: body.lat, lng: body.lng, label: shown, source: 'manual' });
        onDone();
      },
    });
  };

  const saving = mode.kind === 'save';
  return (
    <>
      <div className="relative min-h-0 flex-1 bg-surface-2">
        {!mapFailed ? (
          <>
            <div ref={el} className="size-full" />
            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
              <MapPin size={44} className="fill-primary text-white drop-shadow-lg" strokeWidth={1.5} />
            </div>
            <button type="button" onClick={() => useGps()} aria-label={t('useCurrentLocation')} className="absolute right-3 bottom-4 grid size-12 place-items-center rounded-full bg-surface text-primary shadow-lg ring-1 ring-line">
              {gpsBusy ? <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <LocateFixed size={22} />}
            </button>
          </>
        ) : (
          <div className="grid size-full place-items-center p-6 text-center">
            <div>
              <p className="mb-4 text-sm text-ink-2">{t('mapsUnavailable')}</p>
              <Button variant="soft" loading={gpsBusy} onClick={() => useGps()}><Crosshair size={18} />{t('useCurrentLocation')}</Button>
            </div>
          </div>
        )}
        <div className="pt-safe absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-3">
          <button type="button" onClick={onBack} aria-label={t('back')} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface text-ink shadow-md ring-1 ring-line"><ArrowLeft size={22} /></button>
          {!mapFailed && <PlaceSearch onPlace={moveTo} className="flex-1" />}
        </div>
      </div>

      <div className="pb-safe space-y-3 rounded-t-3xl bg-surface px-4 pt-4 shadow-[0_-12px_30px_-12px_rgba(0,0,0,0.25)]">
        {title && <p className="text-xs font-bold tracking-wide text-ink-2 uppercase">{title}</p>}
        <div className="flex items-start gap-2.5">
          <MapPin size={20} className="mt-0.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <b className="block truncate text-[15px]">{draft?.label ?? t('setLocation')}</b>
            <span className="line-clamp-2 text-xs text-ink-2">{draft?.full && draft.full !== draft.label ? draft.full : t('dragMapHint')}</span>
          </div>
        </div>

        {saving && (
          <>
            <Input value={line} maxLength={120} onChange={(e) => setLine(e.target.value)} placeholder={t('addrLine')} aria-label={t('addrLine')} />
            <div>
              <p className="mb-1.5 text-xs font-semibold text-ink-2">{t('addrSaveAs')}</p>
              <div className="flex gap-2">
                {LABELS.map(({ v, key, icon: I }) => <Chip key={v} active={label === v} onClick={() => setLabel(v)}><I size={15} />{t(key)}</Chip>)}
              </div>
            </div>
            {label === 'other' && <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t('addrName')} aria-label={t('addrName')} />}
          </>
        )}

        <div className="flex gap-2">
          {edit && (
            <Button variant="outline" size="lg" aria-label={t('deleteAddress')} loading={del.isPending} onClick={() => del.mutate(edit.id, { onSuccess: onBack })}>
              <Trash2 size={18} className="text-danger" />
            </Button>
          )}
          {saving ? (
            <Button block size="lg" disabled={!ready || (label === 'other' && name.trim().length < 2)} loading={save.isPending} onClick={saveAddress}>{t('saveAddress')}</Button>
          ) : (
            <Button block size="lg" disabled={!ready} onClick={confirm}>{t('confirmLocation')}</Button>
          )}
        </div>
      </div>
    </>
  );
}
