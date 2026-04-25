/**
 * @file storageManager — client-side state persistence via localStorage.
 *
 * All reads and writes to localStorage go through this module so validation
 * and schema versioning are applied consistently.  Nothing here is
 * React-specific; it can be imported by hooks, utilities, or tests.
 *
 * Stored schema (version 1):
 * {
 *   version:     1,
 *   coords:      { lat: number, lng: number },
 *   overlayZoom: number,
 *   mapStyle:    'light' | 'dark' | 'satellite',
 *   use24h:      boolean,
 *   wasGeolocated: boolean,   // true when coords came from the device GPS
 * }
 *
 * @module utils/storageManager
 */

import { OVERLAY_ZOOM } from '../config';

const STORAGE_KEY     = 'zenith_state';
const SCHEMA_VERSION  = 1;

/**
 * Validate that a parsed object conforms to the expected schema.
 *
 * @param {unknown} obj
 * @returns {boolean}
 */
function validate(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.version !== SCHEMA_VERSION)  return false;

  const { coords, overlayZoom, mapStyle, use24h, wasGeolocated } = obj;

  // coords
  if (!coords || typeof coords !== 'object') return false;
  const { lat, lng } = coords;
  if (typeof lat !== 'number' || lat < -90  || lat > 90)   return false;
  if (typeof lng !== 'number' || lng < -180 || lng > 180)  return false;

  // overlayZoom — must be a finite number in the slider range
  if (typeof overlayZoom !== 'number' || overlayZoom < OVERLAY_ZOOM.min || overlayZoom > OVERLAY_ZOOM.max) return false;

  // mapStyle
  if (!['light', 'dark', 'satellite'].includes(mapStyle)) return false;

  // booleans
  if (typeof use24h       !== 'boolean') return false;
  if (typeof wasGeolocated !== 'boolean') return false;

  return true;
}

/**
 * Load the persisted state from localStorage.
 *
 * @returns {{ coords, overlayZoom, mapStyle, use24h, wasGeolocated } | null}
 *   Returns the validated saved state, or null if nothing is stored or the
 *   data is invalid / from an incompatible schema version.
 */
export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!validate(obj)) return null;
    const { coords, overlayZoom, mapStyle, use24h, wasGeolocated } = obj;
    return { coords, overlayZoom, mapStyle, use24h, wasGeolocated };
  } catch {
    // Corrupted JSON or storage unavailable — silently fall back to defaults.
    return null;
  }
}

/**
 * Persist the current application state.
 *
 * Only the fields that belong in the schema are written; any extra properties
 * on `state` are ignored.  The caller is responsible for debouncing frequent
 * updates (e.g. during slider drags).
 *
 * @param {{ coords, overlayZoom, mapStyle, use24h, wasGeolocated }} state
 */
export function save(state) {
  try {
    const payload = {
      version:      SCHEMA_VERSION,
      coords:       { lat: state.coords.lat, lng: state.coords.lng },
      overlayZoom:  state.overlayZoom,
      mapStyle:     state.mapStyle,
      use24h:       Boolean(state.use24h),
      wasGeolocated: Boolean(state.wasGeolocated),
    };
    // Final validation guard — if we somehow built an invalid payload, skip.
    if (!validate(payload)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage quota exceeded or unavailable — fail silently.
  }
}

/**
 * Remove the persisted state (e.g. for a "reset to defaults" action).
 */
export function clear() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
