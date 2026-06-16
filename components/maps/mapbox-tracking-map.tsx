'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { LatLng } from '@/lib/tms/routing';
import { formatEta } from '@/lib/tms/routing';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export interface MapboxTrackingMapProps {
  origin: LatLng;
  destination: LatLng;
  current?: LatLng | null;
  route?: LatLng[];
  progressPercent?: number;
  remainingKm?: number;
  etaMinutes?: number;
  status?: string;
  height?: string;
}

export function MapboxTrackingMap({
  origin,
  destination,
  current,
  route = [],
  progressPercent = 0,
  remainingKm = 0,
  etaMinutes = 0,
  status = 'In Transit',
  height = '480px',
}: MapboxTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const truckMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const polylineCoords = useMemo(() => {
    const pts = route.length > 0 ? route : [origin, destination];
    return pts.map((p) => [p.lng, p.lat] as [number, number]);
  }, [route, origin, destination]);

  useEffect(() => {
    if (!mounted || !containerRef.current || !mapboxgl.accessToken) return;

    let alive = true;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [origin.lng, origin.lat],
      zoom: 9,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      if (!alive) return;
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: polylineCoords },
        },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#FF6B4A', 'line-width': 4, 'line-opacity': 0.85 },
      });

      new mapboxgl.Marker({ color: '#34D399' })
        .setLngLat([origin.lng, origin.lat])
        .setPopup(new mapboxgl.Popup().setHTML('<strong>Warehouse</strong>'))
        .addTo(map);

      new mapboxgl.Marker({ color: '#EF4444' })
        .setLngLat([destination.lng, destination.lat])
        .setPopup(new mapboxgl.Popup().setHTML('<strong>Destination</strong>'))
        .addTo(map);

      const bounds = new mapboxgl.LngLatBounds();
      polylineCoords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 60 });
    });

    mapRef.current = map;

    return () => {
      alive = false;
      truckMarkerRef.current?.remove();
      truckMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [mounted, origin, destination, polylineCoords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !current) return;

    let alive = true;

    const update = () => {
      if (!alive || !mapRef.current) return;
      try {
        if (!truckMarkerRef.current) {
          const el = document.createElement('div');
          el.innerHTML = '🚛';
          el.style.cssText =
            'font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));transition:transform 0.8s ease';
          truckMarkerRef.current = new mapboxgl.Marker({ element: el })
            .setLngLat([current.lng, current.lat])
            .addTo(map);
        } else {
          truckMarkerRef.current.setLngLat([current.lng, current.lat]);
        }
      } catch {
        // map destroyed
      }
    };

    if (map.loaded()) update();
    else map.once('load', update);

    return () => {
      alive = false;
    };
  }, [current]);

  if (!mapboxgl.accessToken) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border bg-muted/30 text-sm text-muted-foreground"
        style={{ height }}
      >
        Set NEXT_PUBLIC_MAPBOX_TOKEN to enable live map
      </div>
    );
  }

  if (!mounted) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-muted/30 text-sm text-muted-foreground"
        style={{ height }}
      >
        Loading map...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl shadow-soft" style={{ height }}>
      <div ref={containerRef} style={{ height: 'calc(100% - 72px)', width: '100%' }} />
      <div className="flex items-center justify-between border-t bg-white px-5 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Progress</p>
          <div className="mt-1 h-2 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
          <p className="mt-1 text-lg font-bold text-primary">{progressPercent}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm font-semibold">{status}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">ETA</p>
          <p className="text-lg font-bold">{formatEta(etaMinutes)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Remaining</p>
          <p className="text-sm font-semibold">{remainingKm.toFixed(1)} km</p>
        </div>
      </div>
    </div>
  );
}
