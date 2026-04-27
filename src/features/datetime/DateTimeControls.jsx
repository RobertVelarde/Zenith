/**
 * @file Date-picker and time/year sliders with twilight-gradient backgrounds.
 *
 * The gradient helpers are kept file-local because they are tightly coupled
 * to the slider rendering logic and produce CSS strings, not data that other
 * modules would consume.
 *
 * @module components/DateTimeControls
 */

import { useMemo } from 'react';
import SunCalc from 'suncalc';
import { DateTime } from 'luxon';
import { LABELS, TWILIGHT_COLORS, YEARLY_GRADIENT_PALETTE, SLIDER } from '../../config';
import { useTheme } from '../../shared/hooks/useTheme';
import { useTimeFormat } from '../../shared/hooks/useTimeFormat';

function pad(n) { return String(n).padStart(2, '0'); }
function mToHHMM(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
function mTo12h(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${pad(min)} ${suffix}`;
}

/* Map day-of-year ↔ Date */
function doyToDate(doy, year) {
  const d = new Date(year, 0, 1);
  d.setDate(doy);
  return d;
}
function dateToDoy(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

/**
 * Convert a Date → minute-of-day (0-1439) in the given IANA timezone.
 * Falls back to browser local time if tz is absent or invalid.
 */
function dateToMinuteInZone(d, tz) {
  if (!d || isNaN(d.getTime())) return null;
  try {
    const dt = tz ? DateTime.fromJSDate(d).setZone(tz) : DateTime.fromJSDate(d);
    return dt.hour * 60 + dt.minute;
  } catch {
    return null;
  }
}

/**
 * Build a CSS linear-gradient for the yearly slider representing day-length
 * variation across months at the given latitude.
 * Uses an absolute 0-24 h scale:
 *   0 h  (polar night)  → deep slate  #0f172a
 *  12 h  (equinox)      → warm amber  #92400e
 *  24 h  (midnight sun) → vivid gold  #fbbf24
 * This means equatorial locations consistently sit near the midpoint,
 * while polar locations span the full range.
 */
/**
 * Return the day-length in ms for `date` at `lat`/`lng`.
 * Handles polar scenarios (always-up = full day, always-down = 0).
 */
function getDayLengthMs(date, lat, lng) {
  const times = SunCalc.getTimes(date, lat, lng);
  const rise = times.sunrise;
  const set  = times.sunset;
  if (rise && set && !isNaN(rise.getTime()) && !isNaN(set.getTime())) {
    return Math.max(0, set.getTime() - rise.getTime());
  }
  // Polar scenario: check altitude at solar noon
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  return SunCalc.getPosition(noon, lat, lng).altitude > 0 ? 86400000 : 0;
}

/**
 * Build a CSS linear-gradient string for the year slider track.
 *
 * Color mapping — each day's daylight duration (0–24 h) is mapped to an
 * RGB triple by linearly interpolating through three palette stops:
 *   dark (≈ 0 h) → mid (≈ 12 h) → bright (≈ 24 h).
 * This gives an intuitive visual cue: winter days appear dark/cool, summer
 * days appear bright/warm, irrespective of the user's locale.
 *
 * Scale rationale — the gradient spans the absolute 0–24 h range rather
 * than normalizing to the year's shortest/longest day so that comparisons
 * between different latitudes remain meaningful.
 *
 * Samples every 10 days for performance (≈36 gradient stops per year).
 *
 * @param {number} lat  - Latitude in decimal degrees.
 * @param {number} lng  - Longitude in decimal degrees.
 * @param {number} year - Calendar year (used for leap-year detection).
 * @returns {string} CSS `linear-gradient(to right, …)` string.
 */
function buildYearlyGradient(lat, lng, year) {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;

  // Absolute palette from configuration
  const DARK   = YEARLY_GRADIENT_PALETTE.dark;
  const MID    = YEARLY_GRADIENT_PALETTE.mid;
  const BRIGHT = YEARLY_GRADIENT_PALETTE.bright;

  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const toHex = ([r, g, b]) =>
    `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

  // t is in [0, 1] representing 0–24 h
  const colorAt = (len) => {
    const t = Math.max(0, Math.min(1, len / 86400000));
    if (t < 0.5) {
      const tt = t * 2;
      return toHex([lerp(DARK[0], MID[0], tt), lerp(DARK[1], MID[1], tt), lerp(DARK[2], MID[2], tt)]);
    }
    const tt = (t - 0.5) * 2;
    return toHex([lerp(MID[0], BRIGHT[0], tt), lerp(MID[1], BRIGHT[1], tt), lerp(MID[2], BRIGHT[2], tt)]);
  };

  const stops = [];
  for (let doy = 1; doy <= daysInYear; doy += 10) {
    const date = new Date(year, 0, doy);
    const len = getDayLengthMs(date, lat, lng);
    const pct = (((doy - 1) / (daysInYear - 1)) * 100).toFixed(2);
    stops.push(`${colorAt(len)} ${pct}%`);
  }
  // Guarantee an endpoint at exactly 100%
  const lastLen = getDayLengthMs(new Date(year, 11, 31), lat, lng);
  stops.push(`${colorAt(lastLen)} 100%`);

  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/**
 * Build a CSS linear-gradient string for the time slider track,
 * based on sun event times for the current date/location.
 * Timezone-aware: times are converted to the location's local zone so the
 * gradient aligns with the displayed times rather than the browser's clock.
 */
function buildDayNightGradient(sunTimes, timezone, coords, year, month, day) {
  if (!sunTimes) return SLIDER.trackBg;

  const toMin = (d) => dateToMinuteInZone(d, timezone);
  const normMin = (m) => ((m % 1440) + 1440) % 1440;
  const pct = (m) => ((normMin(m) / 1440) * 100).toFixed(1) + '%';

  const nightEnd  = toMin(sunTimes.nightEnd);
  const nautDawn  = toMin(sunTimes.nauticalDawn);
  const dawn      = toMin(sunTimes.dawn);
  const sunrise   = toMin(sunTimes.sunrise);
  const solarNoon = toMin(sunTimes.solarNoon);
  const sunset    = toMin(sunTimes.sunset);
  const dusk      = toMin(sunTimes.dusk);
  const nautDusk  = toMin(sunTimes.nauticalDusk);
  const night     = toMin(sunTimes.night);

  const { night: NIGHT, astro: ASTRO, nautical: NAUT, civil: CIVIL, golden: GOLD, day: DAY } = TWILIGHT_COLORS;
  const colors = { NIGHT, ASTRO, NAUT, CIVIL, GOLD, DAY };

  const transitions = [];
  const addTransition = (time, from, to) => {
    if (time != null) transitions.push({ time: normMin(time), from, to });
  };

  addTransition(nightEnd, 'NIGHT', 'ASTRO');
  addTransition(nautDawn, 'ASTRO', 'NAUT');
  addTransition(dawn, 'NAUT', 'CIVIL');
  addTransition(sunrise, 'CIVIL', 'GOLD');

  // Keep a short golden-hour shoulder around sunrise/sunset only when true daylight exists.
  if (sunrise != null && sunset != null && sunset - sunrise > 60) {
    addTransition(sunrise + 30, 'GOLD', 'DAY');
    addTransition(sunset - 30, 'DAY', 'GOLD');
  }

  addTransition(sunset, 'GOLD', 'CIVIL');
  addTransition(dusk, 'CIVIL', 'NAUT');
  addTransition(nautDusk, 'NAUT', 'ASTRO');
  addTransition(night, 'ASTRO', 'NIGHT');

  transitions.sort((a, b) => a.time - b.time);

  if (!transitions.length) {
    if (!coords || year == null || month == null || day == null) return SLIDER.trackBg;
    const noon = new Date(year, month - 1, day, 12, 0, 0);
    const altitude = SunCalc.getPosition(noon, coords.lat, coords.lng).altitude;
    const flat = altitude > 0 ? DAY : NIGHT;
    return `linear-gradient(to right, ${flat} 0%, ${flat} 100%)`;
  }

  const startPhase = transitions[transitions.length - 1].to;
  const stops = [`${colors[startPhase]} 0%`];

  for (const tr of transitions) {
    stops.push(`${colors[tr.from]} ${pct(tr.time)}`, `${colors[tr.to]} ${pct(tr.time)}`);
  }

  const endPhase = transitions[transitions.length - 1].to;
  stops.push(`${colors[endPhase]} 100%`);

  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export default function DateTimeControls({
  year, month, day, timeMinutes,
  sunTimes,
  onDateChange, onTimeChange,
  coords,
}) {
  const { isLight } = useTheme();
  const { timezone, use24h } = useTimeFormat();
  const dateStr = `${year}-${pad(month)}-${pad(day)}`;
  const doy = useMemo(() => dateToDoy(new Date(year, month - 1, day)), [year, month, day]);
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;

  const timeGradient = useMemo(
    () => buildDayNightGradient(sunTimes, timezone, coords, year, month, day),
    [sunTimes, timezone, coords, year, month, day],
  );

  const yearGradient = useMemo(
    () => coords ? buildYearlyGradient(coords.lat, coords.lng, year) : SLIDER.trackBg,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coords?.lat, coords?.lng, year],
  );

  const handleDateInput = (e) => {
    const [y, m, d] = e.target.value.split('-').map(Number);
    if (y && m && d) onDateChange(y, m, d);
  };

  const handleDoySlider = (e) => {
    const v = Number(e.target.value);
    const d = doyToDate(v, year);
    onDateChange(d.getFullYear(), d.getMonth() + 1, d.getDate());
  };

  // Month labels for the yearly slider
  const monthLabels = LABELS.months;

  return (
    <div className="space-y-3">
      {/* Time slider with day/night gradient */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{LABELS.timeLabel}</label>
          <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{use24h ? mToHHMM(timeMinutes) : mTo12h(timeMinutes)}</span>
        </div>
        <div className="relative">
          {/* Gradient track behind the native slider */}
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[14px] rounded-full pointer-events-none"
            style={{ background: timeGradient }}
          />
          <input
            type="range"
            min={0}
            max={1439}
            value={timeMinutes}
            onChange={(e) => onTimeChange(Number(e.target.value))}
            className="w-full time-slider-over-gradient"
          />
        </div>
        <div className={`flex justify-between text-[9px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-gray-600'}`}>
          {use24h
            ? (<><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span></>)
            : (<><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></>)
          }
        </div>
      </div>

      {/* Yearly slider */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{LABELS.yearlyLabel}</label>
          <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{LABELS.dayPrefix} {doy}</span>
        </div>
        <div className="relative">
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[14px] rounded-full pointer-events-none"
            style={{ background: yearGradient }}
          />
          <input
            type="range"
            min={1}
            max={daysInYear}
            value={doy}
            onChange={handleDoySlider}
            className="w-full year-slider-over-gradient"
          />
        </div>
        <div className={`flex justify-between text-[9px] mt-0.5 px-0.5 ${isLight ? 'text-slate-400' : 'text-gray-600'}`}>
          {monthLabels.map((m) => <span key={m}>{m}</span>)}
        </div>
      </div>
    </div>
  );
}
