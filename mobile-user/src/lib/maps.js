// Google geocoding + place search for the location picker. Web used the Maps JS SDK (Geocoder + Places New);
// native calls the same Google APIs over REST with the same key. The map itself is react-native-maps (Google provider).
import { env } from '@/config/env';

const KEY = env.mapsKey;
export const mapsEnabled = !!KEY;

const shortLabel = (r) => {
  const get = (t) => r.address_components?.find((c) => c.types.includes(t))?.long_name;
  const area = get('sublocality_level_1') ?? get('sublocality') ?? get('neighborhood') ?? get('route');
  const city = get('locality') ?? get('administrative_area_level_2');
  return [area, city].filter(Boolean).join(', ') || r.formatted_address;
};

async function geocode(params) {
  const q = Object.entries({ ...params, key: KEY, language: 'en', region: 'in' }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${q}`);
  const j = await r.json();
  if (j.status !== 'OK') throw new Error(j.error_message || j.status);
  return j.results;
}

// Cache reverse-geocode results (~10 m grid) so the same spot never costs a second API call.
const revCache = new Map();
/** `label` = short "Area, City" for headers; `full` = complete formatted address (saved addresses). */
export async function reverseGeocodeDetail(lat, lng) {
  const k = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = revCache.get(k);
  if (hit) return hit;
  const results = await geocode({ latlng: `${lat},${lng}` });
  // Skip plus-codes ("7JWV+2C …") — they are useless to people.
  const r = results?.find((x) => !x.types?.includes('plus_code')) ?? results?.[0];
  const v = r
    ? { label: shortLabel(r), full: String(r.formatted_address ?? shortLabel(r)).replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,3},?\s*/i, '') }
    : { label: 'Pinned location', full: 'Pinned location' };
  revCache.set(k, v);
  return v;
}
export const reverseGeocode = async (lat, lng) => (await reverseGeocodeDetail(lat, lng)).label;

// Places session token → autocomplete keystrokes billed as one session.
let session = null;
const newSession = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export async function autocomplete(input) {
  session ??= newSession();
  const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY },
    body: JSON.stringify({ input, sessionToken: session, includedRegionCodes: ['in'] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Autocomplete failed');
  return (j.suggestions ?? [])
    .filter((s) => s.placePrediction)
    .map((s) => ({ id: s.placePrediction.placeId, main: s.placePrediction.structuredFormat?.mainText?.text ?? s.placePrediction.text?.text ?? '', secondary: s.placePrediction.structuredFormat?.secondaryText?.text ?? '' }));
}

export async function placeLocation(placeId, label) {
  const results = await geocode({ place_id: placeId });
  session = null; // session ends on selection
  const loc = results[0].geometry.location;
  return { label, lat: loc.lat, lng: loc.lng };
}
