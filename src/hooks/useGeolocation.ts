import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLng } from '../types/transit';

export type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';
export interface GeoFix { position: LatLng; accuracyM: number }

/** Requests location only when request() is called — never on mount. */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const safeSet = useCallback((s: GeoStatus) => { if (mounted.current) setStatus(s); }, []);

  const request = useCallback(
    () =>
      new Promise<GeoFix | null>((resolve) => {
        if (!('geolocation' in navigator) || !window.isSecureContext) {
          safeSet('unsupported');
          resolve(null);
          return;
        }
        safeSet('requesting');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            safeSet('granted');
            resolve({ position: [pos.coords.latitude, pos.coords.longitude], accuracyM: Math.round(pos.coords.accuracy) });
          },
          (err) => {
            safeSet(err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable');
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
        );
      }),
    [safeSet],
  );

  return { status, request };
}