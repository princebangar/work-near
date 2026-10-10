/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { Crosshair, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { Button, Chip, Sheet } from './ui';
import { useGeo, toast } from '@/store';
import { useT } from '@/i18n';
import { APP } from '@/config/env';
import { getDeviceLocation } from '@/lib/format';
import { autocomplete, loadMaps, mapsEnabled, placeLocation, reverseGeocode, type Suggestion } from '@/lib/maps';

const FALLBACK = [
  { label: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167 },
  { label: 'Sector 18, Noida', lat: 28.5708, lng: 77.3261 },
  { label: 'Cyber City, Gurugram', lat: 28.495, lng: 77.0895 },
  { label: 'Andheri West, Mumbai', lat: 19.1364, lng: 72.8296 },
];

export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { point, radiusKm, setPoint, setRadius } = useGeo();
  const [draft, setDraft] = useState(point);
  const [q, setQ] = useState('');
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [mapFailed, setMapFailed] = useState(!mapsEnabled);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const circle = useRef<any>(null);
  const skipIdle = useRef(true);

  useEffect(() => { if (open) { setDraft(point); setQ(''); setSugs([]); } }, [open, point]);

  // Init map once per open
  useEffect(() => {
    if (!open || mapFailed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    loadMaps().then((maps) => {
      if (cancelled || !el.current) return;
      map.current = new maps.Map(el.current, {
        center: { lat: point.lat, lng: point.lng }, zoom: 13, disableDefaultUI: true, zoomControl: true, clickableIcons: false, gestureHandling: 'greedy',
      });
      circle.current = new maps.Circle({
        map: map.current, center: map.current.getCenter(), radius: radiusKm * 1000,
        strokeColor: '#4f46e5', strokeOpacity: 0.6, strokeWeight: 1.5, fillColor: '#4f46e5', fillOpacity: 0.08, clickable: false,
      });
      map.current.addListener('center_changed', () => circle.current.setCenter(map.current.getCenter()));
      // After the user stops dragging, resolve the address under the pin (debounced + cached).
      map.current.addListener('idle', () => {
        if (skipIdle.current) { skipIdle.current = false; return; }
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const c = map.current.getCenter();
          const lat = c.lat(), lng = c.lng();
          setDraft({ lat, lng, label: 'Locating…', source: 'manual' });
          const label = await reverseGeocode(lat, lng).catch(() => 'Pinned location');
          setDraft((d) => (d.lat === lat && d.lng === lng ? { ...d, label } : d));
        }, 400);
      });
    }).catch(() => setMapFailed(true));
    return () => { cancelled = true; clearTimeout(timer); map.current = null; skipIdle.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mapFailed]);

  useEffect(() => { circle.current?.setRadius(radiusKm * 1000); map.current?.setZoom(radiusKm <= 5 ? 13 : radiusKm <= 10 ? 12 : 11); }, [radiusKm]);

  // Debounced autocomplete (min 3 chars) → few Places calls
  useEffect(() => {
    if (mapFailed || q.trim().length < 3) return setSugs([]);
    const id = setTimeout(() => autocomplete(q.trim()).then(setSugs).catch(() => setSugs([])), 300);
    return () => clearTimeout(id);
  }, [q, mapFailed]);

  const moveTo = (lat: number, lng: number, label: string, source: 'gps' | 'manual') => {
    skipIdle.current = true;
    map.current?.panTo({ lat, lng });
    setDraft({ lat, lng, label, source });
  };

  const useGps = async () => {
    setGpsBusy(true);
    try {
      const p = await getDeviceLocation();
      const label = await reverseGeocode(p.lat, p.lng).catch(() => 'Current location');
      moveTo(p.lat, p.lng, label, 'gps');
      if (mapFailed) { setPoint({ ...p, label, source: 'gps' }); onClose(); }
    } catch {
      toast('Location permission denied. Search or pin manually.', 'error');
    } finally {
      setGpsBusy(false);
    }
  };

  const pick = async (s: Suggestion) => {
    setQ(''); setSugs([]);
    try {
      const p = await placeLocation(s.id, s.secondary ? `${s.main}, ${s.secondary.split(',')[0]}` : s.main);
      moveTo(p.lat, p.lng, p.label, 'manual');
    } catch { toast('Could not find that place', 'error'); }
  };

  const confirm = () => { setPoint(draft); onClose(); };

  return (
    <Sheet open={open} onClose={onClose} title={t('location')}>
      <div className="relative mb-3">
        <label className="flex h-12 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 focus-within:border-primary">
          <Search size={18} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchArea')} className="h-full w-full bg-transparent outline-none" />
          {q && <button aria-label="Clear" onClick={() => setQ('')}><X size={18} className="text-ink-3" /></button>}
        </label>
        {sugs.length > 0 && (
          <ul className="absolute inset-x-0 top-13 z-20 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface shadow-xl">
            {sugs.map((s) => (
              <li key={s.id}>
                <button onClick={() => pick(s)} className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-surface-2">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-ink-3" />
                  <span className="min-w-0"><b className="block truncate text-[15px]">{s.main}</b><span className="block truncate text-xs text-ink-2">{s.secondary}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!mapFailed ? (
        <>
          <div className="relative h-64 overflow-hidden rounded-2xl bg-surface-2">
            <div ref={el} className="size-full" />
            {/* Fixed centre pin — user drags the map underneath it */}
            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
              <MapPin size={40} className="fill-primary text-white drop-shadow-lg" strokeWidth={1.5} />
            </div>
            <button onClick={useGps} aria-label={t('useCurrentLocation')} className="absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-surface text-primary shadow-lg">
              {gpsBusy ? <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <LocateFixed size={22} />}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary-soft p-3">
            <MapPin size={18} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{draft.label}</span>
          </div>
        </>
      ) : (
        <>
          <Button variant="soft" block onClick={useGps} loading={gpsBusy}><Crosshair size={18} />{t('useCurrentLocation')}</Button>
          <div className="mt-2 divide-y divide-line">
            {FALLBACK.map((p) => (
              <button key={p.label} onClick={() => setDraft({ ...p, source: 'manual' })} className={`flex w-full items-center gap-3 py-3 text-left ${draft.label === p.label ? 'font-bold text-primary' : ''}`}>
                <MapPin size={18} className="text-ink-3" />{p.label}
              </button>
            ))}
          </div>
        </>
      )}

      <h4 className="mt-4 mb-2 text-sm font-semibold text-ink-2">{t('searchRadius')}</h4>
      <div className="flex gap-2">{APP.radiusOptions.map((r) => <Chip key={r} active={radiusKm === r} onClick={() => setRadius(r)}>{r} KM</Chip>)}</div>
      <p className="mt-3 text-xs text-ink-3">We use your location only to show nearby workers. It is not tracked continuously.</p>
      <Button block size="lg" className="mt-4" disabled={draft.label === 'Locating…'} onClick={confirm}>Confirm location</Button>
    </Sheet>
  );
}
