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
import { DEFAULT_COORDS, TRANSITIONS } from './config';
import { useSolarData } from './hooks/useSolarData';
import { useLocationMeta } from './hooks/useLocationMeta';
import { useGeolocation } from './hooks/useGeolocation';
import { useDebounce } from './hooks/useDebounce';
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

  const mapRef = useRef(null);

  /* ---- Debounce rapid slider changes to avoid API spam ---- */
  const debouncedCoords = useDebounce(coords, API.coordDebounce);

  /* ---- Custom hooks ---- */
  const { timezone, elevation } = useLocationMeta(debouncedCoords.lat, debouncedCoords.lng);
  useGeolocation(setCoords, mapRef);

  const { sunData, moonData, sunTrajectory, moonTrajectory } = useSolarData(
    coords, year, month, day, timeMinutes, timezone,
  );

  /* ---- Handlers ---- */
  const handleMapClick = useCallback((c) => {
    setCoords(c);
    mapRef.current?.flyTo({ center: [c.lng, c.lat], duration: TRANSITIONS.clickFlyTo });
  }, [setCoords, mapRef]);

  const handleCoordsChange = useCallback((c) => {
    setCoords(c);
    mapRef.current?.flyTo({ center: [c.lng, c.lat], zoom: 13, duration: TRANSITIONS.flyToDuration });
  }, [setCoords, mapRef]);

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
        onMapClick={handleMapClick}
        mapRef={mapRef}
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
