/**
 * @file Sun & Moon calculation wrappers around the `suncalc` library.
 *
 * Provides higher-level data structures (event azimuths, cross-day
 * moonrise/set detection, full-day trajectories) that the rest of the
 * application consumes.
 *
 * @module utils/sunMoonCalc
 */

import SunCalc from 'suncalc';

/* ---------- helpers ---------- */

/** Convert radians to degrees. */
const toDeg = (rad) => rad * (180 / Math.PI);

/** Normalise SunCalc's azimuth (radians, 0 = South) to compass degrees (0 = North). */
const normAz = (rad) => (toDeg(rad) + 180) % 360;

function safeDate(d) {
  return d && !isNaN(d.getTime()) ? d : null;
}

/* ---------- Sun ---------- */

/**
 * Compute sun event times, current position, and azimuths at key events.
 *
 * @param {Date}   date - The reference date/time.
 * @param {number} lat  - Latitude in decimal degrees.
 * @param {number} lng  - Longitude in decimal degrees.
 * @returns {{ times: Object, position: { azimuth: number, altitude: number }, eventAzimuths: Object }}
 */
export function getSunData(date, lat, lng) {
  const times = SunCalc.getTimes(date, lat, lng);
  const pos = SunCalc.getPosition(date, lat, lng);

  // Azimuths at key events
  const eventAzimuths = {};
  for (const [key, time] of Object.entries(times)) {
    const t = safeDate(time);
    if (t) {
      const p = SunCalc.getPosition(t, lat, lng);
      eventAzimuths[key] = normAz(p.azimuth);
    }
  }

  return {
    times,
    position: { azimuth: normAz(pos.azimuth), altitude: toDeg(pos.altitude) },
    eventAzimuths,
  };
}

/* ---------- Moon ---------- */

/**
 * Get moon data with cross-day rise/set detection.
 * When rise or set doesn't occur on the selected day, we check prev/next day
 * and tag the result with `riseDay` / `setDay` (-1 = yesterday, 0 = today, +1 = tomorrow).
 */
export function getMoonData(date, lat, lng) {
  const pos = SunCalc.getMoonPosition(date, lat, lng);
  const illum = SunCalc.getMoonIllumination(date);

  // --- Cross-day moonrise / moonset logic ---
  const todayTimes = SunCalc.getMoonTimes(date, lat, lng);
  let rise = todayTimes.rise ? safeDate(todayTimes.rise) : null;
  let set = todayTimes.set ? safeDate(todayTimes.set) : null;
  let riseDay = 0;
  let setDay = 0;

  // If rise is missing today, check yesterday then tomorrow
  if (!rise) {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevTimes = SunCalc.getMoonTimes(prevDate, lat, lng);
    if (prevTimes.rise && safeDate(prevTimes.rise)) {
      rise = safeDate(prevTimes.rise);
      riseDay = -1;
    } else {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextTimes = SunCalc.getMoonTimes(nextDate, lat, lng);
      if (nextTimes.rise && safeDate(nextTimes.rise)) {
        rise = safeDate(nextTimes.rise);
        riseDay = 1;
      }
    }
  }

  // If set is missing today, check yesterday then tomorrow
  if (!set) {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevTimes = SunCalc.getMoonTimes(prevDate, lat, lng);
    if (prevTimes.set && safeDate(prevTimes.set)) {
      set = safeDate(prevTimes.set);
      setDay = -1;
    } else {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextTimes = SunCalc.getMoonTimes(nextDate, lat, lng);
      if (nextTimes.set && safeDate(nextTimes.set)) {
        set = safeDate(nextTimes.set);
        setDay = 1;
      }
    }
  }

  const eventAzimuths = {};
  if (rise) {
    const rPos = SunCalc.getMoonPosition(rise, lat, lng);
    eventAzimuths.moonrise = normAz(rPos.azimuth);
  }
  if (set) {
    const sPos = SunCalc.getMoonPosition(set, lat, lng);
    eventAzimuths.moonset = normAz(sPos.azimuth);
  }

  return {
    times: { rise, set, alwaysUp: todayTimes.alwaysUp, alwaysDown: todayTimes.alwaysDown },
    riseDay,
    setDay,
    eventAzimuths,
    position: {
      azimuth: normAz(pos.azimuth),
      altitude: toDeg(pos.altitude),
      distance: pos.distance,
    },
    illumination: {
      fraction: illum.fraction,
      phase: illum.phase,
      angle: illum.angle,
    },
  };
}

/* ---------- Trajectories ---------- */

/**
 * Compute the sun's azimuth/altitude at 5-minute intervals for the full day.
 *
 * @param {Date}     dateBase - Reference date (used for dependency tracking).
 * @param {number}   lat      - Latitude.
 * @param {number}   lng      - Longitude.
 * @param {Function} makeDate - Factory `(minuteOfDay) => Date` in the correct timezone.
 * @returns {Array<{ minutes: number, azimuthDeg: number, altitudeDeg: number }>}
 */
export function getSunTrajectory(dateBase, lat, lng, makeDate) {
  const pts = [];
  for (let m = 0; m < 1440; m += 5) {
    const d = makeDate(m);
    const p = SunCalc.getPosition(d, lat, lng);
    pts.push({
      minutes: m,
      azimuthDeg: normAz(p.azimuth),
      altitudeDeg: toDeg(p.altitude),
    });
  }
  return pts;
}

/**
 * Compute the moon's azimuth/altitude at 5-minute intervals for the full day.
 *
 * @param {Date}     dateBase - Reference date.
 * @param {number}   lat      - Latitude.
 * @param {number}   lng      - Longitude.
 * @param {Function} makeDate - Factory `(minuteOfDay) => Date` in the correct timezone.
 * @returns {Array<{ minutes: number, azimuthDeg: number, altitudeDeg: number }>}
 */
export function getMoonTrajectory(dateBase, lat, lng, makeDate) {
  const pts = [];
  for (let m = 0; m < 1440; m += 5) {
    const d = makeDate(m);
    const p = SunCalc.getMoonPosition(d, lat, lng);
    pts.push({
      minutes: m,
      azimuthDeg: normAz(p.azimuth),
      altitudeDeg: toDeg(p.altitude),
    });
  }
  return pts;
}

/* ---------- Moon phase name ---------- */
export function getMoonPhaseName(phase) {
  if (phase < 0.03 || phase > 0.97) return 'New Moon';
  if (phase < 0.22) return 'Waxing Crescent';
  if (phase < 0.28) return 'First Quarter';
  if (phase < 0.47) return 'Waxing Gibbous';
  if (phase < 0.53) return 'Full Moon';
  if (phase < 0.72) return 'Waning Gibbous';
  if (phase < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
}
