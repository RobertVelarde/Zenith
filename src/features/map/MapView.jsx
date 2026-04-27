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
import { useNotification } from '../../shared/hooks/useNotification';
import useMapOverlays from './useMapOverlays';
import darkMarkerImageUrl from '../../assets/markers/darkMarker.png';
import lightMarkerImageUrl from '../../assets/markers/lightMarker.png';

mapboxgl.accessToken = MAPBOX_TOKEN;

function getMarkerImageUrl(mapStyle) {
  return mapStyle === 'light' ? lightMarkerImageUrl : darkMarkerImageUrl;
}

export default function MapView({
  coords,
  mapStyle,
  sunTrajectory,
  moonTrajectory,
  sunData,
  moonData,
  overlayRadius,
  heading,
  zenithBlue,
  zenithGold,
  onMapClick,
  mapRef,
  onUserInteraction,
  onMapIdle, // callback when the map first becomes idle
  onOverlaysReady, // callback when overlays have been initially pushed
  onMapUnavailable, // callback when the map cannot finish initial readiness
}) {
  const containerRef = useRef(null);
  const markerRef = useRef(null);
  const initialMapResolvedRef = useRef(false);
  const { notify } = useNotification();

  useMapOverlays(
    mapRef,
    { coords, sunTrajectory, moonTrajectory, sunData, moonData, overlayRadius, heading },
    { onInitialReady: onOverlaysReady, zenithBlue, zenithGold, mapStyle },
  );

  const onUserInteractionRef = useRef(onUserInteraction);
  useEffect(() => { onUserInteractionRef.current = onUserInteraction; }, [onUserInteraction]);

  const appliedStyleRef = useRef(MAP_STYLES[mapStyle] || MAP_STYLES.dark);

  useEffect(() => {
    let map;
    let initialLoadTimeout;

    const clearInitialLoadTimeout = () => {
      if (initialLoadTimeout) {
        window.clearTimeout(initialLoadTimeout);
        initialLoadTimeout = undefined;
      }
    };

    const markMapUnavailable = () => {
      if (initialMapResolvedRef.current) return;
      initialMapResolvedRef.current = true;
      clearInitialLoadTimeout();
      onMapUnavailable?.();
    };

    const markMapIdle = () => {
      if (initialMapResolvedRef.current) return;
      initialMapResolvedRef.current = true;
      clearInitialLoadTimeout();
      onMapIdle?.();
    };

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
      markMapUnavailable();
      return;
    }

    initialLoadTimeout = window.setTimeout(() => {
      notify(LABELS.mapLoadFailed, 'error');
      markMapUnavailable();
    }, 12000);

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    mapRef.current = map;

    map.on('style.load', () => {
      // Hook handles sources/layers and initial data push
    });

    // Fire once when the map finishes its initial load/idle cycle.
    map.once('idle', markMapIdle);

    map.on('click', (e) => {
      onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    const emitInteraction = (ev) => {
      // Ignore programmatic move events (e.g., flyTo) that have no original DOM event
      // or if a click (already handled separately). We only want to trigger onUserInteraction for user-initiated map movements.
      if (!ev || !ev.originalEvent || ev.originalEvent.type === 'click') return;
      onUserInteractionRef.current?.();
    };
    //map.on('movestart', emitInteraction);
    map.on('dragstart', emitInteraction);
    const container = containerRef.current;
    const wheelHandler = () => { onUserInteractionRef.current?.(); };
    if (container) container.addEventListener('wheel', wheelHandler, { passive: true });

    map.on('error', (e) => {
      if (e?.error?.status !== 404) {
        console.error('[MapView]', e.error?.message || e);
        markMapUnavailable();
      }
    });

    const imageMarker = document.createElement('div');
    imageMarker.className = 'custom-image-marker';
    imageMarker.style.width = '20px';
    imageMarker.style.height = '20px';
    imageMarker.style.backgroundImage = `url(${getMarkerImageUrl(mapStyle)})`;
    imageMarker.style.backgroundSize = 'contain';
    imageMarker.style.backgroundRepeat = 'no-repeat';

    markerRef.current = new mapboxgl.Marker({
        element: imageMarker,
        anchor: 'center'
      })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);

    return () => {
      clearInitialLoadTimeout();
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

  useEffect(() => {
    const markerElement = markerRef.current?.getElement();
    if (!markerElement) return;
    markerElement.style.backgroundImage = `url(${getMarkerImageUrl(mapStyle)})`;
  }, [mapStyle]);

  return (
    <div ref={containerRef} className="fixed inset-0 w-full h-full" />
  );
}
