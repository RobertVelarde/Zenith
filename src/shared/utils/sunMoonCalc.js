/**
 * @file Sun & Moon calculation wrappers around the `suncalc` library.
 *
 * Provides higher-level data structures (event azimuths, cross-day
 * moonrise/set detection, full-day trajectories) that the rest of the
 * application consumes.
 *
 * @module shared/utils/sunMoonCalc
 */

import SunCalc from 'suncalc';

/** Converts radians to degrees. */
const toDeg = (rad) => rad * (180 / Math.PI);

/**
 * Converts a SunCalc azimuth (radians from south, clockwise) to a
 * compass bearing in degrees (0 = north, 90 = east, 180 = south).
 *
 * SunCalc measures from south (+π = north) so we add 180° then wrap to
 * the 0–360 range.
 *
 * @param {number} rad - Azimuth in radians as returned by SunCalc.
 * @returns {number} Compass bearing in degrees [0, 360).
 */
const normAz = (rad) => (toDeg(rad) + 180) % 360;

/**
 * Returns `d` if it is a valid `Date`, otherwise `null`.
 * Guards against the sentinel `Invalid Date` objects SunCalc returns
 * when an event does not occur (e.g. midnight sun).
 *
 * @param {Date|any} d
 * @returns {Date|null}
 */
function safeDate(d) {
  return d && !isNaN(d.getTime()) ? d : null;
}

/**
 * Searches the previous and next calendar days for a moonrise or moonset
 * that did not occur on `date` — common at high latitudes where the moon
 * may not cross the horizon within a given 24-hour period.
 *
 * @param {Date}   date  - Reference date.
 * @param {number} lat   - Latitude in decimal degrees.
 * @param {number} lng   - Longitude in decimal degrees.
 * @param {'rise'|'set'} field - Which moon event to look up.
 * @returns {{ time: Date|null, day: -1|0|1 }}
 *   `time` is the event Date (or null if not found within ±1 day).
 *   `day` is the offset from `date`: -1 = yesterday, 1 = tomorrow.
 */
function findCrossDayTime(date, lat, lng, field) {
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevTimes = SunCalc.getMoonTimes(prevDate, lat, lng);
  if (prevTimes[field] && safeDate(prevTimes[field])) {
    return { time: safeDate(prevTimes[field]), day: -1 };
  }
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextTimes = SunCalc.getMoonTimes(nextDate, lat, lng);
  if (nextTimes[field] && safeDate(nextTimes[field])) {
    return { time: safeDate(nextTimes[field]), day: 1 };
  }
  return { time: null, day: 0 };
}

/**
 * Samples the sky position of a celestial body across a full 24-hour day
 * and returns the results as an array of azimuth/altitude data points.
 *
 * Interval choice — 5 minutes (288 points/day): granular enough for a
 * visually smooth arc overlay on the map while keeping per-trajectory
 * computation well under 1 ms on modern hardware.
 *
 * @param {Function}        getSkyPos - SunCalc position function
 *   (e.g. `SunCalc.getPosition` or `SunCalc.getMoonPosition`).
 * @param {number}          lat       - Latitude in decimal degrees.
 * @param {number}          lng       - Longitude in decimal degrees.
 * @param {function(number): Date} makeDate
 *   Converts a minute-offset (0–1439) into the `Date` to query.
 * @returns {{ minutes: number, azimuthDeg: number, altitudeDeg: number }[]}
 *   288 entries covering minutes 0–1435 in 5-minute steps.
 */
function buildTrajectory(getSkyPos, lat, lng, makeDate) {
  const pts = [];
  for (let m = 0; m < 1440; m += 5) {
    const p = getSkyPos(makeDate(m), lat, lng);
    // normAz converts SunCalc's south-based radian azimuth to compass degrees.
    pts.push({ minutes: m, azimuthDeg: normAz(p.azimuth), altitudeDeg: toDeg(p.altitude) });
  }
  return pts;
}

/**
 * Returns rich sun data for the given instant and location.
 *
 * Combines the SunCalc event times (sunrise, sunset, dawn, dusk, …) with
 * the sun's current position and the compass azimuth at each named event,
 * so callers have everything needed to display event times and draw
 * directional lines on a map.
 *
 * @param {Date}   date - Instant to query (determines current position).
 * @param {number} lat  - Latitude in decimal degrees.
 * @param {number} lng  - Longitude in decimal degrees.
 * @returns {{
 *   times: object,
 *   position: { azimuth: number, altitude: number },
 *   eventAzimuths: Record<string, number>
 * }}
 */
export function getSunData(date, lat, lng) {
  const times = SunCalc.getTimes(date, lat, lng);
  const pos = SunCalc.getPosition(date, lat, lng);

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

/**
 * Returns moon position, illumination, and rise/set times for the given
 * date and location.
 *
 * Because the moon rises roughly 50 minutes later each day, it frequently
 * rises or sets on an adjacent calendar day. `findCrossDayTime` is used to
 * locate cross-midnight events, and `riseDay` / `setDay` offsets (-1, 0, 1)
 * let the UI annotate times as "yesterday" or "tomorrow" when needed.
 *
 * @param {Date}   date - Reference date (time portion used for position).
 * @param {number} lat  - Latitude in decimal degrees.
 * @param {number} lng  - Longitude in decimal degrees.
 * @returns {{
 *   times: { rise: Date|null, set: Date|null, alwaysUp: boolean, alwaysDown: boolean },
 *   riseDay: number, setDay: number,
 *   eventAzimuths: { moonrise?: number, moonset?: number },
 *   position: { azimuth: number, altitude: number, distance: number },
 *   illumination: { fraction: number, phase: number, angle: number }
 * }}
 */
export function getMoonData(date, lat, lng) {
  const pos = SunCalc.getMoonPosition(date, lat, lng);
  const illum = SunCalc.getMoonIllumination(date);

  const todayTimes = SunCalc.getMoonTimes(date, lat, lng);
  let rise = todayTimes.rise ? safeDate(todayTimes.rise) : null;
  let set = todayTimes.set ? safeDate(todayTimes.set) : null;
  let riseDay = 0;
  let setDay = 0;

  if (!rise) {
    ({ time: rise, day: riseDay } = findCrossDayTime(date, lat, lng, 'rise'));
  }
  if (!set) {
    ({ time: set, day: setDay } = findCrossDayTime(date, lat, lng, 'set'));
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

/**
 * Builds a full-day sun trajectory as 288 azimuth/altitude samples
 * (one per 5 minutes), ready for rendering as a map arc overlay.
 *
 * @param {Date}   dateBase  - Unused; kept for API symmetry with `getMoonTrajectory`.
 * @param {number} lat       - Latitude in decimal degrees.
 * @param {number} lng       - Longitude in decimal degrees.
 * @param {function(number): Date} makeDate - Maps minute offset to a `Date`.
 * @returns {{ minutes: number, azimuthDeg: number, altitudeDeg: number }[]}
 */
export function getSunTrajectory(dateBase, lat, lng, makeDate) {
  return buildTrajectory(SunCalc.getPosition, lat, lng, makeDate);
}

/**
 * Builds a full-day moon trajectory as 288 azimuth/altitude samples
 * (one per 5 minutes), ready for rendering as a map arc overlay.
 *
 * @param {Date}   dateBase  - Unused; kept for API symmetry with `getSunTrajectory`.
 * @param {number} lat       - Latitude in decimal degrees.
 * @param {number} lng       - Longitude in decimal degrees.
 * @param {function(number): Date} makeDate - Maps minute offset to a `Date`.
 * @returns {{ minutes: number, azimuthDeg: number, altitudeDeg: number }[]}
 */
export function getMoonTrajectory(dateBase, lat, lng, makeDate) {
  return buildTrajectory(SunCalc.getMoonPosition, lat, lng, makeDate);
}

/**
 * Maps a SunCalc illumination `phase` fraction (0–1) to a human-readable
 * lunar phase name using the standard 8-phase model.
 *
 * Phase boundaries (approximate): 0/1 = New Moon, 0.25 = First Quarter,
 * 0.5 = Full Moon, 0.75 = Last Quarter.
 *
 * @param {number} phase - Illumination phase from `SunCalc.getMoonIllumination().phase`.
 * @returns {string} One of the eight standard phase names.
 */
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
