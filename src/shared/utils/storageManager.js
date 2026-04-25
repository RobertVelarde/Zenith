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
 * @module shared/utils/storageManager
 */

import { OVERLAY_ZOOM } from '../../config';

const STORAGE_KEY     = 'zenith_state';
const SCHEMA_VERSION  = 1;

function validate(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.version !== SCHEMA_VERSION)  return false;

  const { coords, overlayZoom, mapStyle, use24h, wasGeolocated } = obj;

  if (!coords || typeof coords !== 'object') return false;
  const { lat, lng } = coords;
  if (typeof lat !== 'number' || lat < -90  || lat > 90)   return false;
  if (typeof lng !== 'number' || lng < -180 || lng > 180)  return false;

  if (typeof overlayZoom !== 'number' || overlayZoom < OVERLAY_ZOOM.min || overlayZoom > OVERLAY_ZOOM.max) return false;

  if (!['light', 'dark', 'satellite'].includes(mapStyle)) return false;

  if (typeof use24h       !== 'boolean') return false;
  if (typeof wasGeolocated !== 'boolean') return false;

  return true;
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!validate(obj)) return null;
    const { coords, overlayZoom, mapStyle, use24h, wasGeolocated } = obj;
    return { coords, overlayZoom, mapStyle, use24h, wasGeolocated };
  } catch {
    return null;
  }
}

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
    if (!validate(payload)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

export function clear() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
