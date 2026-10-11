import clsx, { type ClassValue } from 'clsx';

export const cn = (...v: ClassValue[]) => clsx(v);

const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const inr = (n: number) => rupee.format(n);
export const num = (n: number) => n.toLocaleString('en-IN');
export const km = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`);

export function timeAgo(iso: string) {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
export const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
export const date = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

// Straight-line (haversine) distance in KM — backend uses the same formula so radius boundaries match.
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Why the device location could not be read — each maps to its own user message (i18n `gps_<reason>`). */
export type GpsFailure = 'insecure' | 'unsupported' | 'denied' | 'unavailable' | 'timeout';
export class GpsError extends Error {
  constructor(public reason: GpsFailure) {
    super(reason);
  }
}

const position = (opts: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));

/**
 * Current device location. Tries a precise GPS fix first (phones), then falls back to a quick network/cached
 * fix (laptops, indoors). Browsers only allow this on HTTPS (or localhost) — deploy the site behind TLS.
 */
export async function getDeviceLocation(): Promise<{ lat: number; lng: number; accuracy: number }> {
  if (!window.isSecureContext) throw new GpsError('insecure');
  if (!('geolocation' in navigator)) throw new GpsError('unsupported');
  const toFix = (p: GeolocationPosition) => ({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) });
  try {
    return toFix(await position({ enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }));
  } catch (e) {
    const err = e as GeolocationPositionError;
    if (err.code === err.PERMISSION_DENIED) throw new GpsError('denied');
    try {
      return toFix(await position({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 }));
    } catch (e2) {
      const err2 = e2 as GeolocationPositionError;
      throw new GpsError(err2.code === err2.PERMISSION_DENIED ? 'denied' : err2.code === err2.TIMEOUT ? 'timeout' : 'unavailable');
    }
  }
}
