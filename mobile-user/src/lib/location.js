import * as Location from 'expo-location';

/** Why the device location could not be read — each maps to its own user message (i18n `gps_<reason>`). */
export class GpsError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new GpsError('timeout')), ms))]);

/**
 * Current device location (foreground only, asked on a user tap — same as the web's browser geolocation).
 * Tries a precise fix first, then falls back to a quick last-known / balanced fix (indoors).
 */
export async function getDeviceLocation() {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new GpsError('denied');
  if (!(await Location.hasServicesEnabledAsync())) throw new GpsError('unavailable');
  const toFix = (p) => ({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy ?? 0) });
  try {
    return toFix(await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 12_000));
  } catch {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }).catch(() => null);
    if (last) return toFix(last);
    try {
      return toFix(await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 10_000));
    } catch (e) {
      throw e instanceof GpsError ? e : new GpsError('unavailable');
    }
  }
}
