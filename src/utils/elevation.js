/**
 * @file Elevation lookup via the USGS Elevation Point Query Service.
 *
 * Results are cached by rounded coordinates to prevent redundant requests.
 * Returns `null` for locations outside the service area (Non-US).
 *
 * @module utils/elevation
 */

import { API } from '../config';

/** @type {Map<string, number>} */
const cache = new Map();

/**
 * Fetch elevation in metres for the given coordinate.
 *
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lng - Longitude in decimal degrees.
 * @returns {Promise<number|null>} Elevation in metres, or null if unavailable.
 */
export async function getElevation(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const url = `${API.elevationUrl}?x=${lng}&y=${lat}&wkid=4326&units=Meters&includeDate=false`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const elev = parseFloat(data.value);
      if (!isNaN(elev) && elev > -1000) {
        cache.set(key, elev);
        return elev;
      }
    }
  } catch {
    /* network error */
  }
  return null;
}
