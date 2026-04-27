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
const SCALE_EVENT_LINE   = 1.0;   // sunrise/set, moonrise/set, heading lines
const SCALE_CURRENT_SUN  = 1.0;  // current sun direction line
const SCALE_CURRENT_MOON = 1.0;  // current moon direction line
const SCALE_SOLAR_NOON   = 1.0;   // solar noon line (slightly shorter)
const SCALE_MOON         = 1.0;  // moon arc + point + direction line

const LINE_START_OFFSET = 0.0; // factor to start lines slightly away from center for better visibility
const LINE_END_OFFSET = 1.075; // factor to extend lines beyond the arc radius for better visibility

// Azimuth discontinuity guard: bearing diff above this is treated as a wrap
const AZ_JUMP_THRESHOLD = 100;

function project(lat, lng, bearingDeg, dist, radiusOffset = 0) {
  const rad = (bearingDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  return [
    lng + ((dist + radiusOffset) * Math.sin(rad)) / Math.cos(latRad),
    lat + (dist + radiusOffset) * Math.cos(rad),
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
    
    const altitudeRad = pt.altitudeDeg * (Math.PI / 180);
    const scaledR = r * Math.cos(altitudeRad);
    coords.push(project(lat, lng, pt.azimuthDeg, scaledR));
    
    prevAbove = isAbove;
    prevAz = pt.azimuthDeg;
  }
  
  if (coords.length >= 2) segments.push({ above: prevAbove, coords });
  return segments;
}

export function sunArcGeoJSON(trajectory, lat, lng, r = OVERLAY_RADIUS) {
  const segments = buildArcSegments(trajectory, lat, lng, r);

  // Sun path
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
  const altitudeRad = alt * (Math.PI / 180);
  const scaledR = r * Math.cos(altitudeRad);

  const add = (type, az, dist = r * SCALE_EVENT_LINE) => {
    if (az == null) return;
    feats.push({
      type: 'Feature',
      properties: { kind: type },
      geometry: { type: 'LineString', coordinates: [
        project(lat, lng, az, dist), 
        project(lat, lng, az, r * LINE_END_OFFSET),
      ] },
    });
  };

  // Current sun direction line
  feats.push({
    type: 'Feature',
    properties: {
      kind: belowHorizon ? 'sun-current-below' : 'sun-current',
      altitude: alt,
    },
    geometry: {
      type: 'LineString',
      coordinates: [
        project(lat, lng, sunData.position.azimuth, r),
        project(lat, lng, sunData.position.azimuth, r * LINE_END_OFFSET),
      ],
    },
  });

  add('sunrise-line', sunData.eventAzimuths.sunrise);
  add('sunset-line', sunData.eventAzimuths.sunset);

  return { type: 'FeatureCollection', features: feats };
}

export function sunPointGeoJSON(sunData, lat, lng, r = OVERLAY_RADIUS) {
  const alt = sunData.position.altitude;
  const altitudeRad = alt * (Math.PI / 180);
  const scaledR = r * Math.cos(altitudeRad);
  const coord = project(lat, lng, sunData.position.azimuth, scaledR);
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

export function moonLinesGeoJSON(moonData, lat, lng, r = OVERLAY_RADIUS) {
  const c = [lng, lat];
  const feats = [];
  const alt = moonData.position.altitude;
  const belowHorizon = alt < 0;
  const altitudeRad = alt * (Math.PI / 180);
  const scaledR = r * Math.cos(altitudeRad);

  const add = (type, az, dist = r * SCALE_EVENT_LINE) => {
    if (az == null) return;
    feats.push({
      type: 'Feature',
      properties: { kind: type },
      geometry: { type: 'LineString', coordinates: [
        project(lat, lng, az, dist), 
        project(lat, lng, az, r * LINE_END_OFFSET),
      ] },
    });
  };

  // Current moon direction line
  feats.push({
    type: 'Feature',
    properties: {
      kind: belowHorizon ? 'moon-current-below' : 'moon-current',
      altitude: alt,
    },
    geometry: {
      type: 'LineString',
      coordinates: [
        project(lat, lng, moonData.position.azimuth, r),
        project(lat, lng, moonData.position.azimuth, r * LINE_END_OFFSET),
      ],
    },
  });

  add('moonrise-line', moonData.eventAzimuths.moonrise);
  add('moonset-line', moonData.eventAzimuths.moonset);

  return { type: 'FeatureCollection', features: feats };
}

export function moonPointGeoJSON(moonData, lat, lng, r = OVERLAY_RADIUS) {
  const alt = moonData.position.altitude;
  const altitudeRad = alt * (Math.PI / 180);
  const scaledR = r * Math.cos(altitudeRad) * SCALE_MOON;
  const coord = project(lat, lng, moonData.position.azimuth, scaledR);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: alt >= 0 ? 'moon-point' : 'moon-point-below', altitude: alt },
        geometry: { type: 'Point', coordinates: coord },
      },
    ],
  };
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
