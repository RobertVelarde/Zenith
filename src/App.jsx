/**
 * @file Application root.
 *
 * Orchestrates top-level state (coordinates, date/time, map style) and
 * delegates all heavy computation to custom hooks.  Provides the
 * notification context used throughout the app for user-facing messages.
 *
 * @module App
 */

import { useState, useRef, useCallback, useEffect } from 'react';
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
import { usePersistentState } from './hooks/usePersistentState';
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

  // ── Persistent state hydration ──────────────────────────────────────────
  // savedState is read synchronously from localStorage before the first
  // render so initial useState() calls below can use it directly.
  const { savedState, persist } = usePersistentState(800);

  const [coords, setCoords]         = useState(savedState?.coords      ?? DEFAULT_COORDS);
  const [year,   setYear]           = useState(now.getFullYear());
  const [month,  setMonth]          = useState(now.getMonth() + 1);
  const [day,    setDay]            = useState(now.getDate());
  const [timeMinutes, setTimeMinutes] = useState(currentMinutes());
  const [mapStyle,    setMapStyle]  = useState(savedState?.mapStyle     ?? 'dark');
  const [panelOpen,   setPanelOpen] = useState(true);
  const [overlayZoom, setOverlayZoom] = useState(savedState?.overlayZoom ?? DEFAULT_ZOOM);
  const [use24h,      setUse24h]    = useState(savedState?.use24h       ?? false);

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
  // Restore gold if the last session ended with a geolocated position, or
  // blue if there are stored coords that weren't from GPS.
  const [zenithGold, setZenithGold] = useState(savedState?.wasGeolocated ?? false);
  const [zenithBlue, setZenithBlue] = useState(
    !!(savedState && !savedState.wasGeolocated),
  );
  // Tracks whether the current coords came from geolocation.
  const isGeolocatedRef = useRef(savedState?.wasGeolocated ?? false);

  const { sunData, moonData, sunTrajectory, moonTrajectory } = useSolarData(
    coords, year, month, day, timeMinutes, timezone,
  );

  const { heading, requestPermission } = useCompassHeading();

  // ── Persist state whenever key values change ────────────────────────────
  useEffect(() => {
    persist({
      coords,
      overlayZoom,
      mapStyle,
      use24h,
      wasGeolocated: isGeolocatedRef.current,
    });
  }, [coords, overlayZoom, mapStyle, use24h, persist]);

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


  // Centers the map on the given coordinates (or current coords if not provided).
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
        : { top: 24, right: 24, bottom: 24, left: 360 + 24 },
      duration: TRANSITIONS.flyToDuration,
    });

  }, [coords, mapRef, overlayRadius]);

  // Called after the user holds the Zenith button for ZENITH.holdDelay ms.
  // Optimistically turns the button gold, then requests geolocation; reverts
  // the gold state if the permission is denied.
  // Also requests device compass permission on iOS 13+ at this point since
  // it requires a user gesture and Zenith Gold is the natural trigger.
  const handleZenithHold = useCallback(() => {
    isGeolocatedRef.current = true;
    setZenithGold(true);
    // Request compass (iOS requires a user-gesture; safe to call elsewhere too)
    requestPermission();
    geolocate({
      onSuccess: (c) => handleCenterMap(c),
      onError: () => { isGeolocatedRef.current = false; setZenithGold(false); },
    });
  }, [geolocate, handleCenterMap, requestPermission]);

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

  // Called when the overlay zoom slider changes. Similar to handleCenterMap but also updates the zoom level and doesn't change the center coords.
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
        : { top: 24, right: 24, bottom: 24, left: 360 + 24 },
      duration: TRANSITIONS.flyToDuration,
    });
  }, [coords, mapRef]);

  const handleDateChange = useCallback((y, m, d) => {
    setYear(y);
    setMonth(m);
    setDay(d);
  }, [setYear, setMonth, setDay]);

  return (
    <div className="app-root relative w-screen overflow-hidden">
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
        use24h={use24h}
        onUse24hChange={setUse24h}
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
