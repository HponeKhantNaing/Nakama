'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

// Important: Leaflet/Mapbox touch `window` at import-time.
// Load them client-side only to prevent SSR crashes.
const LiveTrackingMap = dynamic(() => import('./live-tracking-map').then((m) => m.LiveTrackingMap), {
  ssr: false,
});
const MapboxTrackingMap = dynamic(
  () => import('./mapbox-tracking-map').then((m) => m.MapboxTrackingMap),
  { ssr: false }
);

export function TrackingMap(props: ComponentProps<typeof MapboxTrackingMap>) {
  if (process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return <MapboxTrackingMap {...props} />;
  return <LiveTrackingMap {...props} />;
}
