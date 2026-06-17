'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LatLng } from '@/lib/tms/routing';
import { formatEta } from '@/lib/tms/routing';

const truckIcon = L.divIcon({
  html: `<div style="background:#FF6B4A;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px">🚛</div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const originIcon = L.divIcon({
  html: `<div style="background:#34D399;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2)"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const destIcon = L.divIcon({
  html: `<div style="background:#EF4444;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2)"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function isMapAlive(map: L.Map | null | undefined): map is L.Map {
  if (!map) return false;
  try {
    const container = map.getContainer?.();
    return !!container && document.body.contains(container);
  } catch {
    return false;
  }
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length < 2) return;

    let cancelled = false;

    const fit = () => {
      if (cancelled || !isMapAlive(map)) return;
      try {
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [50, 50], animate: false });
      } catch {
        // map destroyed mid-update
      }
    };

    if ((map as L.Map & { _loaded?: boolean })._loaded) {
      fit();
    } else {
      map.whenReady(fit);
    }

    return () => {
      cancelled = true;
    };
  }, [map, points]);

  return null;
}

function TruckMarker({
  position,
  status,
  progressPercent,
  remainingKm,
  etaMinutes,
}: {
  position: LatLng;
  status: string;
  progressPercent: number;
  remainingKm: number;
  etaMinutes: number;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    map.whenReady(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
      setReady(false);
      markerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!ready || !marker || !isMapAlive(map)) return;

    try {
      marker.setLatLng([position.lat, position.lng]);
    } catch {
      // marker detached from map
    }
  }, [ready, map, position.lat, position.lng]);

  if (!ready || !isMapAlive(map)) return null;

  return (
    <Marker
      ref={(ref) => {
        markerRef.current = ref;
      }}
      position={[position.lat, position.lng]}
      icon={truckIcon}
    >
      <Popup>
        <strong>{status}</strong>
        <br />
        {progressPercent}% complete
        <br />
        {remainingKm.toFixed(1)} km remaining
        <br />
        ETA: {formatEta(etaMinutes)}
      </Popup>
    </Marker>
  );
}

export interface LiveTrackingMapProps {
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

export function LiveTrackingMap({
  origin,
  destination,
  current,
  route = [],
  progressPercent = 0,
  remainingKm = 0,
  etaMinutes = 0,
  status = 'Driving',
  height = '480px',
}: LiveTrackingMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const center = current ?? origin;
  const polyline: [number, number][] = useMemo(() => {
    const pts = route.length > 0 ? route : [origin, destination];
    return pts.map((p) => [p.lat, p.lng] as [number, number]);
  }, [route, origin, destination]);

  const allPoints = useMemo(
    () => [origin, destination, ...(current ? [current] : [])],
    [origin, destination, current]
  );

  const mapKey = useMemo(
    () =>
      `${origin.lat.toFixed(4)}-${origin.lng.toFixed(4)}-${destination.lat.toFixed(4)}-${destination.lng.toFixed(4)}`,
    [origin, destination]
  );

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
    <div className="flex flex-col overflow-hidden rounded-xl shadow-soft" style={{ height }}>
      <MapContainer
        key={mapKey}
        center={[center.lat, center.lng]}
        zoom={8}
        className="min-h-0 flex-1"
        style={{ width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />
        <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
          <Popup>Origin (Warehouse)</Popup>
        </Marker>
        <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
          <Popup>Destination (Customer)</Popup>
        </Marker>
        {current && polyline.length >= 2 && (
          <TruckMarker
            position={current}
            status={status}
            progressPercent={progressPercent}
            remainingKm={remainingKm}
            etaMinutes={etaMinutes}
          />
        )}
        <Polyline positions={polyline} pathOptions={{ color: '#FF6B4A', weight: 4, opacity: 0.8 }} />
        {current && (
          <Polyline
            positions={[
              [origin.lat, origin.lng],
              [current.lat, current.lng],
            ]}
            pathOptions={{ color: '#34D399', weight: 3, dashArray: '8 8' }}
          />
        )}
      </MapContainer>

      {/* Responsive map footer: wraps metrics instead of overflowing on small driver screens. */}
      <div className="grid shrink-0 grid-cols-2 gap-3 border-t bg-white px-4 py-3 text-sm sm:grid-cols-4 sm:px-5">
        <div>
          <p className="text-xs text-muted-foreground">Progress</p>
          <p className="text-lg font-bold text-primary">{progressPercent}%</p>
        </div>
        <div className="sm:text-center">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm font-semibold">{status}</p>
        </div>
        <div className="sm:text-right">
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
