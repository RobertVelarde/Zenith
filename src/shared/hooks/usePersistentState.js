/**
 * @file usePersistentState — hydration and debounced persistence hook.
 *
 * Reads the saved state once on mount and provides a `persist(state)` function
 * that debounces writes to localStorage.  The debounce prevents storage
 * thrashing during rapid slider drags or map panning.
 *
 * Usage:
 *   const { savedState, persist } = usePersistentState(1000);
 *
 *   // Initialise React state from savedState (may be null):
 *   const [coords, setCoords] = useState(savedState?.coords ?? DEFAULT_COORDS);
 *
 *   // Persist whenever relevant state changes:
 *   useEffect(() => {
 *     persist({ coords, overlayZoom, mapStyle, use24h, wasGeolocated });
 *   }, [coords, overlayZoom, mapStyle, use24h, wasGeolocated]);
 *
 * @module hooks/usePersistentState
 */

import { useRef, useMemo, useEffect } from 'react';
import * as storageManager from '../../shared/utils/storageManager';

/**
 * @param {number} [debounceMs=800] - Milliseconds to wait after the last
 *   `persist()` call before writing to localStorage.
 * @returns {{ savedState: object|null, persist: Function }}
 */
export function usePersistentState(debounceMs = 800) {
  // Load once at module evaluation time (synchronous, happens before first
  // render) so initial useState() calls in the consumer can use the value
  // without a flash of default content.
  const savedState = useMemo(() => storageManager.load(), []);

  // Timer handle for the debounced write.
  const timerRef    = useRef(null);
  // Holds the most-recent state passed to persist() so the visibilitychange
  // handler can flush it synchronously if the debounce hasn't fired yet.
  const pendingRef  = useRef(null);

  // Stable persist function — reference never changes across re-renders.
  const persistRef = useRef(null);
  if (!persistRef.current) {
    persistRef.current = (state) => {
      pendingRef.current = state;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        storageManager.save(state);
        timerRef.current = null;
        pendingRef.current = null;
      }, debounceMs);
    };
  }

  // Flush any pending write when the component unmounts (e.g. page hidden).
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Also flush synchronously on page hide so data isn't lost if the browser
  // kills the tab before the debounce timer fires.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden' && timerRef.current && pendingRef.current) {
        clearTimeout(timerRef.current);
        storageManager.save(pendingRef.current);
        timerRef.current = null;
        pendingRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, []);

  return { savedState, persist: persistRef.current };
}
