/**
 * Manage Mapbox overlay sources/layers and push GeoJSON data.
 *
 * This hook centralizes the imperative Mapbox source/layer registration and
 * the data `setData` calls so that `MapView.jsx` can remain focused on
 * map initialization and event wiring.
 */
import { useEffect, useRef } from 'react';
import { OVERLAY_RADIUS, MAP_LAYER_STYLES as LS } from '../../config';
import {
  sunArcGeoJSON,
  sunLinesGeoJSON,
  sunPointGeoJSON,
  moonArcGeoJSON,
  moonPointGeoJSON,
  headingLineGeoJSON,
} from '../../shared/utils/geoJson';

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

const SOURCES = [
  'sun-arc',
  'sun-lines',
  'sun-point',
  'moon-arc',
  'moon-point',
  'heading-line',
];

function setSourceData(map, id, data) {
  const src = map.getSource(id);
  if (src) src.setData(data);
}

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

function addSourcesAndLayers(map) {
  for (const id of SOURCES) {
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'geojson', data: EMPTY_FC });
    }
  }

  const addIf = (id, spec) => { if (!map.getLayer(id)) map.addLayer(spec); };

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

export default function useMapOverlays(mapRef, overlayData, opts = {}) {
  const { onInitialReady } = opts;
  const overlayDataRef = useRef(overlayData);
  overlayDataRef.current = overlayData;
  const initialReadyRef = useRef(false);

  // Run when the actual map instance becomes available (mapRef.current)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onStyleLoad = () => {
      addSourcesAndLayers(map);
      pushOverlayData(map, overlayDataRef.current);
      if (!initialReadyRef.current) {
        initialReadyRef.current = true;
        onInitialReady?.();
      }
    };

    map.on('style.load', onStyleLoad);
    if (map.isStyleLoaded && map.isStyleLoaded()) {
      addSourcesAndLayers(map);
      pushOverlayData(map, overlayDataRef.current);
      if (!initialReadyRef.current) {
        initialReadyRef.current = true;
        onInitialReady?.();
      }
    }

    return () => {
      map.off('style.load', onStyleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef.current]);

  // Push fresh overlay data whenever the data changes and the map exists.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pushOverlayData(map, overlayData);
    if (!initialReadyRef.current) {
      initialReadyRef.current = true;
      onInitialReady?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayData, mapRef.current]);
}
