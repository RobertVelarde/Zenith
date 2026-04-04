/**
 * @file Hook for fetching timezone and elevation when coordinates change.
 *
 * Encapsulates the async fetching logic with cancellation, caching (handled
 * internally by the utility functions), and user-facing error notifications.
 *
 * @module hooks/useTimezone
 */

import { useState, useEffect } from 'react';
import { getTimezone } from '../utils/timezone';
import { getElevation } from '../utils/elevation';
import { useNotification } from './notificationContext';
import { LABELS } from '../config';

/**
 * Fetch timezone and elevation for a coordinate pair.
 *
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lng - Longitude in decimal degrees.
 * @returns {{ timezone: string | null, elevation: number | null }}
 */
export function useLocationMeta(lat, lng) {
  const [timezone, setTimezone] = useState(null);
  const [elevation, setElevation] = useState(null);
  const { notify } = useNotification();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [tz, elev] = await Promise.all([
        getTimezone(lat, lng).catch(() => {
          notify(LABELS.timezoneFailed, 'warn');
          return null;
        }),
        getElevation(lat, lng).catch(() => null),
      ]);

      if (cancelled) return;
      setTimezone(tz);
      setElevation(elev);
    })();

    return () => { cancelled = true; };
  }, [lat, lng, notify]);

  return { timezone, elevation };
}
