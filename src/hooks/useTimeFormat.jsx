/**
 * @file TimeFormatContext — centralizes time-format state and pre-bound helpers.
 *
 * TimeFormatProvider binds `timezone` and `use24h` into a single `fmt` function
 * so call sites never repeat these arguments. `timezone` ownership stays in App
 * (via useLocationMeta); `use24h` ownership stays in App (persisted state).
 *
 * @module hooks/useTimeFormat
 */

import { createContext, useContext, useMemo } from 'react';
import { formatTime } from '../shared/utils/timezone';

const TimeFormatContext = createContext(null);

/**
 * Provides time-formatting helpers to the component tree.
 *
 * @param {Object}   props
 * @param {string}   props.timezone  - IANA timezone string (from useLocationMeta).
 * @param {boolean}  props.use24h    - 24-hour format flag.
 * @param {Function} props.setUse24h - Setter (owned by App).
 * @param {React.ReactNode} props.children
 */
export function TimeFormatProvider({ timezone, use24h, setUse24h, children }) {
  // Pre-bind timezone + use24h so callers never repeat the arguments.
  const fmt = useMemo(
    () => (d) => timezone && d ? formatTime(d, timezone, use24h) : '--',
    [timezone, use24h],
  );

  const value = useMemo(
    () => ({ use24h, setUse24h, fmt, timezone }),
    [use24h, setUse24h, fmt, timezone],
  );

  return <TimeFormatContext.Provider value={value}>{children}</TimeFormatContext.Provider>;
}

export function useTimeFormat() {
  return useContext(TimeFormatContext);
}
