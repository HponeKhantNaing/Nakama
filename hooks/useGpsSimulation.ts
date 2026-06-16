'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createGpsSimulator,
  DEMO_ROUTE_TOKYO_YOKOHAMA,
  GPS_SIMULATION_INTERVAL_MS,
  SimulationState,
} from '@/lib/tms/gps-simulator';
import { LatLng } from '@/lib/tms/routing';

export interface UseGpsSimulationOptions {
  enabled?: boolean;
  route?: LatLng[];
  intervalMs?: number;
  onTick?: (state: SimulationState) => void;
}

export function useGpsSimulation({
  enabled = true,
  route = DEMO_ROUTE_TOKYO_YOKOHAMA,
  intervalMs = GPS_SIMULATION_INTERVAL_MS,
  onTick,
}: UseGpsSimulationOptions = {}) {
  const simulatorRef = useRef(createGpsSimulator(route));
  const [state, setState] = useState<SimulationState | null>(null);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  const reset = useCallback(() => {
    simulatorRef.current.reset();
    setState(null);
  }, []);

  const routeKey = useMemo(
    () => route.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|'),
    [route]
  );

  useEffect(() => {
    if (!enabled || route.length < 2) return;

    const sim = createGpsSimulator(route);
    simulatorRef.current = sim;

    const id = setInterval(() => {
      const next = sim.tick();
      setState(next);
      onTickRef.current?.(next);
    }, intervalMs);

    const initial = sim.tick();
    setState(initial);
    onTickRef.current?.(initial);

    return () => clearInterval(id);
  }, [enabled, routeKey, route, intervalMs]);

  return { state, route: simulatorRef.current?.route ?? route, reset };
}
