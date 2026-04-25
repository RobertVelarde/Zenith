/**
 * @file Timezone detection and date/time formatting utilities.
 *
 * Uses the TimeAPI.io service for IANA timezone lookups, with a
 * longitude-based UTC-offset fallback when the service is unavailable.
 * All formatters are timezone-aware via Luxon.
 *
 * @module shared/utils/timezone
 */

import { DateTime } from 'luxon';
import { API } from '../../config';

const tzCache = new Map();

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
  } catch {}

  const offset = Math.round(lng / 15);
  const tz = `Etc/GMT${offset <= 0 ? '+' : ''}${-offset}`;
  tzCache.set(key, tz);
  return tz;
}

export function formatTime(date, tz, use24h = false) {
  if (!date || !tz || isNaN(date.getTime())) return '--:--';
  try {
    return DateTime.fromJSDate(date).setZone(tz).toFormat(use24h ? 'HH:mm' : 'h:mm a');
  } catch {
    return '--:--';
  }
}

export function formatTimeCrossDay(date, tz, dayOffset = 0, use24h = false) {
  if (!date || !tz || isNaN(date.getTime())) return '--:--';
  const base = formatTime(date, tz, use24h);
  if (dayOffset === -1) return `−${base}`;
  if (dayOffset === 1)  return `+${base}`;
  return base;
}

export function formatTimeLong(date, tz, use24h = false) {
  if (!date || !tz || isNaN(date.getTime())) return '--:--:--';
  try {
    return DateTime.fromJSDate(date).setZone(tz).toFormat(use24h ? 'HH:mm:ss' : 'h:mm:ss a');
  } catch {
    return '--:--:--';
  }
}

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

export function formatDuration(ms) {
  if (!ms || isNaN(ms) || ms < 0) return '--';
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}
