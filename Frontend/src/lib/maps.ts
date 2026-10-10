/* eslint-disable @typescript-eslint/no-explicit-any */
// Google Maps helpers. Script is loaded lazily (only when a map/location feature is opened).
// In React Native swap this file for react-native-maps + a geocoding call; callers stay the same.

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
export const mapsEnabled = !!KEY;

let loading: Promise<any> | null = null;
export function loadMaps(): Promise<any> {
  if (!KEY) return Promise.reject(new Error('Google Maps key missing'));
  if ((window as any).google?.maps?.Map) return Promise.resolve((window as any).google.maps);
  return (loading ??= new Promise((resolve, reject) => {
    (window as any).__wnMapsReady = () => resolve((window as any).google.maps);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&loading=async&language=en&region=IN&callback=__wnMapsReady`;
    s.async = true;
    s.onerror = () => { loading = null; reject(new Error('Failed to load Google Maps')); };
    document.head.appendChild(s);
  }));
}

export interface Place { label: string; lat: number; lng: number }

const shortLabel = (r: any): string => {
  const get = (t: string) => r.address_components?.find((c: any) => c.types.includes(t))?.long_name;
  const area = get('sublocality_level_1') ?? get('sublocality') ?? get('neighborhood') ?? get('route');
  const city = get('locality') ?? get('administrative_area_level_2');
  return [area, city].filter(Boolean).join(', ') || r.formatted_address;
};

// Cache reverse-geocode results (~100 m grid) so the same spot never costs a second API call.
const revCache = new Map<string, string>();
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const k = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = revCache.get(k);
  if (hit) return hit;
  const maps = await loadMaps();
  const { results } = await new maps.Geocoder().geocode({ location: { lat, lng } });
  const label = results?.[0] ? shortLabel(results[0]) : 'Pinned location';
  revCache.set(k, label);
  return label;
}

let session: any = null; // Places session token → autocomplete keystrokes billed as one session
export interface Suggestion { id: string; main: string; secondary: string }

export async function autocomplete(input: string): Promise<Suggestion[]> {
  const maps = await loadMaps();
  const P = maps.places;
  session ??= new P.AutocompleteSessionToken();
  try {
    // Places API (New)
    const { suggestions } = await P.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, sessionToken: session, includedRegionCodes: ['in'] });
    return suggestions.map((s: any) => ({ id: s.placePrediction.placeId, main: s.placePrediction.mainText.text, secondary: s.placePrediction.secondaryText?.text ?? '' }));
  } catch {
    // Legacy Places fallback
    const r = await new P.AutocompleteService().getPlacePredictions({ input, sessionToken: session, componentRestrictions: { country: 'in' } });
    return (r?.predictions ?? []).map((p: any) => ({ id: p.place_id, main: p.structured_formatting.main_text, secondary: p.structured_formatting.secondary_text ?? '' }));
  }
}

export async function placeLocation(placeId: string, label: string): Promise<Place> {
  const maps = await loadMaps();
  const { results } = await new maps.Geocoder().geocode({ placeId });
  session = null; // session ends on selection
  const loc = results[0].geometry.location;
  return { label, lat: loc.lat(), lng: loc.lng() };
}
