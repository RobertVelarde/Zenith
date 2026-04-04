/**
 * @file Hook for requesting browser geolocation on mount.
 *
 * Attempts to get the user's position once.  On success the returned
 * coordinates update; on failure a notification is shown and the caller
 * keeps its existing default.
 *
 * @module hooks/useGeolocation
 */

import { useEffect, useRef } from 'react';
import { useNotification } from './notificationContext';
import { LABELS, TRANSITIONS } from '../config';

/**
 * Try to geolocate the user on mount, then fly the map to the result.
 *
 * @param {Function} setCoords   - State setter for `{ lat, lng }`.
 * @param {React.MutableRefObject} mapRef - Ref to the Mapbox map instance.
 */
export function useGeolocation(setCoords, mapRef) {
  const { notify } = useNotification();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(coords);
        mapRef.current?.flyTo({
          center: [coords.lng, coords.lat],
          zoom: 13,
          duration: TRANSITIONS.flyToDuration,
        });
      },
      () => {
        notify(LABELS.geolocationDenied, 'info');
      },
      { timeout: 5000, enableHighAccuracy: false },
    );
  }, [setCoords, mapRef, notify]);
}
