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

const toDeg = (rad) => rad * (180 / Math.PI);
const normAz = (rad) => (toDeg(rad) + 180) % 360;

function safeDate(d) {
  return d && !isNaN(d.getTime()) ? d : null;
}

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

function buildTrajectory(getSkyPos, lat, lng, makeDate) {
  const pts = [];
  for (let m = 0; m < 1440; m += 5) {
    const p = getSkyPos(makeDate(m), lat, lng);
    pts.push({ minutes: m, azimuthDeg: normAz(p.azimuth), altitudeDeg: toDeg(p.altitude) });
  }
  return pts;
}

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

export function getSunTrajectory(dateBase, lat, lng, makeDate) {
  return buildTrajectory(SunCalc.getPosition, lat, lng, makeDate);
}

export function getMoonTrajectory(dateBase, lat, lng, makeDate) {
  return buildTrajectory(SunCalc.getMoonPosition, lat, lng, makeDate);
}

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
