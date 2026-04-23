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
import { LABELS, TWILIGHT_COLORS, YEARLY_GRADIENT_PALETTE, SLIDER } from '../config';

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
    const times = SunCalc.getTimes(date, lat, lng);
    const rise = times.sunrise;
    const set  = times.sunset;
    let len;
    if (rise && set && !isNaN(rise.getTime()) && !isNaN(set.getTime())) {
      len = Math.max(0, set.getTime() - rise.getTime());
    } else {
      // Polar scenario: check if sun is up at solar noon
      const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
      len = SunCalc.getPosition(noon, lat, lng).altitude > 0 ? 86400000 : 0;
    }
    const pct = (((doy - 1) / (daysInYear - 1)) * 100).toFixed(2);
    stops.push(`${colorAt(len)} ${pct}%`);
  }
  // Guarantee an endpoint at exactly 100%
  const lastDate = new Date(year, 11, 31);
  const lastTimes = SunCalc.getTimes(lastDate, lat, lng);
  const lastRise = lastTimes.sunrise;
  const lastSet  = lastTimes.sunset;
  let lastLen;
  if (lastRise && lastSet && !isNaN(lastRise.getTime()) && !isNaN(lastSet.getTime())) {
    lastLen = Math.max(0, lastSet.getTime() - lastRise.getTime());
  } else {
    const noon = new Date(year, 11, 31, 12, 0, 0);
    lastLen = SunCalc.getPosition(noon, lat, lng).altitude > 0 ? 86400000 : 0;
  }
  stops.push(`${colorAt(lastLen)} 100%`);

  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/**
 * Build a CSS linear-gradient string for the time slider track,
 * based on sun event times for the current date/location.
 * Timezone-aware: times are converted to the location's local zone so the
 * gradient aligns with the displayed times rather than the browser's clock.
 */
function buildDayNightGradient(sunTimes, timezone) {
  if (!sunTimes) return SLIDER.trackBg;

  const toMin = (d) => dateToMinuteInZone(d, timezone);

  const nightEnd  = toMin(sunTimes.nightEnd);
  const nautDawn  = toMin(sunTimes.nauticalDawn);
  const dawn      = toMin(sunTimes.dawn);
  const sunrise   = toMin(sunTimes.sunrise);
  const sunset    = toMin(sunTimes.sunset);
  const dusk      = toMin(sunTimes.dusk);
  const nautDusk  = toMin(sunTimes.nauticalDusk);
  const night     = toMin(sunTimes.night);

  const pct = (m) => ((m / 1440) * 100).toFixed(1) + '%';

  if (sunrise == null || sunset == null) {
    return SLIDER.trackBg;
  }

  const stops = [];
  const { night: NIGHT, astro: ASTRO, nautical: NAUT, civil: CIVIL, golden: GOLD, day: DAY } = TWILIGHT_COLORS;

  stops.push(`${NIGHT} 0%`);

  if (nightEnd != null)  stops.push(`${NIGHT} ${pct(nightEnd)}`, `${ASTRO} ${pct(nightEnd)}`);
  if (nautDawn != null)  stops.push(`${ASTRO} ${pct(nautDawn)}`, `${NAUT} ${pct(nautDawn)}`);
  if (dawn != null)      stops.push(`${NAUT} ${pct(dawn)}`, `${CIVIL} ${pct(dawn)}`);
  if (sunrise != null)   stops.push(`${CIVIL} ${pct(sunrise)}`, `${GOLD} ${pct(sunrise)}`);

  // Daylight
  stops.push(`${DAY} ${pct(sunrise + 30)}`);
  stops.push(`${DAY} ${pct(sunset - 30)}`);

  if (sunset != null)    stops.push(`${GOLD} ${pct(sunset)}`, `${CIVIL} ${pct(sunset)}`);
  if (dusk != null)      stops.push(`${CIVIL} ${pct(dusk)}`, `${NAUT} ${pct(dusk)}`);
  if (nautDusk != null)  stops.push(`${NAUT} ${pct(nautDusk)}`, `${ASTRO} ${pct(nautDusk)}`);
  if (night != null)     stops.push(`${ASTRO} ${pct(night)}`, `${NIGHT} ${pct(night)}`);

  stops.push(`${NIGHT} 100%`);

  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export default function DateTimeControls({
  year, month, day, timeMinutes,
  sunTimes,
  timezone,
  onDateChange, onTimeChange,
  use24h,
  coords,
  isLight,
}) {
  const dateStr = `${year}-${pad(month)}-${pad(day)}`;
  const doy = useMemo(() => dateToDoy(new Date(year, month - 1, day)), [year, month, day]);
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;

  const timeGradient = useMemo(() => buildDayNightGradient(sunTimes, timezone), [sunTimes, timezone]);

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
      {/* Date picker */}
      <div>
        <label className={`text-[10px] uppercase tracking-wider mb-1 block ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{LABELS.dateLabel}</label>
        <input
          type="date"
          value={dateStr}
          onChange={handleDateInput}
          className={`w-full max-w-full appearance-none rounded-lg px-3 py-1.5 text-sm outline-none
            ${isLight
              ? 'bg-black/5 border border-black/10 text-slate-900 focus:border-amber-500/70'
              : 'bg-white/5 border border-white/10 text-white focus:border-amber-500/50'}`}
        />
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
    </div>
  );
}
