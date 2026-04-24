/**
 * @file Hook for requesting browser geolocation on demand.
 *
 * Returns a `geolocate` callback that can be called imperatively (e.g. after
 * a press-and-hold gesture).  On success the coordinates are updated and the
 * map flies to the result; on failure a notification is shown and an optional
 * `onError` callback is invoked so the caller can roll back any optimistic UI.
 *
 * @module hooks/useGeolocation
 */

import { useCallback } from 'react';
import { useNotification } from './notificationContext';
import { LABELS, TRANSITIONS } from '../config';

/**
 * Returns a `geolocate({ onError })` function that requests the user's
 * position and flies the map to the result.
 *
 * @param {Function} setCoords   - State setter for `{ lat, lng }`.
 * @param {React.MutableRefObject} mapRef - Ref to the Mapbox map instance.
 * @returns {{ geolocate: Function }}
 */
export function useGeolocation(setCoords, mapRef) {
  const { notify } = useNotification();

  const geolocate = useCallback((opts = {}) => {
    if (!('geolocation' in navigator)) {
      opts.onError?.();
      return;
    }

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
        opts.onError?.();
      },
      { timeout: 5000, enableHighAccuracy: false },
    );
  }, [setCoords, mapRef, notify]);

  return { geolocate };
}
