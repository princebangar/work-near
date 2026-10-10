import { distanceKm } from '../../lib/core.js';
import { categories } from '../catalog/catalog.data.js';

/**
 * Worker search. In-memory repository for now.
 * Production: PostgreSQL + PostGIS —
 *   WHERE ST_DWithin(location::geography, ST_MakePoint($lng,$lat)::geography, $radius*1000)
 * with a GIST index on `location`. The service signature stays the same.
 */
export interface Worker {
  id: string; name: string; photo: string; categoryId: string; skills: string[]; rating: number; reviewCount: number;
  lat: number; lng: number; verification: 'phone' | 'id' | 'id_address' | null; available: boolean; visible: boolean;
  experienceYrs: number; priceRange?: string; locality: string; lastActiveAt: string;
}

// Small deterministic seed around Connaught Place, New Delhi.
const workers: Worker[] = Array.from({ length: 30 }, (_, i) => {
  const cat = categories[i % categories.length]!;
  const r = ((i * 37) % 140) / 10 / 111, a = i * 2.39996;
  return {
    id: `w${i + 1}`, name: `Worker ${i + 1}`, photo: '', categoryId: cat.id, skills: [cat.name],
    rating: 3.5 + ((i * 13) % 15) / 10, reviewCount: (i * 17) % 120, lat: 28.6315 + r * Math.sin(a), lng: 77.2167 + r * Math.cos(a),
    verification: i % 3 ? 'id' : null, available: i % 4 !== 0, visible: true, experienceYrs: 1 + (i % 15),
    locality: 'New Delhi', lastActiveAt: new Date(Date.now() - i * 3_600_000).toISOString(),
  };
});
const byId = new Map(workers.map((w) => [w.id, w]));

export const findById = (id: string) => byId.get(id);

export interface SearchInput {
  lat: number; lng: number; radius_km: number; q?: string; category_id?: string; min_rating?: number;
  verified_only?: boolean; available_only?: boolean; sort: 'distance' | 'rating' | 'recent'; cursor?: number; limit: number;
}

export function searchNearby(p: SearchInput) {
  // Cheap bounding-box prefilter before exact haversine (what a spatial index does for us in PostGIS).
  const dLat = p.radius_km / 111;
  const dLng = p.radius_km / (111 * Math.cos((p.lat * Math.PI) / 180));
  const q = p.q?.toLowerCase();

  type Hit = Omit<Worker, 'lat' | 'lng' | 'visible'> & { categoryName: string; distanceKm: number };
  const hits: Hit[] = [];
  for (const w of workers) {
    if (!w.visible) continue;
    if (Math.abs(w.lat - p.lat) > dLat || Math.abs(w.lng - p.lng) > dLng) continue;
    if (p.category_id && w.categoryId !== p.category_id) continue;
    if (p.min_rating && w.rating < p.min_rating) continue;
    if (p.verified_only && !w.verification) continue;
    if (p.available_only && !w.available) continue;
    if (q && !`${w.name} ${w.skills.join(' ')}`.toLowerCase().includes(q)) continue;
    const d = distanceKm(p.lat, p.lng, w.lat, w.lng);
    if (d > p.radius_km) continue; // boundary inclusive: exactly 5.0 km is included
    const { lat: _a, lng: _b, visible: _v, ...pub } = w;
    hits.push({ ...pub, categoryName: categories.find((c) => c.id === w.categoryId)?.name ?? '', distanceKm: Math.round(d * 10) / 10 });
  }

  const cmp = {
    distance: (a: Hit, b: Hit) => a.distanceKm - b.distanceKm,
    rating: (a: Hit, b: Hit) => b.rating - a.rating || a.distanceKm - b.distanceKm,
    recent: (a: Hit, b: Hit) => b.lastActiveAt.localeCompare(a.lastActiveAt),
  }[p.sort];
  hits.sort(cmp);

  const start = p.cursor ?? 0;
  const items = hits.slice(start, start + p.limit);
  return { items, nextCursor: start + p.limit < hits.length ? String(start + p.limit) : null, total: hits.length };
}
