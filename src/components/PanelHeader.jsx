/**
 * @file PanelHeader.jsx
 *
 * Section 1 of the panel: the always-visible header bar.
 *
 * Contains:
 *  - Grab-handle pill (mobile only) — advances sheet stage on click
 *  - Zenith title button (tap to centre; hold to geolocate)
 *  - Search icon button + inline search input + results dropdown
 *  - Middle area: settings toggles / search input / coordinates display
 *  - Hamburger / settings icon button
 *
 * Mobile inline-search state (query, results, timer) lives here and is
 * never hoisted to SidePanel.
 */

import { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { LABELS, MAPBOX_TOKEN, API, ZENITH } from '../config';
import { useNotification } from '../hooks/notificationContext';

export default forwardRef(function PanelHeader({
  // Stage control (grab handle)
  stage,
  setStage,
  // Theme
  isDark,
  isSatellite,
  setIsDark,
  setIsSatellite,
  isLight,
  glassClass,
  textPrimary,
  // Zenith button
  zenithGold,
  zenithBlue,
  onZenithTap,
  onZenithHold,
  // Coordinates + geocoding
  coords,
  onCoordsChange,
  // Style / format
  onStyleChange,
  use24h,
  onUse24hChange,
  // Gesture handlers (forwarded from useBottomSheet via SidePanel)
  onDragStart,
  onDragEnd,
  // Search-results bottom position (computed by SidePanel from panelH − currentTranslateY)
  resultsBottomPx,
}, ref) {
  const { notify } = useNotification();

  // ── Tap-flash state ────────────────────────────────────────────────────────
  const [titleFlash,  setTitleFlash]  = useState(false);
  const [coordsFlash, setCoordsFlash] = useState(false);
  const flashBtn = (setFlash, timeout) => {
    setFlash(true);
    setTimeout(() => setFlash(false), timeout);
  };
  const cyanFlash = 'bg-cyan-400 text-black shadow-[0_0_12px_2px_rgba(34,211,238,0.45)]';
  const goldStyle = 'bg-amber-400 text-black shadow-[0_0_14px_3px_rgba(251,191,36,0.65)]';

  // ── Zenith button hold-to-geolocate ────────────────────────────────────────
  const holdTimerRef       = useRef(null);
  const longPressTriggered = useRef(false);

  const onZenithPointerDown = useCallback(() => {
    longPressTriggered.current = false;
    holdTimerRef.current = setTimeout(() => {
      longPressTriggered.current = true;
      onZenithHold?.();
    }, ZENITH.holdDelay);
  }, [onZenithHold]);

  const onZenithPointerUp = useCallback(() => {
    clearTimeout(holdTimerRef.current);
  }, []);

  const onZenithClick = useCallback(() => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return; // long-press already handled; skip tap action
    }
    onZenithTap?.();
  }, [onZenithTap]);

  // ── Header bar mode ────────────────────────────────────────────────────────
  const [searchActive,   setSearchActive]   = useState(false);
  const [settingsActive, setSettingsActive] = useState(false);

  // ── Mobile inline-search state ─────────────────────────────────────────────
  const [mobileQuery,       setMobileQuery]       = useState('');
  const [mobileResults,     setMobileResults]     = useState([]);
  const [mobileResultsOpen, setMobileResultsOpen] = useState(false);
  const mobileSearchInput = useRef(null);
  const mobileSearchTimer = useRef(null);

  // Auto-focus when search opens; clear when it closes.
  useEffect(() => {
    if (searchActive) {
      const id = setTimeout(() => mobileSearchInput.current?.focus(), 50);
      return () => clearTimeout(id);
    } else {
      setMobileQuery('');
      setMobileResults([]);
      setMobileResultsOpen(false);
    }
  }, [searchActive]);

  const toggleSearch = () => {
    setSearchActive((v) => !v);
    setSettingsActive(false);
  };
  const toggleSettings = () => {
    setSettingsActive((v) => !v);
    setSearchActive(false);
  };

  // Geocode query and show results above the header bar.
  const mobileSearch = (q) => {
    if (q.length < 2) { setMobileResults([]); setMobileResultsOpen(false); return; }
    clearTimeout(mobileSearchTimer.current);
    mobileSearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API.geocodingUrl}/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=${API.geocodingLimit}`,
        );
        if (res.ok) {
          const data = await res.json();
          setMobileResults(data.features || []);
          setMobileResultsOpen(true);
        } else {
          notify(LABELS.geocodingFailed, 'warn');
        }
      } catch {
        notify(LABELS.geocodingFailed, 'warn');
      }
    }, API.searchDebounce);
  };

  const mobilePick = (feat) => {
    const [lng, lat] = feat.center;
    onCoordsChange({ lat, lng });
    setSearchActive(false);
  };

  // ── Icon button class helper ───────────────────────────────────────────────
  const iconBtn = (active) =>
    `w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-sm transition-all duration-200
    ${active
      ? 'bg-cyan-400 text-black shadow-[0_0_12px_2px_rgba(34,211,238,0.45)] border-black-400/50'
      : `${glassClass} ${textPrimary}`
    }`;

  return (
    <>
      {/* Mobile search results — portalled to document.body so position:fixed
           is relative to the viewport, not the panel's CSS transform ancestor. */}
      {searchActive && mobileResultsOpen && mobileResults.length > 0 && createPortal(
        <ul
          className={`md:hidden fixed left-2 right-2 z-[60]
            ${glassClass} rounded-xl text-sm shadow-xl
            max-h-56 overflow-y-auto`}
          style={{ bottom: resultsBottomPx }}
        >
          {mobileResults.map((f) => (
            <li
              key={f.id}
              onMouseDown={() => mobilePick(f)}
              onTouchEnd={(e) => { e.preventDefault(); mobilePick(f); }}
              className={`px-3 py-2 cursor-pointer truncate
                ${isLight ? 'text-slate-700 active:bg-slate-100' : 'text-gray-200 active:bg-white/10'}`}
            >
              {f.place_name}
            </li>
          ))}
        </ul>,
        document.body,
      )}

      {/* Header bar — drag target for gesture handling */}
      <div
        ref={ref}
        onTouchStart={onDragStart}
        onTouchEnd={onDragEnd}
        className="shrink-0 relative select-none"
      >
        {/* Grab handle pill — mobile only, centered at very top.
             Rendered as a button so assistive technology and tests can
             advance the panel stage without requiring a drag gesture. */}
        <button
          aria-label="Expand menu"
          onClick={() => setStage((s) => Math.min(3, s + 1))}
          className="md:hidden w-full flex justify-center pt-2 pb-0.5 focus:outline-none"
        >
          <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-white/25' : 'bg-slate-400/40'}`} />
        </button>

        <div className="flex items-center gap-1.5 px-2 py-2">

          {/* 1. Zenith title button */}
          <button
            onClick={onZenithClick}
            onPointerDown={onZenithPointerDown}
            onPointerUp={onZenithPointerUp}
            onPointerLeave={onZenithPointerUp}
            onPointerCancel={onZenithPointerUp}
            className={`shrink-0 h-9 px-2.5 text-lg font-semibold tracking-wide flex items-center rounded-xl transition-all duration-200 ${
              zenithGold ? goldStyle : (zenithBlue || titleFlash) ? cyanFlash : textPrimary
            }`}
          >
            {LABELS.appTitle}
          </button>

          {/* Search icon */}
          <button
            onClick={toggleSearch}
            className={iconBtn(searchActive)}
            aria-label="Search location"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          </button>

          {/* 2. Middle area — expands between title and hamburger.
               Inner h-9 clips height; relative wrapper lets the desktop
               dropdown escape that clip boundary. */}
          <div className="relative flex-1 min-w-0">
            <div className="h-9">
              {settingsActive ? (

                /* Settings mode: Dark / Satellite / 24hr toggles */
                <div className="flex h-full gap-1.5">
                  <button
                    onClick={() => {
                      const next = !isDark;
                      setIsDark(next);
                      if (!isSatellite) onStyleChange(next ? 'dark' : 'light');
                    }}
                    className={`flex-1 h-full flex items-center justify-center rounded-xl
                      text-xs font-medium transition-all duration-200 border
                      ${isDark
                        ? 'bg-green-500/25 border-green-500 text-green-200'
                        : 'bg-red-500/20 border-red-500 text-red-800'}
                    `}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => {
                      const next = !isSatellite;
                      setIsSatellite(next);
                      onStyleChange(next ? 'satellite' : isDark ? 'dark' : 'light');
                    }}
                    className={`flex-1 h-full flex items-center justify-center rounded-xl
                      text-xs font-medium transition-all duration-200 border
                      ${isSatellite
                        ? 'bg-green-500/25 border-green-500'
                        : 'bg-red-500/20 border-red-400'}
                      ${isSatellite
                        ? isDark ? 'text-green-200' : 'text-green-800'
                        : isDark ? 'text-red-200' : 'text-red-800'}
                    `}
                  >
                    Sat.
                  </button>
                  <button
                    onClick={() => {
                      const next = !use24h;
                      onUse24hChange(next);
                      onStyleChange(isSatellite ? 'satellite' : isDark ? 'dark' : 'light');
                    }}
                    className={`flex-1 h-full flex items-center justify-center rounded-xl
                      text-xs font-medium transition-all duration-200 border
                      ${use24h
                        ? 'bg-green-500/25 border-green-500'
                        : 'bg-red-500/20 border-red-400'}
                      ${use24h
                        ? isDark ? 'text-green-200' : 'text-green-800'
                        : isDark ? 'text-red-200' : 'text-red-800'}
                    `}
                  >
                    24hr
                  </button>
                </div>

              ) : searchActive ? (

                /* Search mode — 16 px font prevents iOS auto-zoom */
                <div className={`flex h-full items-center gap-1.5 ${glassClass} rounded-xl px-2.5`}>
                  <input
                    autoFocus
                    ref={mobileSearchInput}
                    type="text"
                    value={mobileQuery}
                    onChange={(e) => { setMobileQuery(e.target.value); mobileSearch(e.target.value); }}
                    onBlur={() => { setTimeout(() => setSearchActive(false), 150); }}
                    placeholder={LABELS.searchPlaceholder}
                    className={`bg-transparent text-base outline-none w-full h-full
                      ${isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-gray-500'}`}
                  />
                  {mobileQuery && (
                    <button
                      onMouseDown={(e) => { e.preventDefault(); setMobileQuery(''); setMobileResults([]); }}
                      className={`text-xs shrink-0 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}
                    >
                      ✕
                    </button>
                  )}
                </div>

              ) : (
                /* Normal mode: coordinates (tap to copy) */
                <div className="flex h-full items-center gap-1.5">
                  <button
                    onClick={() => {
                      if (!coords) return;
                      flashBtn(setCoordsFlash, 1000);
                      const text = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
                      navigator.clipboard.writeText(text).then(
                        () => notify('Coordinates copied!'),
                        () => notify('Copy failed', 'warn'),
                      );
                    }}
                    style={coordsFlash ? { background: '#22d3ee', color: '#000', boxShadow: '0 0 12px 2px rgba(34,211,238,0.45)' } : undefined}
                    className={`flex-1 h-full px-2.5 rounded-xl ${glassClass} text-xs font-mono text-left truncate flex items-center transition-all duration-200 ${textPrimary}`}
                  >
                    {coordsFlash
                      ? 'Coordinates copied!'
                      : coords
                        ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
                        : <span className={isLight ? 'text-slate-400' : 'text-gray-500'}>No location</span>
                    }
                  </button>
                </div>
              )}
            </div>

            {/* Desktop inline dropdown */}
            {searchActive && mobileResultsOpen && mobileResults.length > 0 && (
              <ul
                className={`hidden md:block absolute top-full left-0 right-0 mt-1 z-50
                  ${glassClass} rounded-xl text-sm shadow-xl max-h-56 overflow-y-auto`}
              >
                {mobileResults.map((f) => (
                  <li
                    key={f.id}
                    onMouseDown={() => mobilePick(f)}
                    className={`px-3 py-2 cursor-pointer truncate
                      ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-gray-200 hover:bg-white/10'}`}
                  >
                    {f.place_name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 3. Hamburger / settings — far right */}
          <button
            onClick={toggleSettings}
            className={iconBtn(settingsActive)}
            aria-label="Map settings"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

        </div>
      </div>
    </>
  );
});
