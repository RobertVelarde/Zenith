/**
 * Manage Mapbox overlay sources/layers and push GeoJSON data.
 *
 * This hook centralizes the imperative Mapbox source/layer registration and
 * the data `setData` calls so that `MapView.jsx` can remain focused on
 * map initialization and event wiring.
 */
import { useEffect, useRef } from 'react';
import { OVERLAY_RADIUS, MAP_LAYER_STYLES as LS, COMPASS_THEME_STYLES, LAYOUT } from '../../config';
import {
  sunArcGeoJSON,
  sunLinesGeoJSON,
  sunPointGeoJSON,
  moonArcGeoJSON,
  moonLinesGeoJSON,
  moonPointGeoJSON,
  headingLineGeoJSON,
} from '../../shared/utils/geoJson';
import { compassArcGeoJSON, compassTicksGeoJSON, compassLabelsGeoJSON } from './compassGeoJson';

const EMPTY_FC = { type: 'FeatureCollection', features: [] };
const OVERLAY_FADE_DURATION_MS = 300;

const SOURCES = [
  'sun-arc',
  'sun-lines',
  'sun-point',
  'moon-arc',
  'moon-lines',
  'moon-point',
  'compass-arc',
  'compass-ticks',
  'compass-labels',
  'heading-line',
];

const OVERLAY_DYNAMIC_LAYER_OPACITY = [
  // Compass layers
  ['compass-label', 'text-opacity', LS.compassLabel.opacity],
  //['compass-arc', 'line-opacity', LS.compassMajorTick.opacity],
  //['compass-tick-major', 'line-opacity', LS.compassMajorTick.opacity],
  //['compass-tick-minor', 'line-opacity', LS.compassMinorTick.opacity],

  // Sun layers
  ['sun-circle', 'circle-opacity', LS.sunPoint.opacity],
  ['sun-circle', 'circle-stroke-opacity', LS.sunPoint.strokeOpacity],
  ['sun-circle-below', 'circle-opacity', LS.sunPointBelow.opacity],
  ['sun-circle-below', 'circle-stroke-opacity', LS.sunPointBelow.strokeOpacity],
  //['sun-arc-above', 'line-opacity', LS.sunArcAbove.opacity],
  //['sun-arc-below', 'line-opacity', LS.sunArcBelow.opacity],
  //['sunrise-line', 'line-opacity', LS.sunriseLine.opacity],
  //['sunset-line', 'line-opacity', LS.sunsetLine.opacity],
  ['sun-current-line', 'line-opacity', LS.sunCurrentLine.opacity],
  ['sun-current-line-below', 'line-opacity', LS.sunCurrentBelow.opacity],

  // Moon layers
  ['moon-circle', 'circle-opacity', LS.moonPoint.opacity],
  ['moon-circle', 'circle-stroke-opacity', LS.moonPoint.strokeOpacity],
  ['moon-circle-below', 'circle-opacity', LS.moonPointBelow.opacity],
  ['moon-circle-below', 'circle-stroke-opacity', LS.moonPointBelow.strokeOpacity],
  //['moon-arc-above', 'line-opacity', LS.moonArcAbove.opacity],
  //['moon-arc-below', 'line-opacity', LS.moonArcBelow.opacity],
  //['moonrise-line', 'line-opacity', LS.moonriseLine.opacity],
  //['moonset-line', 'line-opacity', LS.moonsetLine.opacity],
  ['moon-current-line', 'line-opacity', LS.moonCurrentLine.opacity],
  ['moon-current-line-below', 'line-opacity', LS.moonCurrentBelow.opacity],
];

const OVERLAY_STATIC_LAYER_OPACITY = [
  // Compass layers
  ['compass-arc', 'line-opacity', LS.compassMajorTick.opacity],
  ['compass-tick-major', 'line-opacity', LS.compassMajorTick.opacity],
  ['compass-tick-minor', 'line-opacity', LS.compassMinorTick.opacity],

  // Sun layers
  ['sun-arc-above', 'line-opacity', LS.sunArcAbove.opacity],
  ['sun-arc-below', 'line-opacity', LS.sunArcBelow.opacity],
  ['sunrise-line', 'line-opacity', LS.sunriseLine.opacity],
  ['sunset-line', 'line-opacity', LS.sunsetLine.opacity],

  // Moon layers
  ['moon-arc-above', 'line-opacity', LS.moonArcAbove.opacity],
  ['moon-arc-below', 'line-opacity', LS.moonArcBelow.opacity],
  ['moonrise-line', 'line-opacity', LS.moonriseLine.opacity],
  ['moonset-line', 'line-opacity', LS.moonsetLine.opacity],
];

function getCompassTheme(mapStyle) {
  return mapStyle === 'light' ? COMPASS_THEME_STYLES.light : COMPASS_THEME_STYLES.dark;
}

function applyCompassTheme(map, mapStyle) {
  const compassTheme = getCompassTheme(mapStyle);

  if (map.getLayer('compass-tick-major')) {
    map.setPaintProperty('compass-tick-major', 'line-color', compassTheme.majorTick.color);
  }
  if (map.getLayer('compass-tick-minor')) {
    map.setPaintProperty('compass-tick-minor', 'line-color', compassTheme.minorTick.color);
  }
  if (map.getLayer('compass-arc')) {
    map.setPaintProperty('compass-arc', 'line-color', compassTheme.majorTick.color);
  }
  if (map.getLayer('compass-label')) {
    map.setPaintProperty('compass-label', 'text-color', compassTheme.label.color);
    map.setPaintProperty('compass-label', 'text-halo-color', compassTheme.label.haloColor);
  }
}

function setLayerGroupVisibility(map, layers, visible) {
  for (const [layerId, opacityProperty, defaultOpacity] of layers) {
    if (!map.getLayer(layerId)) continue;
    map.setPaintProperty(layerId, `${opacityProperty}-transition`, { duration: OVERLAY_FADE_DURATION_MS });
    map.setPaintProperty(layerId, opacityProperty, visible ? defaultOpacity : 0);
  }
}

function setDynamicOverlayVisibility(map, visible) {
  setLayerGroupVisibility(map, OVERLAY_DYNAMIC_LAYER_OPACITY, visible);
}

function setStaticOverlayVisibility(map, visible) {
  setLayerGroupVisibility(map, OVERLAY_STATIC_LAYER_OPACITY, visible);
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth < LAYOUT.mobileBreakpoint;
}

function setSourceData(map, id, data) {
  const src = map.getSource(id);
  if (src) src.setData(data);
}

function pushOverlayData(map, { coords, sunTrajectory, moonTrajectory, sunData, moonData, overlayRadius = OVERLAY_RADIUS, heading }) {
  if (!coords) return;
  const { lat, lng } = coords;
  const r = overlayRadius;
  // Compass ring outside radius r (5 deg minors, 10 deg majors + labels)
  setSourceData(map, 'compass-arc', compassArcGeoJSON(lat, lng, r));
  setSourceData(map, 'compass-ticks', compassTicksGeoJSON(lat, lng, r));
  setSourceData(map, 'compass-labels', compassLabelsGeoJSON(lat, lng, r));
  
  setSourceData(map, 'sun-arc', sunTrajectory ? sunArcGeoJSON(sunTrajectory, lat, lng, r) : EMPTY_FC);
  setSourceData(map, 'moon-arc', moonTrajectory ? moonArcGeoJSON(moonTrajectory, lat, lng, r) : EMPTY_FC);
  setSourceData(map, 'sun-lines', sunData ? sunLinesGeoJSON(sunData, lat, lng, r) : EMPTY_FC);
  setSourceData(map, 'sun-point', sunData ? sunPointGeoJSON(sunData, lat, lng, r) : EMPTY_FC);
  setSourceData(map, 'moon-lines', moonData ? moonLinesGeoJSON(moonData, lat, lng, r) : EMPTY_FC);
  setSourceData(map, 'moon-point', moonData ? moonPointGeoJSON(moonData, lat, lng, r) : EMPTY_FC);
  setSourceData(map, 'heading-line', heading != null ? headingLineGeoJSON(heading, lat, lng, r) : EMPTY_FC);
}

function addSourcesAndLayers(map, mapStyle) {
  const compassTheme = getCompassTheme(mapStyle);

  for (const id of SOURCES) {
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'geojson', data: EMPTY_FC });
    }
  }

  const addIf = (id, spec) => { if (!map.getLayer(id)) map.addLayer(spec); };

  // Below arcs
  addIf('sun-arc-below', {
    id: 'sun-arc-below', source: 'sun-arc', type: 'line',
    filter: ['==', ['get', 'kind'], 'sun-below'],
    paint: { 'line-color': LS.sunArcBelow.color, 'line-width': LS.sunArcBelow.width, 'line-opacity': LS.sunArcBelow.opacity, 'line-dasharray': LS.sunArcBelow.dasharray },
  });
  addIf('moon-arc-below', {
    id: 'moon-arc-below', source: 'moon-arc', type: 'line',
    filter: ['==', ['get', 'kind'], 'moon-below'],
    paint: { 'line-color': LS.moonArcBelow.color, 'line-width': LS.moonArcBelow.width, 'line-opacity': LS.moonArcBelow.opacity, 'line-dasharray': LS.moonArcBelow.dasharray },
  });

  // Below circles
  addIf('sun-circle-below', {
    id: 'sun-circle-below', source: 'sun-point', type: 'circle',
    filter: ['==', ['get', 'kind'], 'sun-point-below'],
    paint: { 'circle-radius': LS.sunPointBelow.radius, 'circle-color': LS.sunPointBelow.color, 'circle-stroke-width': LS.sunPointBelow.strokeWidth, 'circle-stroke-color': LS.sunPointBelow.strokeColor, 'circle-stroke-opacity': LS.sunPointBelow.opacity, 'circle-opacity': LS.sunPointBelow.opacity },
  });
  addIf('moon-circle-below', {
    id: 'moon-circle-below', source: 'moon-point', type: 'circle',
    filter: ['==', ['get', 'kind'], 'moon-point-below'],
    paint: { 'circle-radius': LS.moonPointBelow.radius, 'circle-color': LS.moonPointBelow.color, 'circle-stroke-width': LS.moonPointBelow.strokeWidth, 'circle-stroke-color': LS.moonPointBelow.strokeColor, 'circle-stroke-opacity': LS.moonPointBelow.opacity, 'circle-opacity': LS.moonPointBelow.opacity },
  });

  // Above arcs
  addIf('sun-arc-above', {
    id: 'sun-arc-above', source: 'sun-arc', type: 'line',
    filter: ['==', ['get', 'kind'], 'sun-above'],
    paint: { 'line-color': LS.sunArcAbove.color, 'line-width': LS.sunArcAbove.width, 'line-opacity': LS.sunArcAbove.opacity },
  });
  addIf('moon-arc-above', {
    id: 'moon-arc-above', source: 'moon-arc', type: 'line',
    filter: ['==', ['get', 'kind'], 'moon-above'],
    paint: { 'line-color': LS.moonArcAbove.color, 'line-width': LS.moonArcAbove.width, 'line-opacity': LS.moonArcAbove.opacity },
  });

  addIf('compass-tick-major', {
    id: 'compass-tick-major', source: 'compass-ticks', type: 'line',
    filter: ['==', ['get', 'kind'], 'compass-tick-major'],
    paint: {
      'line-color': compassTheme.majorTick.color,
      'line-width': LS.compassMajorTick.width,
      'line-opacity': LS.compassMajorTick.opacity,
    },
  });
  addIf('compass-tick-minor', {
    id: 'compass-tick-minor', source: 'compass-ticks', type: 'line',
    filter: ['==', ['get', 'kind'], 'compass-tick-minor'],
    paint: {
      'line-color': compassTheme.minorTick.color,
      'line-width': LS.compassMinorTick.width,
      'line-opacity': LS.compassMinorTick.opacity,
    },
  });
  addIf('compass-arc', {
    id: 'compass-arc', source: 'compass-arc', type: 'line',
    filter: ['==', ['get', 'kind'], 'compass-arc'],
    paint: {
      'line-color': compassTheme.majorTick.color,
      'line-width': LS.compassMajorTick.width,
      'line-opacity': LS.compassMajorTick.opacity,
    },
  });
  addIf('compass-label', {
    id: 'compass-label', source: 'compass-labels', type: 'symbol',
    filter: ['==', ['get', 'kind'], 'compass-label'],
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 12,
      'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
      'text-anchor': 'center',
      'text-justify': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': compassTheme.label.color,
      'text-halo-color': compassTheme.label.haloColor,
      'text-halo-width': LS.compassLabel.haloWidth,
      'text-opacity': LS.compassLabel.opacity,
    },
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
    id: 'moonrise-line', source: 'moon-lines', type: 'line',
    filter: ['==', ['get', 'kind'], 'moonrise-line'],
    paint: { 'line-color': LS.moonriseLine.color, 'line-width': LS.moonriseLine.width, 'line-opacity': LS.moonriseLine.opacity },
  });
  addIf('moonset-line', {
    id: 'moonset-line', source: 'moon-lines', type: 'line',
    filter: ['==', ['get', 'kind'], 'moonset-line'],
    paint: { 'line-color': LS.moonsetLine.color, 'line-width': LS.moonsetLine.width, 'line-opacity': LS.moonsetLine.opacity },
  });
  addIf('moon-current-line', {
    id: 'moon-current-line', source: 'moon-lines', type: 'line',
    filter: ['==', ['get', 'kind'], 'moon-current'],
    paint: { 'line-color': LS.moonCurrentLine.color, 'line-width': LS.moonCurrentLine.width, 'line-opacity': LS.moonCurrentLine.opacity },
  });
  addIf('moon-current-line-below', {
    id: 'moon-current-line-below', source: 'moon-lines', type: 'line',
    filter: ['==', ['get', 'kind'], 'moon-current-below'],
    paint: { 'line-color': LS.moonCurrentBelow.color, 'line-width': LS.moonCurrentBelow.width, 'line-opacity': LS.moonCurrentBelow.opacity, 'line-dasharray': LS.moonCurrentBelow.dasharray },
  });
  addIf('moon-circle', {
    id: 'moon-circle', source: 'moon-point', type: 'circle',
    filter: ['==', ['get', 'kind'], 'moon-point'],
    paint: { 'circle-radius': LS.moonPoint.radius, 'circle-color': LS.moonPoint.color, 'circle-stroke-width': LS.moonPoint.strokeWidth, 'circle-stroke-color': LS.moonPoint.strokeColor, 'circle-stroke-opacity': LS.moonPoint.opacity, 'circle-opacity': LS.moonPoint.opacity },
  });
  addIf('sun-circle', {
    id: 'sun-circle', source: 'sun-point', type: 'circle',
    filter: ['==', ['get', 'kind'], 'sun-point'],
    paint: { 'circle-radius': LS.sunPoint.radius, 'circle-color': LS.sunPoint.color, 'circle-stroke-width': LS.sunPoint.strokeWidth, 'circle-stroke-color': LS.sunPoint.strokeColor, 'circle-stroke-opacity': LS.sunPoint.opacity, 'circle-opacity': LS.sunPoint.opacity },
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
  const { onInitialReady, zenithBlue, zenithGold, mapStyle } = opts;
  const overlayDataRef = useRef(overlayData);
  overlayDataRef.current = overlayData;
  const mapStyleRef = useRef(mapStyle);
  mapStyleRef.current = mapStyle;
  const initialReadyRef = useRef(false);
  const dynamicVisibleRef = useRef(true);
  const staticVisibleRef = useRef(true);
  const mapMovingRef = useRef(false);
  const pendingOverlayDataRef = useRef(false);
  const moveModeRef = useRef('camera-only'); // camera-only | radius-change | coords-change
  const previousDataRef = useRef({ coords: overlayData?.coords, overlayRadius: overlayData?.overlayRadius });
  const zenithBlueRef = useRef(zenithBlue);
  const zenithGoldRef = useRef(zenithGold);

  // Keep refs in sync with prop changes
  useEffect(() => {
    zenithBlueRef.current = zenithBlue;
    zenithGoldRef.current = zenithGold;

    const map = mapRef.current;
    if (!map) return;
    const hasZenith = zenithBlue || zenithGold;

    if (!hasZenith) {
      dynamicVisibleRef.current = false;
      staticVisibleRef.current = false;
      setDynamicOverlayVisibility(map, false);
      setStaticOverlayVisibility(map, false);
      return;
    }

    if (!mapMovingRef.current) {
      dynamicVisibleRef.current = true;
      staticVisibleRef.current = true;
      setDynamicOverlayVisibility(map, true);
      setStaticOverlayVisibility(map, true);
    }
  }, [zenithBlue, zenithGold]);

  // Run when the actual map instance becomes available (mapRef.current)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onStyleLoad = () => {
      addSourcesAndLayers(map, mapStyleRef.current);
      pushOverlayData(map, overlayDataRef.current);
      setDynamicOverlayVisibility(map, dynamicVisibleRef.current);
      setStaticOverlayVisibility(map, staticVisibleRef.current);
      if (!initialReadyRef.current) {
        initialReadyRef.current = true;
        onInitialReady?.();
      }
    };

    map.on('style.load', onStyleLoad);
    if (map.isStyleLoaded && map.isStyleLoaded()) {
      addSourcesAndLayers(map, mapStyleRef.current);
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyCompassTheme(map, mapStyle);
  }, [mapRef, mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const hasZenith = () => zenithBlueRef.current || zenithGoldRef.current;

    const beginClickTransition = () => {
      if (!isMobileViewport()) return;
      mapMovingRef.current = true;
      moveModeRef.current = 'coords-change';
      dynamicVisibleRef.current = false;
      staticVisibleRef.current = false;
      setDynamicOverlayVisibility(map, false);
      setStaticOverlayVisibility(map, false);
    };

    const hideOverlays = () => {
      mapMovingRef.current = true;

      if (!hasZenith()) {
        dynamicVisibleRef.current = false;
        staticVisibleRef.current = false;
        setDynamicOverlayVisibility(map, false);
        setStaticOverlayVisibility(map, false);
        return;
      }

      if (!isMobileViewport()) {
        dynamicVisibleRef.current = false;
        staticVisibleRef.current = false;
        setDynamicOverlayVisibility(map, false);
        setStaticOverlayVisibility(map, false);
        return;
      }

      if (moveModeRef.current === 'coords-change') {
        dynamicVisibleRef.current = false;
        staticVisibleRef.current = false;
        setDynamicOverlayVisibility(map, false);
        setStaticOverlayVisibility(map, false);
        return;
      }

      if (moveModeRef.current === 'radius-change') {
        dynamicVisibleRef.current = false;
        staticVisibleRef.current = true;
        setDynamicOverlayVisibility(map, false);
        setStaticOverlayVisibility(map, true);
        return;
      }

      // camera-only movement on mobile: keep dynamic/static visible when Zenith is active.
      dynamicVisibleRef.current = true;
      staticVisibleRef.current = true;
      setDynamicOverlayVisibility(map, true);
      setStaticOverlayVisibility(map, true);
    };

    const showOverlays = () => {
      mapMovingRef.current = false;
      if (pendingOverlayDataRef.current) {
        pushOverlayData(map, overlayDataRef.current);
        pendingOverlayDataRef.current = false;
      }

      if (!hasZenith()) {
        dynamicVisibleRef.current = false;
        staticVisibleRef.current = false;
        setDynamicOverlayVisibility(map, false);
        setStaticOverlayVisibility(map, false);
        moveModeRef.current = 'camera-only';
        return;
      }

      dynamicVisibleRef.current = true;
      staticVisibleRef.current = true;
      setDynamicOverlayVisibility(map, true);
      setStaticOverlayVisibility(map, true);
      moveModeRef.current = 'camera-only';
    };

    map.on('click', beginClickTransition);
    map.on('movestart', hideOverlays);
    map.on('moveend', showOverlays);

    return () => {
      map.off('click', beginClickTransition);
      map.off('movestart', hideOverlays);
      map.off('moveend', showOverlays);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef.current]);

  // Push fresh overlay data whenever the data changes and the map exists.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const prev = previousDataRef.current;
    const coordsChanged =
      prev?.coords?.lat !== overlayData?.coords?.lat ||
      prev?.coords?.lng !== overlayData?.coords?.lng;
    const radiusChanged = prev?.overlayRadius !== overlayData?.overlayRadius;

    if (coordsChanged) moveModeRef.current = 'coords-change';
    else if (radiusChanged) moveModeRef.current = 'radius-change';
    else if (!mapMovingRef.current) moveModeRef.current = 'camera-only';

    previousDataRef.current = { coords: overlayData?.coords, overlayRadius: overlayData?.overlayRadius };

    if (mapMovingRef.current || map.isMoving?.()) {
      // For click-to-new-point transitions, defer redraw until moveend.
      // For slider/camera-only moves, keep static overlays visible with live updates.
      if (moveModeRef.current === 'coords-change') {
        pendingOverlayDataRef.current = true;
        return;
      }
    }

    if (!zenithBlueRef.current && !zenithGoldRef.current) {
      dynamicVisibleRef.current = false;
      staticVisibleRef.current = false;
      setDynamicOverlayVisibility(map, false);
      setStaticOverlayVisibility(map, false);
      pendingOverlayDataRef.current = false;
      return;
    }

    pushOverlayData(map, overlayData);
    setDynamicOverlayVisibility(map, dynamicVisibleRef.current);
    setStaticOverlayVisibility(map, staticVisibleRef.current);
    if (!initialReadyRef.current) {
      initialReadyRef.current = true;
      onInitialReady?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayData, mapRef.current]);
}
