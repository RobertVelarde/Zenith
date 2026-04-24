/**
 * @file useCompassHeading — subscribes to the device orientation compass.
 *
 * Returns the current compass heading in degrees (0 = North, 90 = East, …).
 * Returns null when the device has no compass, the API is unavailable, or
 * the user has denied permission.
 *
 * iOS 13+ requires an explicit permission request before the browser will
 * fire DeviceOrientationEvent data.  Android Chrome fires immediately.
 *
 * @module hooks/useCompassHeading
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * @returns {{ heading: number|null, available: boolean, requestPermission: Function }}
 */
export function useCompassHeading() {
  const [heading, setHeading]   = useState(null);
  const [available, setAvailable] = useState(false);

  const handleOrientation = useCallback((e) => {
    let deg = null;

    if (e.webkitCompassHeading != null) {
      // iOS Safari — already in geographic degrees from North
      deg = e.webkitCompassHeading;
    } else if (e.absolute && e.alpha != null) {
      // Android Chrome — alpha is degrees counter-clockwise from North
      deg = (360 - e.alpha) % 360;
    } else if (e.alpha != null) {
      // Non-absolute but best we can do
      deg = (360 - e.alpha) % 360;
    }

    if (deg != null) {
      setAvailable(true);
      setHeading(deg);
    }
  }, []);

  // Attempt to subscribe automatically (works on Android; iOS needs permission)
  useEffect(() => {
    if (!window.DeviceOrientationEvent) return;

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [handleOrientation]);

  // iOS 13+ permission gate — call this in response to a user gesture if needed
  const requestPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent?.requestPermission !== 'function') {
      // Not iOS 13+ — already subscribed above
      return 'granted';
    }
    try {
      const state = await DeviceOrientationEvent.requestPermission();
      if (state === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
      return state;
    } catch {
      return 'denied';
    }
  }, [handleOrientation]);

  return { heading, available, requestPermission };
}
