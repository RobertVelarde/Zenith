/**
 * @file Hook for computing sun & moon data (positions, trajectories).
 *
 * Memoises all expensive SunCalc calls so they only recompute when the
 * underlying date or coordinates actually change.
 *
 * @module hooks/useSolarData
 */

import { useMemo, useCallback } from 'react';
import { getSunData, getMoonData, getSunTrajectory, getMoonTrajectory } from '../shared/utils/sunMoonCalc';
import { makeLocalDate } from '../shared/utils/timezone';

/**
 * Compute all sun/moon calculation results for the current date and location.
 *
 * @param {{ lat: number, lng: number }} coords  - Decimal degrees.
 * @param {number} year       - Full year (e.g. 2026).
 * @param {number} month      - Month 1-12.
 * @param {number} day        - Day of month.
 * @param {number} timeMinutes - Minutes since midnight (0-1439).
 * @param {string | null} timezone - IANA timezone string.
 * @returns {{ calcDate: Date, sunData: Object, moonData: Object, sunTrajectory: Array, moonTrajectory: Array }}
 */
export function useSolarData(coords, year, month, day, timeMinutes, timezone) {
  /** Build the exact Date for calculations. */
  const calcDate = useMemo(() => {
    if (!timezone) {
      return new Date(year, month - 1, day, Math.floor(timeMinutes / 60), timeMinutes % 60);
    }
    return makeLocalDate(year, month, day, timeMinutes, timezone);
  }, [year, month, day, timeMinutes, timezone]);

  /** Helper: create a Date for any minute-of-day in the active timezone. */
  const makeDateForMinute = useCallback(
    (m) => {
      if (!timezone) {
        return new Date(year, month - 1, day, Math.floor(m / 60), m % 60);
      }
      return makeLocalDate(year, month, day, m, timezone);
    },
    [year, month, day, timezone],
  );

  const sunData = useMemo(
    () => getSunData(calcDate, coords.lat, coords.lng),
    [calcDate, coords.lat, coords.lng],
  );

  const moonData = useMemo(
    () => getMoonData(calcDate, coords.lat, coords.lng),
    [calcDate, coords.lat, coords.lng],
  );

  const sunTrajectory = useMemo(
    () => getSunTrajectory(calcDate, coords.lat, coords.lng, makeDateForMinute),
    [calcDate, coords.lat, coords.lng, makeDateForMinute],
  );

  const moonTrajectory = useMemo(
    () => getMoonTrajectory(calcDate, coords.lat, coords.lng, makeDateForMinute),
    [calcDate, coords.lat, coords.lng, makeDateForMinute],
  );

  return { calcDate, sunData, moonData, sunTrajectory, moonTrajectory };
}
