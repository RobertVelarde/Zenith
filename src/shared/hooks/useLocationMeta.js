/**
 * @file Hook for fetching timezone when coordinates change.
 *
 * Encapsulates the async fetching logic with cancellation, caching (handled
 * internally by the utility functions), and user-facing error notifications.
 *
 * @module hooks/useTimezone
 */

import { useState, useEffect } from 'react';
import { getTimezone } from '../../shared/utils/timezone';
import { useNotification } from './notificationContext';
import { LABELS } from '../../config';

/**
 * Fetch timezone for a coordinate pair.
 *
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lng - Longitude in decimal degrees.
 * @returns {{ timezone: string | null }}
 */
export function useLocationMeta(lat, lng) {
  const [timezone, setTimezone] = useState(null);
  const { notify } = useNotification();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const tz = await getTimezone(lat, lng).catch(() => {
        notify(LABELS.timezoneFailed, 'warn');
        return null;
      });


      if (cancelled) return;
      setTimezone(tz);
    })();

    return () => { cancelled = true; };
  }, [lat, lng, notify]);

  return { timezone };
}
