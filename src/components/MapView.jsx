/**
 * @file Mapbox GL map component with sun/moon overlay layers.
 *
 * The map instance is created once and stored in a ref.  All subsequent
 * updates (style switches, overlay data, marker position) happen
 * imperatively through the Mapbox API to avoid costly re-mounts.
 *
 * @module components/MapView
 */

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import {
  MAPBOX_TOKEN, DEFAULT_ZOOM, MAP_STYLES,
  MAP_LAYER_STYLES as LS, MARKER_COLOR, LABELS,
} from '../config';
import { useNotification } from '../hooks/notificationContext';
import {
  sunArcGeoJSON,
  sunLinesGeoJSON,
  sunPointGeoJSON,
  moonArcGeoJSON,
  moonPointGeoJSON,
  headingLineGeoJSON,
} from '../utils/geoJson';

mapboxgl.accessToken = MAPBOX_TOKEN;

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

const SOURCES = [
  'sun-arc',
  'sun-lines',
  'sun-point',
  'moon-arc',
  'moon-point',
  'heading-line',
];

/**
 * Interactive map view with celestial overlays.
 *
 * @param {Object} props
 * @param {{ lat: number, lng: number }} props.coords - Current map center.
 * @param {string} props.mapStyle - Active style key ('dark' | 'light' | 'satellite').
 * @param {Array}  props.sunTrajectory  - Sun arc trajectory points.
 * @param {Array}  props.moonTrajectory - Moon arc trajectory points.
 * @param {Object} props.sunData  - Current sun calculation results.
 * @param {Object} props.moonData - Current moon calculation results.
 * @param {Function} props.onMapClick - Callback when the map is clicked.
 * @param {React.MutableRefObject} props.mapRef - Shared ref for the Mapbox instance.
 */
export default function MapView({
  coords,
  mapStyle,
  sunTrajectory,
  moonTrajectory,
  sunData,
  moonData,
  overlayRadius,
  heading,
  onMapClick,
  mapRef,
  onUserInteraction,
}) {
  const containerRef = useRef(null);
  const markerRef = useRef(null);
  const { notify } = useNotification();

  // Ref that always holds the latest overlay data so the style.load handler
  // can push it synchronously without waiting for a React re-render.
  const overlayDataRef = useRef({ coords, sunTrajectory, moonTrajectory, sunData, moonData, overlayRadius, heading });
  overlayDataRef.current = { coords, sunTrajectory, moonTrajectory, sunData, moonData, overlayRadius, heading };

  // Stable ref for the optional onUserInteraction callback so listeners
  // don't need re-registering when the prop changes.
  const onUserInteractionRef = useRef(onUserInteraction);
  useEffect(() => { onUserInteractionRef.current = onUserInteraction; }, [onUserInteraction]);

  // Track which Mapbox style URL is currently applied so the switch-style
  // effect can skip the initial no-op.
  const appliedStyleRef = useRef(MAP_STYLES[mapStyle] || MAP_STYLES.dark);

  /* ---- Initialise map ---- */
  useEffect(() => {
    let map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: appliedStyleRef.current,
        center: [coords.lng, coords.lat],
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
        zoomControl: false,
      });
    } catch {
      notify(LABELS.mapLoadFailed, 'error');
      return;
    }

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    mapRef.current = map;

    map.on('style.load', () => {
      addSourcesAndLayers(map);
      pushOverlayData(map, overlayDataRef.current);
    });

    map.on('click', (e) => {
      onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    // Consider genuine user-initiated movements (drag/wheel) as user
    // interaction. Programmatic camera moves (flyTo / fitBounds) do not
    // include an originalEvent on the Mapbox event, so we check for it.
    const emitInteraction = (ev) => {
      if (!ev || !ev.originalEvent) return; // ignore programmatic moves
      onUserInteractionRef.current?.();
    };
    map.on('movestart', emitInteraction);
    map.on('dragstart', emitInteraction);
    const container = containerRef.current;
    const wheelHandler = (ev) => { onUserInteractionRef.current?.(); };
    if (container) container.addEventListener('wheel', wheelHandler, { passive: true });

    map.on('error', (e) => {
      // Suppress tile-level 404s (expected), surface real errors.
      if (e?.error?.status !== 404) {
        console.error('[MapView]', e.error?.message || e);
      }
    });

    markerRef.current = new mapboxgl.Marker({ color: MARKER_COLOR })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);

    return () => {
      map.off('movestart', emitInteraction);
      map.off('dragstart', emitInteraction);
      if (container) container.removeEventListener('wheel', wheelHandler);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef]);

  /* ---- Update marker on coord change ---- */
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLngLat([coords.lng, coords.lat]);
    }
  }, [coords]);

  /* ---- Switch style ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const newStyle = MAP_STYLES[mapStyle] || MAP_STYLES.dark;
    // Skip when the style URL hasn't actually changed (avoids a redundant
    // reload on initial mount that wipes the sources just added by the first
    // style.load).
    if (appliedStyleRef.current === newStyle) return;
    appliedStyleRef.current = newStyle;
    map.setStyle(newStyle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]);

  /* ---- Update overlay data ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pushOverlayData(map, { coords, sunTrajectory, moonTrajectory, sunData, moonData, overlayRadius, heading });
  }, [coords, sunTrajectory, moonTrajectory, sunData, moonData, overlayRadius, heading, mapRef]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full" />
  );
}

/**
 * Safely set GeoJSON data on a map source if it exists.
 *
 * @param {mapboxgl.Map} map - The Mapbox instance.
 * @param {string} id        - Source ID.
 * @param {Object} data      - GeoJSON FeatureCollection.
 */
function setSourceData(map, id, data) {
  const src = map.getSource(id);
  if (src) src.setData(data);
}

/**
 * Push the latest celestial overlay data to all map sources.
 *
 * @param {mapboxgl.Map} map - The Mapbox instance.
 * @param {Object} payload   - Contains coords, sunTrajectory, moonTrajectory, sunData, moonData.
 */
function pushOverlayData(map, { coords, sunTrajectory, moonTrajectory, sunData, moonData, overlayRadius = OVERLAY_RADIUS, heading }) {
  if (!coords) return;
  const { lat, lng } = coords;
  const r = overlayRadius;
  setSourceData(map, 'sun-arc', sunTrajectory ? sunArcGeoJSON(sunTrajectory, lat, lng, r) : EMPTY_FC);
  setSourceData(map, 'sun-lines', sunData ? sunLinesGeoJSON(sunData, lat, lng, r) : EMPTY_FC);
  setSourceData(map, 'sun-point', sunData ? sunPointGeoJSON(sunData, lat, lng, r) : EMPTY_FC);
  setSourceData(map, 'moon-arc', moonTrajectory ? moonArcGeoJSON(moonTrajectory, lat, lng, r) : EMPTY_FC);
  setSourceData(map, 'moon-point', moonData ? moonPointGeoJSON(moonData, lat, lng, r) : EMPTY_FC);
  setSourceData(map, 'heading-line', heading != null ? headingLineGeoJSON(heading, lat, lng, r) : EMPTY_FC);
}

/**
 * Register all GeoJSON sources and styled layers on the map.
 *
 * Called on every `style.load` event (initial + after `setStyle` calls)
 * because Mapbox discards custom sources/layers when the base style reloads.
 *
 * @param {mapboxgl.Map} map - The Mapbox instance.
 */
function addSourcesAndLayers(map) {
  for (const id of SOURCES) {
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'geojson', data: EMPTY_FC });
    }
  }

  const addIf = (id, spec) => { if (!map.getLayer(id)) map.addLayer(spec); };

  // ---- Sun layers ----
  addIf('sun-arc-above', {
    id: 'sun-arc-above', source: 'sun-arc', type: 'line',
    filter: ['==', ['get', 'kind'], 'sun-above'],
    paint: { 'line-color': LS.sunArcAbove.color, 'line-width': LS.sunArcAbove.width, 'line-opacity': LS.sunArcAbove.opacity },
  });
  addIf('sun-arc-below', {
    id: 'sun-arc-below', source: 'sun-arc', type: 'line',
    filter: ['==', ['get', 'kind'], 'sun-below'],
    paint: { 'line-color': LS.sunArcBelow.color, 'line-width': LS.sunArcBelow.width, 'line-opacity': LS.sunArcBelow.opacity, 'line-dasharray': LS.sunArcBelow.dasharray },
  });
  addIf('sunrise-line', {
    id: 'sunrise-line', source: 'sun-lines', type: 'line',
    filter: ['==', ['get', 'kind'], 'sunrise-line'],
    paint: { 'line-color': LS.sunriseLine.color, 'line-width': LS.sunriseLine.width, 'line-opacity': LS.sunriseLine.opacity },
  });
  addIf('sunset-line', {
    id: 'sunset-line', source: 'sun-lines', type: 'line',
    filter: ['==', ['get', 'kind'], 'sunset-line'],
    paint: { 'line-color': LS.sunsetLine.color, 'line-width': LS.sunsetLine.width, 'line-opacity': LS.sunsetLine.opacity },
  });
  addIf('solarnoon-line', {
    id: 'solarnoon-line', source: 'sun-lines', type: 'line',
    filter: ['==', ['get', 'kind'], 'solarnoon-line'],
    paint: { 'line-color': LS.solarNoonLine.color, 'line-width': LS.solarNoonLine.width, 'line-opacity': LS.solarNoonLine.opacity, 'line-dasharray': LS.solarNoonLine.dasharray },
  });
  addIf('sun-current-line', {
    id: 'sun-current-line', source: 'sun-lines', type: 'line',
    filter: ['==', ['get', 'kind'], 'sun-current'],
    paint: { 'line-color': LS.sunCurrentLine.color, 'line-width': LS.sunCurrentLine.width, 'line-opacity': LS.sunCurrentLine.opacity },
  });
  addIf('sun-current-line-below', {
    id: 'sun-current-line-below', source: 'sun-lines', type: 'line',
    filter: ['==', ['get', 'kind'], 'sun-current-below'],
    paint: { 'line-color': LS.sunCurrentBelow.color, 'line-width': LS.sunCurrentBelow.width, 'line-opacity': LS.sunCurrentBelow.opacity, 'line-dasharray': LS.sunCurrentBelow.dasharray },
  });
  addIf('sun-circle', {
    id: 'sun-circle', source: 'sun-point', type: 'circle',
    filter: ['==', ['get', 'kind'], 'sun-point'],
    paint: { 'circle-radius': LS.sunPoint.radius, 'circle-color': LS.sunPoint.color, 'circle-stroke-width': LS.sunPoint.strokeWidth, 'circle-stroke-color': LS.sunPoint.strokeColor, 'circle-opacity': LS.sunPoint.opacity },
  });
  addIf('sun-circle-below', {
    id: 'sun-circle-below', source: 'sun-point', type: 'circle',
    filter: ['==', ['get', 'kind'], 'sun-point-below'],
    paint: { 'circle-radius': LS.sunPointBelow.radius, 'circle-color': LS.sunPointBelow.color, 'circle-stroke-width': LS.sunPointBelow.strokeWidth, 'circle-stroke-color': LS.sunPointBelow.strokeColor, 'circle-opacity': LS.sunPointBelow.opacity },
  });

  // ---- Moon layers ----
  addIf('moon-arc-above', {
    id: 'moon-arc-above', source: 'moon-arc', type: 'line',
    filter: ['==', ['get', 'kind'], 'moon-above'],
    paint: { 'line-color': LS.moonArcAbove.color, 'line-width': LS.moonArcAbove.width, 'line-opacity': LS.moonArcAbove.opacity },
  });
  addIf('moon-arc-below', {
    id: 'moon-arc-below', source: 'moon-arc', type: 'line',
    filter: ['==', ['get', 'kind'], 'moon-below'],
    paint: { 'line-color': LS.moonArcBelow.color, 'line-width': LS.moonArcBelow.width, 'line-opacity': LS.moonArcBelow.opacity, 'line-dasharray': LS.moonArcBelow.dasharray },
  });
  addIf('moon-dir-line', {
    id: 'moon-dir-line', source: 'moon-point', type: 'line',
    filter: ['==', ['get', 'kind'], 'moon-line'],
    paint: { 'line-color': LS.moonDirLine.color, 'line-width': LS.moonDirLine.width, 'line-opacity': LS.moonDirLine.opacity },
  });
  addIf('moon-dir-line-below', {
    id: 'moon-dir-line-below', source: 'moon-point', type: 'line',
    filter: ['==', ['get', 'kind'], 'moon-line-below'],
    paint: { 'line-color': LS.moonDirLineBelow.color, 'line-width': LS.moonDirLineBelow.width, 'line-opacity': LS.moonDirLineBelow.opacity, 'line-dasharray': LS.moonDirLineBelow.dasharray },
  });
  addIf('moonrise-line', {
    id: 'moonrise-line', source: 'moon-point', type: 'line',
    filter: ['==', ['get', 'kind'], 'moonrise-line'],
    paint: { 'line-color': LS.moonriseLine.color, 'line-width': LS.moonriseLine.width, 'line-opacity': LS.moonriseLine.opacity },
  });
  addIf('moonset-line', {
    id: 'moonset-line', source: 'moon-point', type: 'line',
    filter: ['==', ['get', 'kind'], 'moonset-line'],
    paint: { 'line-color': LS.moonsetLine.color, 'line-width': LS.moonsetLine.width, 'line-opacity': LS.moonsetLine.opacity },
  });
  addIf('moon-circle', {
    id: 'moon-circle', source: 'moon-point', type: 'circle',
    filter: ['==', ['get', 'kind'], 'moon-point'],
    paint: { 'circle-radius': LS.moonPoint.radius, 'circle-color': LS.moonPoint.color, 'circle-stroke-width': LS.moonPoint.strokeWidth, 'circle-stroke-color': LS.moonPoint.strokeColor, 'circle-opacity': LS.moonPoint.opacity },
  });
  addIf('moon-circle-below', {
    id: 'moon-circle-below', source: 'moon-point', type: 'circle',
    filter: ['==', ['get', 'kind'], 'moon-point-below'],
    paint: { 'circle-radius': LS.moonPointBelow.radius, 'circle-color': LS.moonPointBelow.color, 'circle-stroke-width': LS.moonPointBelow.strokeWidth, 'circle-stroke-color': LS.moonPointBelow.strokeColor, 'circle-opacity': LS.moonPointBelow.opacity },
  });

  // ---- Compass heading line ----
  addIf('heading-line', {
    id: 'heading-line', source: 'heading-line', type: 'line',
    filter: ['==', ['get', 'kind'], 'heading-line'],
    paint: {
      'line-color': '#22d3ee',
      'line-width': 2.5,
      'line-opacity': 0.9,
    },
  });
}
