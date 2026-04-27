import { OVERLAY_RADIUS } from '../../config';

const COMPASS_MAJOR_STEP = 10;
const COMPASS_MINOR_STEP = 5;

const MAJOR_TICK_INNER_SCALE = 1.00;
const MAJOR_TICK_OUTER_SCALE = 1.1;
const MINOR_TICK_INNER_SCALE = 1.00;
const MINOR_TICK_OUTER_SCALE = 1.05;
const LABEL_RADIUS_SCALE = 1.2;

function project(lat, lng, bearingDeg, dist) {
  const rad = (bearingDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  return [
    lng + (dist * Math.sin(rad)) / Math.cos(latRad),
    lat + dist * Math.cos(rad),
  ];
}

function degreeLabel(deg) {
  if (deg === 0) return 'N';
  if (deg === 90) return 'E';
  if (deg === 180) return 'S';
  if (deg === 270) return 'W';
  return String(deg);
}

export function compassArcGeoJSON(lat, lng, r = OVERLAY_RADIUS) {
    // draw a circle path with radius r around (lat, lng) for compass ticks/labels to sit on
    const coords = [];
    for (let deg = 0; deg < 360; deg += 5) {
        coords.push(project(lat, lng, deg, r));
    }
    // close the loop
    coords.push(coords[0]); 
    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: { kind: 'compass-arc' },
            geometry: { type: 'LineString', coordinates: coords },
        }],
    };
}

export function compassTicksGeoJSON(lat, lng, r = OVERLAY_RADIUS) {
  const features = [];

  for (let deg = 0; deg < 360; deg += COMPASS_MINOR_STEP) {
    const isMinor = deg % COMPASS_MAJOR_STEP !== 0;
    const innerScale = isMinor ? MINOR_TICK_INNER_SCALE : MAJOR_TICK_INNER_SCALE;
    const outerScale = isMinor ? MINOR_TICK_OUTER_SCALE : MAJOR_TICK_OUTER_SCALE;

    features.push({
      type: 'Feature',
      properties: { kind: isMinor ? 'compass-tick-minor' : 'compass-tick-major' },
      geometry: {
        type: 'LineString',
        coordinates: [
          project(lat, lng, deg, r * innerScale),
          project(lat, lng, deg, r * outerScale),
        ],
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

export function compassLabelsGeoJSON(lat, lng, r = OVERLAY_RADIUS) {
  const features = [];

  for (let deg = 0; deg < 360; deg += COMPASS_MAJOR_STEP) {
    features.push({
      type: 'Feature',
      properties: {
        kind: 'compass-label',
        label: degreeLabel(deg),
      },
      geometry: {
        type: 'Point',
        coordinates: project(lat, lng, deg, r * LABEL_RADIUS_SCALE),
      },
    });
  }

  return { type: 'FeatureCollection', features };
}
