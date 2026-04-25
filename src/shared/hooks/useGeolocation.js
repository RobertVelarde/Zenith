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
import { LABELS } from '../../config';

/**
 * Returns a `geolocate({ onSuccess, onError })` function that requests the
 * user's position and invokes the appropriate callback with the result.
 *
 * @param {Function} setCoords - State setter for `{ lat, lng }`.
 * @returns {{ geolocate: Function }}
 */
export function useGeolocation(setCoords) {
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
        opts.onSuccess?.(coords);
      },
      () => {
        notify(LABELS.geolocationDenied, 'info');
        opts.onError?.();
      },
      { timeout: 5000, enableHighAccuracy: false },
    );
  }, [setCoords, notify]);

  return { geolocate };
}
