import { LatLng, decodePolyline, calculateRoute } from './routing';
import { locationCoords, getLocationById, DeliveryLocation } from './locations';

export function resolveRouteCoordinates(
  polyline: string | null | undefined,
  origin: LatLng,
  destination: LatLng
): LatLng[] {
  if (polyline) {
    try {
      const decoded = decodePolyline(polyline);
      if (decoded.length >= 2) return decoded;
    } catch {
      // fall through
    }
  }
  return [origin, destination];
}

export async function ensureRequestRoute(
  requestId: string,
  origin: LatLng,
  destination: LatLng,
  existingPolyline?: string | null
): Promise<{ coordinates: LatLng[]; polyline: string; distanceKm: number; durationMin: number }> {
  if (existingPolyline) {
    const coordinates = resolveRouteCoordinates(existingPolyline, origin, destination);
    if (coordinates.length > 2) {
      return { coordinates, polyline: existingPolyline, distanceKm: 0, durationMin: 0 };
    }
  }

  const route = await calculateRoute(origin, destination);
  return {
    coordinates: route.coordinates,
    polyline: route.polyline,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
  };
}

export function coordsFromLocationIds(
  originId: string,
  destinationId: string
): { origin: DeliveryLocation; destination: DeliveryLocation; originCoords: LatLng; destCoords: LatLng } | null {
  const origin = getLocationById(originId);
  const destination = getLocationById(destinationId);
  if (!origin || !destination) return null;
  return {
    origin,
    destination,
    originCoords: locationCoords(origin),
    destCoords: locationCoords(destination),
  };
}
