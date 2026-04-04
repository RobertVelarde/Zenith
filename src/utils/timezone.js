/**
 * @file Timezone detection and date/time formatting utilities.
 *
 * Uses the TimeAPI.io service for IANA timezone lookups, with a
 * longitude-based UTC-offset fallback when the service is unavailable.
 * All formatters are timezone-aware via Luxon.
 *
 * @module utils/timezone
 */

import { DateTime } from 'luxon';
import { API } from '../config';

/** @type {Map<string, string>} */
const tzCache = new Map();

/**
 * Look up the IANA timezone for a coordinate pair.
 *
 * Results are cached by rounded lat/lng to avoid duplicate fetches.
 * Falls back to a rough UTC offset derived from longitude.
 *
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lng - Longitude in decimal degrees.
 * @returns {Promise<string>} IANA timezone identifier.
 */
export async function getTimezone(lat, lng) {
  const key = `${lat.toFixed(1)},${lng.toFixed(1)}`;
  if (tzCache.has(key)) return tzCache.get(key);

  try {
    const res = await fetch(
      `${API.timezoneUrl}?latitude=${lat}&longitude=${lng}`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data.timeZone) {
        tzCache.set(key, data.timeZone);
        return data.timeZone;
      }
    }
  } catch {
    /* network error – fall through to offset estimation */
  }

  // Fallback: rough offset from longitude
  const offset = Math.round(lng / 15);
  const tz = `Etc/GMT${offset <= 0 ? '+' : ''}${-offset}`;
  tzCache.set(key, tz);
  return tz;
}

/* ---------- formatters ---------- */

/**
 * Format a Date as a short time string in the given timezone.
 *
 * @param {Date}    date   - JS Date to format.
 * @param {string}  tz     - IANA timezone identifier.
 * @param {boolean} [use24h=false] - Use 24-hour format.
 * @returns {string} Formatted time or '--:--' on failure.
 */
export function formatTime(date, tz, use24h = false) {
  if (!date || !tz || isNaN(date.getTime())) return '--:--';
  try {
    return DateTime.fromJSDate(date).setZone(tz).toFormat(use24h ? 'HH:mm' : 'h:mm a');
  } catch {
    return '--:--';
  }
}

/**
 * Format time with a cross-day prefix: -HH:MM (prev day), +HH:MM (next day), HH:MM (same day).
 * @param {Date} date
 * @param {string} tz
 * @param {number} dayOffset  -1, 0, or 1
 * @param {boolean} use24h
 */
export function formatTimeCrossDay(date, tz, dayOffset = 0, use24h = false) {
  if (!date || !tz || isNaN(date.getTime())) return '--:--';
  const base = formatTime(date, tz, use24h);
  if (dayOffset === -1) return `−${base}`;
  if (dayOffset === 1)  return `+${base}`;
  return base;
}

/**
 * Format time with seconds precision in the given timezone.
 *
 * @param {Date}    date   - JS Date to format.
 * @param {string}  tz     - IANA timezone identifier.
 * @param {boolean} [use24h=false] - Use 24-hour format.
 * @returns {string} Formatted time or '--:--:--' on failure.
 */
export function formatTimeLong(date, tz, use24h = false) {
  if (!date || !tz || isNaN(date.getTime())) return '--:--:--';
  try {
    return DateTime.fromJSDate(date).setZone(tz).toFormat(use24h ? 'HH:mm:ss' : 'h:mm:ss a');
  } catch {
    return '--:--:--';
  }
}

/**
 * Build a JS Date that corresponds to a given local date + minutes-of-day in the given timezone.
 *
 * @param {number} year    - Full year (e.g. 2026).
 * @param {number} month   - Month 1-12.
 * @param {number} day     - Day of month.
 * @param {number} minutes - Minutes since midnight (0-1439).
 * @param {string} tz      - IANA timezone identifier.
 * @returns {Date}
 */
export function makeLocalDate(year, month, day, minutes, tz) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  try {
    return DateTime.fromObject(
      { year, month, day, hour: h, minute: m, second: 0 },
      { zone: tz },
    ).toJSDate();
  } catch {
    return new Date(year, month - 1, day, h, m, 0);
  }
}

/** Duration in ms → "Xh Ym" */
export function formatDuration(ms) {
  if (!ms || isNaN(ms) || ms < 0) return '--';
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}
