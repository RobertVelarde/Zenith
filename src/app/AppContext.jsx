import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import MapView from '../features/map/MapView';
import SidePanel from '../features/panel/SidePanel';
import NotificationToast from '../shared/components/NotificationToast';
import LoadingScreen from '../shared/components/LoadingScreen';
import { ThemeProvider } from '../shared/hooks/useTheme';
import { TimeFormatProvider } from '../shared/hooks/useTimeFormat';
import { usePersistentState } from '../shared/hooks/usePersistentState';
import { useDebounce } from '../shared/hooks/useDebounce';
import { useLocationMeta } from '../shared/hooks/useLocationMeta';
import { useGeolocation } from '../shared/hooks/useGeolocation';
import { useSolarData } from '../shared/hooks/useSolarData';
import { useCompassHeading } from '../shared/hooks/useCompassHeading';
import getMapPadding from '../shared/utils/getMapPadding';
import { DEFAULT_COORDS, DEFAULT_ZOOM, TRANSITIONS, OVERLAY_RADIUS, LAYOUT, API } from '../config';

const AppStateContext = createContext(null);
const AppDispatchContext = createContext(null);

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within <AppProvider>');
  return ctx;
}

export function useAppDispatch() {
  const ctx = useContext(AppDispatchContext);
  if (!ctx) throw new Error('useAppDispatch must be used within <AppProvider>');
  return ctx;
}

function currentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function AppProvider({ children }) {
  const now = new Date();
  const { savedState, persist } = usePersistentState(800);

  const [coords, setCoords] = useState(savedState?.coords ?? DEFAULT_COORDS);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const [timeMinutes, setTimeMinutes] = useState(currentMinutes());
  const [mapStyle, setMapStyle] = useState(savedState?.mapStyle ?? 'dark');
  const [panelOpen, setPanelOpen] = useState(true);
  const [overlayZoom, setOverlayZoom] = useState(savedState?.overlayZoom ?? DEFAULT_ZOOM);
  const [use24h, setUse24h] = useState(savedState?.use24h ?? false);

  const overlayRadius = OVERLAY_RADIUS * Math.pow(2, DEFAULT_ZOOM - overlayZoom);
  const mapRef = useRef(null);
  const debouncedCoords = useDebounce(coords, API.coordDebounce);
  const { timezone, elevation } = useLocationMeta(debouncedCoords.lat, debouncedCoords.lng);
  const { geolocate } = useGeolocation(setCoords);

  const [zenithGold, setZenithGold] = useState(savedState?.wasGeolocated ?? false);
  const [zenithBlue, setZenithBlue] = useState(!!(savedState && !savedState.wasGeolocated));
  const isGeolocatedRef = useRef(savedState?.wasGeolocated ?? false);

  const { sunData, moonData, sunTrajectory, moonTrajectory } = useSolarData(
    coords, year, month, day, timeMinutes, timezone,
  );

  const { heading, requestPermission } = useCompassHeading();

  // Loading / readiness state for the initial splash screen.
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [mapIdle, setMapIdle] = useState(false);
  const [overlaysReady, setOverlaysReady] = useState(false);
  const [solarLoaded, setSolarLoaded] = useState(false);

  useEffect(() => {
    // usePersistentState returns `savedState` synchronously; mark as loaded
    // on first paint so the splash can reflect it.
    setSavedLoaded(true);
  }, []);

  useEffect(() => {
    persist({ coords, overlayZoom, mapStyle, use24h, wasGeolocated: isGeolocatedRef.current });
  }, [coords, overlayZoom, mapStyle, use24h, persist]);

  // Consider solar/moon data "loaded" when a timezone has been found or a
  // short timeout elapsed (so the splash doesn't hang indefinitely).
  useEffect(() => {
    if (timezone !== null) {
      setSolarLoaded(true);
      return;
    }
    const t = setTimeout(() => setSolarLoaded(true), 3000);
    return () => clearTimeout(t);
  }, [timezone, sunData, moonData]);

  const handleMapClick = useCallback((c) => {
    setCoords(c);
    isGeolocatedRef.current = false;
    setZenithGold(false);
    setZenithBlue(true);
    mapRef.current?.flyTo({ center: [c.lng, c.lat], duration: TRANSITIONS.clickFlyTo });
  }, []);

  const handleUserInteraction = useCallback(() => {
    setZenithBlue(false);
    setZenithGold(false);
  }, []);

  const handleCenterMap = useCallback((overrideCoords) => {
    if (isGeolocatedRef.current) setZenithGold(true);
    else setZenithBlue(true);
    const map = mapRef.current;
    const c = overrideCoords ?? coords;
    if (!map || !c) return;
    const r = overlayRadius * 1.35;
    const latCos = Math.cos((c.lat * Math.PI) / 180);
    const sw = [c.lng - r / latCos, c.lat - r];
    const ne = [c.lng + r / latCos, c.lat + r];
    const isMobile = window.innerWidth < LAYOUT.mobileBreakpoint;
    const panelVisibleH = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--panel-visible-h') || '0',
      10,
    );
    const padding = getMapPadding({ isMobile, panelVisibleH, panelWidth: LAYOUT.panelWidth });
    map.fitBounds([sw, ne], { padding, duration: TRANSITIONS.flyToDuration });
  }, [coords, overlayRadius]);

  const handleZenithHold = useCallback(() => {
    isGeolocatedRef.current = true;
    setZenithGold(true);
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
  }, [handleCenterMap]);

  const handleZenithTap = useCallback(() => { handleCenterMap(); }, [handleCenterMap]);

  const handleMapUnavailable = useCallback(() => {
    setMapIdle(true);
    setOverlaysReady(true);
  }, []);

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
    const isMobile = window.innerWidth < LAYOUT.mobileBreakpoint;
    const panelVisibleH = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--panel-visible-h') || '0',
      10,
    );
    const padding = getMapPadding({ isMobile, panelVisibleH, panelWidth: LAYOUT.panelWidth });
    map.fitBounds([sw, ne], { padding, duration: TRANSITIONS.flyToDuration });
  }, [coords]);

  const handleDateChange = useCallback((y, m, d) => {
    setYear(y);
    setMonth(m);
    setDay(d);
  }, []);

  const state = {
    coords, year, month, day, timeMinutes, mapStyle, panelOpen, overlayZoom, use24h,
    overlayRadius, mapRef, timezone, elevation, sunData, moonData, sunTrajectory, moonTrajectory,
    heading, zenithGold, zenithBlue,
  };

  const dispatch = {
    setCoords, setYear, setMonth, setDay, setTimeMinutes, setMapStyle, setPanelOpen,
    setOverlayZoom, setUse24h, setZenithGold, setZenithBlue,
    handleMapClick, handleUserInteraction, handleCenterMap, handleZenithHold,
    handleCoordsChange, handleZenithTap, handleOverlayZoomChange, handleDateChange,
  };

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        <ThemeProvider mapStyle={mapStyle} onStyleChange={setMapStyle}>
          <TimeFormatProvider timezone={timezone} use24h={use24h} setUse24h={setUse24h}>
            <div className="app-root relative w-screen overflow-hidden">
              <LoadingScreen
                visible={!(savedLoaded && !!coords && mapIdle && overlaysReady && solarLoaded)}
                statuses={{ savedStateLoaded: savedLoaded, coordsSet: !!coords, mapIdle, overlaysReady, solarLoaded }}
              />
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
                onMapIdle={() => setMapIdle(true)}
                onOverlaysReady={() => setOverlaysReady(true)}
                onMapUnavailable={handleMapUnavailable}
              />

              <SidePanel />

              <NotificationToast />
            </div>
          </TimeFormatProvider>
        </ThemeProvider>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export default AppProvider;
