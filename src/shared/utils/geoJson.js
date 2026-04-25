/**
 * @file GeoJSON builders for sun and moon map overlays.
 *
 * Each function produces a GeoJSON FeatureCollection that Mapbox GL consumes
 * as a data source.  Features carry `kind` properties that the layer filters
 * in MapView use to apply the correct styling.
 *
 * @module shared/utils/geoJson
 */

import { OVERLAY_RADIUS } from '../../config';

// Scale factors relative to the overlay radius (r)
const SCALE_EVENT_LINE   = 1.3;   // sunrise/set, moonrise/set, heading lines
const SCALE_CURRENT_SUN  = 1.15;  // current sun direction line
const SCALE_SOLAR_NOON   = 0.9;   // solar noon line (slightly shorter)
const SCALE_MOON         = 0.85;  // moon arc + point + direction line

// Azimuth discontinuity guard: bearing diff above this is treated as a wrap
const AZ_JUMP_THRESHOLD = 100;

function project(lat, lng, bearingDeg, dist) {
  const rad = (bearingDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  return [
    lng + (dist * Math.sin(rad)) / Math.cos(latRad),
    lat + dist * Math.cos(rad),
  ];
}

function buildArcSegments(trajectory, lat, lng, r) {
  if (trajectory.length === 0) return [];
  const segments = [];
  let coords = [];
  let prevAbove = trajectory[0].altitudeDeg > 0;
  let prevAz = trajectory[0].azimuthDeg;
  for (const pt of trajectory) {
    const isAbove = pt.altitudeDeg > 0;
    const azDiff = Math.abs(pt.azimuthDeg - prevAz);
    const jump = Math.min(azDiff, 360 - azDiff) > AZ_JUMP_THRESHOLD;
    if ((isAbove !== prevAbove || jump) && coords.length >= 2) {
      segments.push({ above: prevAbove, coords });
      coords = [];
    }
    coords.push(project(lat, lng, pt.azimuthDeg, r));
    prevAbove = isAbove;
    prevAz = pt.azimuthDeg;
  }
  if (coords.length >= 2) segments.push({ above: prevAbove, coords });
  return segments;
}

export function sunArcGeoJSON(trajectory, lat, lng, r = OVERLAY_RADIUS) {
  const segments = buildArcSegments(trajectory, lat, lng, r);
  return {
    type: 'FeatureCollection',
    features: segments.map(({ above, coords }) => ({
      type: 'Feature',
      properties: { kind: above ? 'sun-above' : 'sun-below' },
      geometry: { type: 'LineString', coordinates: coords },
    })),
  };
}

export function sunLinesGeoJSON(sunData, lat, lng, r = OVERLAY_RADIUS) {
  const c = [lng, lat];
  const feats = [];
  const alt = sunData.position.altitude;
  const belowHorizon = alt < 0;

  const add = (type, az, dist = r * SCALE_EVENT_LINE) => {
    if (az == null) return;
    feats.push({
      type: 'Feature',
      properties: { kind: type },
      geometry: { type: 'LineString', coordinates: [c, project(lat, lng, az, dist)] },
    });
  };

  feats.push({
    type: 'Feature',
    properties: {
      kind: belowHorizon ? 'sun-current-below' : 'sun-current',
      altitude: alt,
    },
    geometry: {
      type: 'LineString',
      coordinates: [c, project(lat, lng, sunData.position.azimuth, r * SCALE_CURRENT_SUN)],
    },
  });

  add('sunrise-line', sunData.eventAzimuths.sunrise);
  add('sunset-line', sunData.eventAzimuths.sunset);
  add('solarnoon-line', sunData.eventAzimuths.solarNoon, r * SCALE_SOLAR_NOON);

  return { type: 'FeatureCollection', features: feats };
}

export function sunPointGeoJSON(sunData, lat, lng, r = OVERLAY_RADIUS) {
  const alt = sunData.position.altitude;
  const coord = project(lat, lng, sunData.position.azimuth, r);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: alt >= 0 ? 'sun-point' : 'sun-point-below', altitude: alt },
        geometry: { type: 'Point', coordinates: coord },
      },
    ],
  };
}

export function moonArcGeoJSON(trajectory, lat, lng, r = OVERLAY_RADIUS) {
  const segments = buildArcSegments(trajectory, lat, lng, r * SCALE_MOON);
  return {
    type: 'FeatureCollection',
    features: segments.map(({ above, coords }) => ({
      type: 'Feature',
      properties: { kind: above ? 'moon-above' : 'moon-below' },
      geometry: { type: 'LineString', coordinates: coords },
    })),
  };
}

export function moonPointGeoJSON(moonData, lat, lng, r = OVERLAY_RADIUS) {
  const c = [lng, lat];
  const alt = moonData.position.altitude;
  const belowHorizon = alt < 0;
  const coord = project(lat, lng, moonData.position.azimuth, r * SCALE_MOON);
  const features = [
    {
      type: 'Feature',
      properties: { kind: belowHorizon ? 'moon-line-below' : 'moon-line', altitude: alt },
      geometry: { type: 'LineString', coordinates: [c, coord] },
    },
    {
      type: 'Feature',
      properties: { kind: belowHorizon ? 'moon-point-below' : 'moon-point', altitude: alt },
      geometry: { type: 'Point', coordinates: coord },
    },
  ];

  const az = moonData.eventAzimuths;
  if (az?.moonrise != null) {
    features.push({
      type: 'Feature',
      properties: { kind: 'moonrise-line' },
      geometry: { type: 'LineString', coordinates: [c, project(lat, lng, az.moonrise, r * SCALE_EVENT_LINE)] },
    });
  }
  if (az?.moonset != null) {
    features.push({
      type: 'Feature',
      properties: { kind: 'moonset-line' },
      geometry: { type: 'LineString', coordinates: [c, project(lat, lng, az.moonset, r * SCALE_EVENT_LINE)] },
    });
  }

  return { type: 'FeatureCollection', features };
}

export function headingLineGeoJSON(heading, lat, lng, r = OVERLAY_RADIUS) {
  const tip = project(lat, lng, heading, r * SCALE_EVENT_LINE);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'heading-line' },
        geometry: { type: 'LineString', coordinates: [[lng, lat], tip] },
      },
    ],
  };
}
