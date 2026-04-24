/**
 * @file Application root.
 *
 * Orchestrates top-level state (coordinates, date/time, map style) and
 * delegates all heavy computation to custom hooks.  Provides the
 * notification context used throughout the app for user-facing messages.
 *
 * @module App
 */

import { useState, useRef, useCallback } from 'react';
import MapView from './components/MapView';
import SidePanel from './components/SidePanel';
import NotificationToast from './components/NotificationToast';
import { NotificationProvider } from './hooks/useNotification';
import { DEFAULT_COORDS, DEFAULT_ZOOM, TRANSITIONS, OVERLAY_RADIUS, ZENITH } from './config';
import { useSolarData } from './hooks/useSolarData';
import { useLocationMeta } from './hooks/useLocationMeta';
import { useGeolocation } from './hooks/useGeolocation';
import { useDebounce } from './hooks/useDebounce';
import { useCompassHeading } from './hooks/useCompassHeading';
import { API } from './config';

/**
 * Return the current time as minutes since midnight.
 *
 * @returns {number} 0-1439
 */
function currentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function AppContent() {
  const now = new Date();
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const [timeMinutes, setTimeMinutes] = useState(currentMinutes());
  const [mapStyle, setMapStyle] = useState('dark');
  const [panelOpen, setPanelOpen] = useState(true);
  const [overlayZoom, setOverlayZoom] = useState(DEFAULT_ZOOM);

  // Overlay radius scales with the chosen zoom level so arcs/lines always
  // fit the visible map area regardless of how far the user has zoomed in.
  const overlayRadius = OVERLAY_RADIUS * Math.pow(2, DEFAULT_ZOOM - overlayZoom);

  const mapRef = useRef(null);

  /* ---- Debounce rapid slider changes to avoid API spam ---- */
  const debouncedCoords = useDebounce(coords, API.coordDebounce);

  /* ---- Custom hooks ---- */
  const { timezone, elevation } = useLocationMeta(debouncedCoords.lat, debouncedCoords.lng);
  const { geolocate } = useGeolocation(setCoords);

  // Track whether the Zenith button is in its "gold" / my-location state.
  const [zenithGold, setZenithGold] = useState(false);
  // Track whether the Zenith button was tapped to center the map; stays
  // blue until the user touches the map again.
  const [zenithBlue, setZenithBlue] = useState(false);
  // Tracks whether the current coords came from geolocation. When true,
  // re-centering restores gold (not blue) because the location is still
  // the user's physical position.
  const isGeolocatedRef = useRef(false);

  const { sunData, moonData, sunTrajectory, moonTrajectory } = useSolarData(
    coords, year, month, day, timeMinutes, timezone,
  );

  const { heading } = useCompassHeading();

  /* ---- Handlers ---- */
  // Called when the user manually picks a location — keep the title button
  // blue because the view recenters on the selected point.
  const handleMapClick = useCallback((c) => {
    setCoords(c);
    isGeolocatedRef.current = false;
    setZenithGold(false);
    setZenithBlue(true);
    mapRef.current?.flyTo({ center: [c.lng, c.lat], duration: TRANSITIONS.clickFlyTo });
  }, [setCoords, mapRef]);

  // Clear blue/gold when the user interacts with the map (pan/zoom/touch).
  const handleUserInteraction = useCallback(() => {
    setZenithBlue(false);
    setZenithGold(false);
  }, [setZenithBlue, setZenithGold]);


  const handleCenterMap = useCallback((overrideCoords) => {
    if (isGeolocatedRef.current) setZenithGold(true);
    else setZenithBlue(true);
    const map = mapRef.current;
    const c = overrideCoords ?? coords;
    if (!map || !c) return;
    // Bounding box that contains all arcs/lines drawn at overlayRadius from coords.
    const r = overlayRadius * 1.35; // 35 % margin so edges aren't clipped
    const latCos = Math.cos((c.lat * Math.PI) / 180);
    const sw = [c.lng - r / latCos, c.lat - r];
    const ne = [c.lng + r / latCos, c.lat + r];
    const isMobile = window.innerWidth < 768;
    // Read the full visible panel height (bar-only when peeked, full when open).
    const panelVisibleH = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--panel-visible-h') || '0',
      10,
    );
    map.fitBounds([sw, ne], {
      padding: isMobile
        ? { top: 24, right: 24, bottom: panelVisibleH + 24, left: 24 }
        : { top: 24, right: 24, bottom: 24, left: 340 + 24 },
      duration: TRANSITIONS.flyToDuration,
    });
  }, [coords, mapRef, overlayRadius]);

    // Called after the user holds the Zenith button for ZENITH.holdDelay ms.
  // Optimistically turns the button gold, then requests geolocation; reverts
  // the gold state if the permission is denied.
  const handleZenithHold = useCallback(() => {
    isGeolocatedRef.current = true;
    setZenithGold(true);
    geolocate({
      onSuccess: (c) => handleCenterMap(c),
      onError: () => { isGeolocatedRef.current = false; setZenithGold(false); },
    });
  }, [geolocate, handleCenterMap]);

  const handleCoordsChange = useCallback((c) => {
    setCoords(c);
    isGeolocatedRef.current = false;
    setZenithGold(false);
    handleCenterMap(c);
  }, [setCoords, handleCenterMap]);

  // Called when the Zenith title/button is tapped to center the map.
  const handleZenithTap = useCallback(() => {
    handleCenterMap();
  }, [handleCenterMap]);

  const handleOverlayZoomChange = useCallback((newZoom) => {
    if (isGeolocatedRef.current) setZenithGold(true);
    else setZenithBlue(true);
    setOverlayZoom(newZoom);
    const map = mapRef.current;
    if (!map || !coords) return;
    const newRadius = OVERLAY_RADIUS * Math.pow(2, DEFAULT_ZOOM - newZoom);
    const r = newRadius * 1.35;
    const latCos = Math.cos((coords.lat * Math.PI) / 180);
    const sw = [coords.lng - r / latCos, coords.lat - r];
    const ne = [coords.lng + r / latCos, coords.lat + r];
    const isMobile = window.innerWidth < 768;
    const panelVisibleH = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--panel-visible-h') || '0',
      10,
    );
    map.fitBounds([sw, ne], {
      padding: isMobile
        ? { top: 24, right: 24, bottom: panelVisibleH + 24, left: 24 }
        : { top: 24, right: 24, bottom: 24, left: 340 + 24 },
      duration: TRANSITIONS.flyToDuration,
    });
  }, [coords, mapRef]);

  const handleDateChange = useCallback((y, m, d) => {
    setYear(y);
    setMonth(m);
    setDay(d);
  }, [setYear, setMonth, setDay]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <MapView
        coords={coords}
        mapStyle={mapStyle}
        sunTrajectory={sunTrajectory}
        moonTrajectory={moonTrajectory}
        sunData={sunData}
        moonData={moonData}
        overlayRadius={overlayRadius}
        heading={heading}
        onMapClick={handleMapClick}
        mapRef={mapRef}
        onUserInteraction={handleUserInteraction}
      />

      <SidePanel
        coords={coords}
        year={year}
        month={month}
        day={day}
        timeMinutes={timeMinutes}
        timezone={timezone}
        elevation={elevation}
        sunData={sunData}
        moonData={moonData}
        mapStyle={mapStyle}
        isOpen={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
        onCoordsChange={handleCoordsChange}
        onDateChange={handleDateChange}
        onTimeChange={setTimeMinutes}
        onStyleChange={setMapStyle}
        onCenterMap={handleCenterMap}
        overlayZoom={overlayZoom}
        onOverlayZoomChange={handleOverlayZoomChange}
        onZenithHold={handleZenithHold}
        zenithGold={zenithGold}
        onZenithTap={handleZenithTap}
        zenithBlue={zenithBlue}
      />

      <NotificationToast />
    </div>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}
