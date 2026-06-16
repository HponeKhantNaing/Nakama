export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  polyline: string;
  coordinates: LatLng[];
  eta: Date;
}

const ORS_API_KEY = process.env.OPENROUTESERVICE_API_KEY;
const ORS_BASE = 'https://api.openrouteservice.org/v2';

export function decodePolyline(encoded: string): LatLng[] {
  const coordinates: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return coordinates;
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function interpolateRoute(origin: LatLng, destination: LatLng, steps = 50): LatLng[] {
  const coords: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    coords.push({
      lat: origin.lat + (destination.lat - origin.lat) * t,
      lng: origin.lng + (destination.lng - origin.lng) * t,
    });
  }
  return coords;
}

function encodePolyline(coords: LatLng[]): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;
  for (const c of coords) {
    const lat = Math.round(c.lat * 1e5);
    const lng = Math.round(c.lng * 1e5);
    encoded += encodeNumber(lat - prevLat);
    encoded += encodeNumber(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return encoded;
}

function encodeNumber(num: number): string {
  let s = num < 0 ? ~(num << 1) : num << 1;
  let encoded = '';
  while (s >= 0x20) {
    encoded += String.fromCharCode((0x20 | (s & 0x1f)) + 63);
    s >>= 5;
  }
  encoded += String.fromCharCode(s + 63);
  return encoded;
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  if (!ORS_API_KEY) return null;
  try {
    const res = await fetch(
      `${ORS_BASE}/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(address)}&boundary.country=JP&size=1`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.geometry.coordinates;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function calculateRoute(
  origin: LatLng,
  destination: LatLng
): Promise<RouteResult> {
  if (ORS_API_KEY) {
    try {
      const res = await fetch(`${ORS_BASE}/directions/driving-car/json`, {
        method: 'POST',
        headers: {
          Authorization: ORS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: [
            [origin.lng, origin.lat],
            [destination.lng, destination.lat],
          ],
        }),
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const data = await res.json();
        const route = data.routes?.[0];
        if (route) {
          const distanceKm = route.summary.distance / 1000;
          const durationMin = route.summary.duration / 60;
          const coordinates: LatLng[] = route.geometry
            ? decodePolyline(route.geometry)
            : interpolateRoute(origin, destination);
          return {
            distanceKm,
            durationMin,
            polyline: route.geometry ?? encodePolyline(coordinates),
            coordinates,
            eta: new Date(Date.now() + durationMin * 60 * 1000),
          };
        }
      }
    } catch {
      // fall through to estimate
    }
  }

  const distanceKm = haversineKm(origin, destination) * 1.3;
  const durationMin = (distanceKm / 60) * 60;
  const coordinates = interpolateRoute(origin, destination);
  return {
    distanceKm,
    durationMin,
    polyline: encodePolyline(coordinates),
    coordinates,
    eta: new Date(Date.now() + durationMin * 60 * 1000),
  };
}

export function calculateProgress(
  origin: LatLng,
  destination: LatLng,
  current: LatLng
): { percent: number; remainingKm: number } {
  const totalKm = haversineKm(origin, destination);
  const traveledKm = haversineKm(origin, current);
  const remainingKm = Math.max(0, haversineKm(current, destination));
  const percent = totalKm > 0 ? Math.min(100, Math.round((traveledKm / totalKm) * 100)) : 0;
  return { percent, remainingKm };
}

export function formatEta(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// Known Japan coordinates for demo / fallback geocoding
export const JAPAN_LOCATIONS: Record<string, LatLng> = {
  tokyo: { lat: 35.6762, lng: 139.6503 },
  osaka: { lat: 34.6937, lng: 135.5023 },
  nagoya: { lat: 35.1815, lng: 136.9066 },
  kyoto: { lat: 35.0116, lng: 135.7681 },
  yokohama: { lat: 35.4437, lng: 139.638 },
  kobe: { lat: 34.6901, lng: 135.1956 },
};

export function resolveLocation(address: string): LatLng {
  const lower = address.toLowerCase();
  for (const [key, coords] of Object.entries(JAPAN_LOCATIONS)) {
    if (lower.includes(key)) return coords;
  }
  if (lower.includes('東京') || lower.includes('tokyo')) return JAPAN_LOCATIONS.tokyo;
  if (lower.includes('大阪') || lower.includes('osaka')) return JAPAN_LOCATIONS.osaka;
  if (lower.includes('名古屋') || lower.includes('nagoya')) return JAPAN_LOCATIONS.nagoya;
  return JAPAN_LOCATIONS.tokyo;
}
