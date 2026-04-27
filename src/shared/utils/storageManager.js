/**
 * @file storageManager — client-side state persistence via localStorage.
 *
 * All reads and writes to localStorage go through this module so validation
 * and schema versioning are applied consistently.  Nothing here is
 * React-specific; it can be imported by hooks, utilities, or tests.
 *
 * Stored schema (version 2):
 * {
 *   version:     2,
 *   coords:      { lat: number, lng: number },
 *   overlayZoom: number,
 *   baseMapStyle: 'light' | 'dark',
 *   satelliteEnabled: boolean,
 *   use24h:      boolean,
 *   wasGeolocated: boolean,   // true when coords came from the device GPS
 * }
 *
 * @module shared/utils/storageManager
 */

import { OVERLAY_ZOOM } from '../../config';

const STORAGE_KEY     = 'zenith_state';
const SCHEMA_VERSION  = 2;

function isValidBaseMapStyle(mapStyle) {
  return ['light', 'dark'].includes(mapStyle);
}

function validateV2(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.version !== SCHEMA_VERSION)  return false;

  const { coords, overlayZoom, baseMapStyle, satelliteEnabled, use24h, wasGeolocated } = obj;

  if (!coords || typeof coords !== 'object') return false;
  const { lat, lng } = coords;
  if (typeof lat !== 'number' || lat < -90  || lat > 90)   return false;
  if (typeof lng !== 'number' || lng < -180 || lng > 180)  return false;

  if (typeof overlayZoom !== 'number' || overlayZoom < OVERLAY_ZOOM.min || overlayZoom > OVERLAY_ZOOM.max) return false;

  if (!isValidBaseMapStyle(baseMapStyle)) return false;

  if (typeof satelliteEnabled !== 'boolean') return false;

  if (typeof use24h       !== 'boolean') return false;
  if (typeof wasGeolocated !== 'boolean') return false;

  return true;
}

function validateV1(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.version !== 1) return false;

  const { coords, overlayZoom, mapStyle, use24h, wasGeolocated } = obj;

  if (!coords || typeof coords !== 'object') return false;
  const { lat, lng } = coords;
  if (typeof lat !== 'number' || lat < -90  || lat > 90) return false;
  if (typeof lng !== 'number' || lng < -180 || lng > 180) return false;

  if (typeof overlayZoom !== 'number' || overlayZoom < OVERLAY_ZOOM.min || overlayZoom > OVERLAY_ZOOM.max) return false;
  if (!['light', 'dark', 'satellite'].includes(mapStyle)) return false;
  if (typeof use24h !== 'boolean') return false;
  if (typeof wasGeolocated !== 'boolean') return false;

  return true;
}

function migrateV1State(obj) {
  return {
    coords: obj.coords,
    overlayZoom: obj.overlayZoom,
    baseMapStyle: obj.mapStyle === 'light' ? 'light' : 'dark',
    satelliteEnabled: obj.mapStyle === 'satellite',
    use24h: obj.use24h,
    wasGeolocated: obj.wasGeolocated,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (validateV2(obj)) {
      const { coords, overlayZoom, baseMapStyle, satelliteEnabled, use24h, wasGeolocated } = obj;
      return { coords, overlayZoom, baseMapStyle, satelliteEnabled, use24h, wasGeolocated };
    }
    if (validateV1(obj)) {
      return migrateV1State(obj);
    }
    return null;
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
      baseMapStyle: state.baseMapStyle,
      satelliteEnabled: Boolean(state.satelliteEnabled),
      use24h:       Boolean(state.use24h),
      wasGeolocated: Boolean(state.wasGeolocated),
    };
    if (!validateV2(payload)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

export function clear() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
