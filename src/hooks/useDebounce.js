/**
 * @file Generic debounce hook.
 *
 * Returns a debounced version of a value that only updates after the
 * specified delay has elapsed without new changes.  Useful for throttling
 * expensive recalculations triggered by rapid slider movement.
 */

import { useState, useEffect } from 'react';

/**
 * Debounce a rapidly-changing value.
 *
 * @template T
 * @param {T} value   - The raw value that may change frequently.
 * @param {number} delay - Milliseconds to wait before propagating the change.
 * @returns {T} The debounced value.
 */
export function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
