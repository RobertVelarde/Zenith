/**
 * @file Mapbox GL map component with celestial overlays (moved to features/map).
 */
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import {
  MAPBOX_TOKEN,
  DEFAULT_ZOOM,
  MAP_STYLES,
  MARKER_COLOR,
  LABELS,
  OVERLAY_RADIUS,
} from '../../config';
import { useNotification } from '../../hooks/notificationContext';
import useMapOverlays from './useMapOverlays';

mapboxgl.accessToken = MAPBOX_TOKEN;

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

  useMapOverlays(mapRef, { coords, sunTrajectory, moonTrajectory, sunData, moonData, overlayRadius, heading });

  const onUserInteractionRef = useRef(onUserInteraction);
  useEffect(() => { onUserInteractionRef.current = onUserInteraction; }, [onUserInteraction]);

  const appliedStyleRef = useRef(MAP_STYLES[mapStyle] || MAP_STYLES.dark);

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
        projection: 'mercator',
        pitchWithRotate: false,
        dragRotate: false,
        touchZoomRotate: true,
        maxPitch: 0,
        minPitch: 0,
      });
    } catch {
      notify(LABELS.mapLoadFailed, 'error');
      return;
    }

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    mapRef.current = map;

    map.on('style.load', () => {
      // Hook handles sources/layers and initial data push
    });

    map.on('click', (e) => {
      onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    const emitInteraction = (ev) => {
      if (!ev || !ev.originalEvent) return;
      onUserInteractionRef.current?.();
    };
    map.on('movestart', emitInteraction);
    map.on('dragstart', emitInteraction);
    const container = containerRef.current;
    const wheelHandler = () => { onUserInteractionRef.current?.(); };
    if (container) container.addEventListener('wheel', wheelHandler, { passive: true });

    map.on('error', (e) => {
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
  }, [mapRef]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLngLat([coords.lng, coords.lat]);
    }
  }, [coords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const newStyle = MAP_STYLES[mapStyle] || MAP_STYLES.dark;
    if (appliedStyleRef.current === newStyle) return;
    appliedStyleRef.current = newStyle;
    map.setStyle(newStyle);
  }, [mapStyle]);

  return (
    <div ref={containerRef} className="fixed inset-0 w-full h-full" />
  );
}
