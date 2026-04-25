/**
 * @file Collapsible side panel containing all controls and data displays.
 *
 * On desktop it renders as a left-docked panel; on mobile it becomes a
 * 4-stage draggable bottom sheet.
 *
 * Mobile sheet stages:
 *   0 – Closed : Only the header bar is visible at the bottom.
 *   1 – Peeked : Header + Pinned summary (sun/moon brief + overlay slider).
 *   2 – Open   : Header + scrollable body. Remaining map ≥ 1:1 aspect ratio.
 *   3 – Full   : Panel covers the entire screen.
 *
 * Panel is always 100dvh on mobile; translateY controls which portion is
 * visible:
 *   stage 0 → vh − headerH
 *   stage 1 → vh − headerH − pinnedH
 *   stage 2 → vw   (visible = vh − vw = square map above)
 *   stage 3 → 0    (full screen)
 *
 * Exposed CSS custom properties (mobile only; 0 on desktop):
 *   --panel-bar-h     : bar height = headerH + pinnedH  (toast positioning)
 *   --panel-visible-h : visible slice per stage         (map fitBounds padding)
 *
 * @module components/SidePanel
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useBottomSheet } from '../hooks/useBottomSheet';
import DateTimeControls from './DateTimeControls';
import SolarInfo from './SolarInfo';
import LunarInfo from './LunarInfo';
import AdvancedPanel from './AdvancedPanel';
import MoonPhaseIcon from './MoonPhaseIcon';
import { LABELS, MAPBOX_TOKEN, API, DEFAULT_ZOOM, ZENITH, OVERLAY_ZOOM } from '../config';
import { useNotification } from '../hooks/notificationContext';
import { formatTime } from '../utils/timezone';
import { getMoonPhaseName } from '../utils/sunMoonCalc';

export default function SidePanel({
  coords,
  year, month, day, timeMinutes,
  timezone,
  elevation,
  sunData,
  moonData,
  mapStyle,
  isOpen,
  onToggle,
  onCoordsChange,
  onDateChange,
  onTimeChange,
  onStyleChange,
  onCenterMap,
  overlayZoom,
  onOverlayZoomChange,
  onZenithHold,
  zenithGold,
  onZenithTap,
  zenithBlue,
  use24h,
  onUse24hChange,
}) {
  const { notify } = useNotification();

  // ── Dark mode + satellite state ────────────────────────────────────────────
  // isDark controls menu appearance independently of the map tile style.
  // isSatellite controls whether the map shows satellite imagery.
  // Initialised from the mapStyle prop; kept in sync via useEffect so desktop
  // LayerToggle changes are reflected here too.
  const [isDark, setIsDark]           = useState(mapStyle !== 'light');
  const [isSatellite, setIsSatellite] = useState(mapStyle === 'satellite');

  useEffect(() => {
    if (mapStyle === 'satellite') {
      setIsSatellite(true);
    } else {
      setIsSatellite(false);
      setIsDark(mapStyle !== 'light');
    }
  }, [mapStyle]);

  const isLight = !isDark;
  const glassClass = isLight ? 'glass-light' : 'glass';
  const textPrimary = isLight ? 'text-slate-900' : 'text-white';
  const borderColor = isLight ? 'border-slate-200' : 'border-white/5';

  // ── Tap-flash state for instant-action buttons ─────────────────────────────
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
      return; // long-press already handled; skip centering
    }
    onZenithTap?.();
  }, [onZenithTap]);

  // ── Mobile header bar states ───────────────────────────────────────────────
  const [searchActive, setSearchActive]     = useState(false);
  const [settingsActive, setSettingsActive] = useState(false);

  // Mobile inline-search state (separate from the desktop SearchBar component).
  const [mobileQuery, setMobileQuery]             = useState('');
  const [mobileResults, setMobileResults]         = useState([]);
  const [mobileResultsOpen, setMobileResultsOpen] = useState(false);
  const mobileSearchInput = useRef(null);
  const mobileSearchTimer = useRef(null);

  // Auto-focus the mobile search input when it opens; clear it when it closes.
  useEffect(() => {
    if (searchActive) {
      // Small delay lets the DOM finish the state transition first.
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

  // ── Viewport dimensions — updated on resize / orientation change ───────────
  const [vp, setVp] = useState({ vw: window.innerWidth, vh: window.innerHeight });
  useEffect(() => {
    const update = () => setVp({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  const isMobile = vp.vw < 768;

  // ── Three-section height tracking ──────────────────────────────────────────
  // Section 1: headerRef  — drag handle + title/search/hamburger row
  // Section 2: pinnedRef  — sun/moon summary + overlay slider (stage 1 only)
  // Section 3: scrollBodyRef — scrollable content (stages 2+)
  const headerRef     = useRef(null);
  const pinnedRef     = useRef(null);
  const scrollBodyRef = useRef(null);

  const [headerHeight, setHeaderHeight] = useState(0);
  const [pinnedHeight, setPinnedHeight] = useState(0);
  // Cache last non-zero pinnedHeight so snap positions are correct on the
  // first frame of a stage-1 transition (before ResizeObserver fires).
  const lastPinnedHeightRef = useRef(0);

  // Synchronous initial measurement — fires before paint, preventing jump.
  useLayoutEffect(() => {
    if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    if (pinnedRef.current) {
      const ph = pinnedRef.current.offsetHeight;
      setPinnedHeight(ph);
      if (ph > 0) lastPinnedHeightRef.current = ph;
    }
  }, []);

  useEffect(() => {
    const hEl = headerRef.current;
    const pEl = pinnedRef.current;
    if (!hEl || !pEl) return;
    const ro = new ResizeObserver(() => {
      setHeaderHeight(hEl.offsetHeight);
      const ph = pEl.offsetHeight;
      setPinnedHeight(ph);
      if (ph > 0) lastPinnedHeightRef.current = ph;
    });
    ro.observe(hEl);
    ro.observe(pEl);
    return () => ro.disconnect();
  }, []);

  // Snap translateY values for each stage — computed here, passed to useBottomSheet.
  const snapPositions = useMemo(() => {
    const effPinnedH = pinnedHeight || lastPinnedHeightRef.current;
    return [
      vp.vh - headerHeight,                      // 0: closed
      Math.max(0, vp.vh - headerHeight - effPinnedH), // 1: peeked
      Math.max(0, vp.vw),                        // 2: open (square constraint)
      0,                                         // 3: full
    ];
  }, [vp, headerHeight, pinnedHeight]);

  // ── 4-stage bottom-sheet gesture system ────────────────────────────────────
  // stage 0 = closed, 1 = peeked, 2 = open, 3 = full
  // All gesture state, snap logic, and touch handlers live in useBottomSheet.
  const {
    stage,
    setStage,
    panelStyle,
    currentTranslateY,
    handlers: {
      onDragStart,
      onDragEnd,
      onScrollBodyTouchStart,
      onScrollBodyTouchEnd,
    },
  } = useBottomSheet({ snapPositions, isMobile, pinnedRef, headerRef, scrollBodyRef });

  // Peek bar height — header + pinned (used for toast positioning).
  const peekBarH = headerHeight + (pinnedHeight || lastPinnedHeightRef.current);

  // ── CSS custom properties ──────────────────────────────────────────────────
  // --panel-bar-h     : bar height for stage 1 (NotificationToast offset)
  // --panel-visible-h : visible slice per stage (App fitBounds bottom padding)
  useEffect(() => {
    if (!isMobile) {
      document.documentElement.style.setProperty('--panel-bar-h',     '0px');
      document.documentElement.style.setProperty('--panel-visible-h', '0px');
      return;
    }
    document.documentElement.style.setProperty('--panel-bar-h', `${peekBarH}px`);
    const visH = stage === 0 ? headerHeight
               : stage === 1 ? peekBarH
               : stage === 2 ? Math.max(0, vp.vh - vp.vw)
               : 0; // stage 3: full screen — map centering skipped in App
    document.documentElement.style.setProperty('--panel-visible-h', `${visH}px`);
  }, [isMobile, stage, peekBarH, headerHeight, vp]);

  // ── Scrollable body max height ─────────────────────────────────────────────
  // Stage 2: cap body so total visible panel = vh−vw (square map constraint).
  // Stage 3: unconstrained — body fills remaining screen (flex-1).
  const scrollBodyMaxH = useMemo(() => {
    if (!isMobile || stage !== 2) return null;
    return Math.max(0, vp.vh - vp.vw - headerHeight);
  }, [isMobile, stage, vp, headerHeight]);

  // Expose light/dark theme so components outside the React prop tree stay in sync.
  useEffect(() => {
    document.documentElement.dataset.uiTheme = isLight ? 'light' : 'dark';
  }, [isLight]);

  // ── Stage sync → re-centre map ─────────────────────────────────────────────
  const onCenterMapRef = useRef(onCenterMap);
  useEffect(() => { onCenterMapRef.current = onCenterMap; }, [onCenterMap]);

  const isFirstStageEffect = useRef(true);
  useEffect(() => {
    if (isFirstStageEffect.current) { isFirstStageEffect.current = false; return; }
    if (!isMobile || stage === 3) return; // full screen — no map centering needed
    const id = setTimeout(() => onCenterMapRef.current?.(), 50);
    return () => clearTimeout(id);
  }, [stage, isMobile]);

  // Initial centering once heights are measured and --panel-visible-h is set.
  const hasInitialCentered = useRef(false);
  useEffect(() => {
    if (hasInitialCentered.current || peekBarH === 0 || !isMobile) return;
    hasInitialCentered.current = true;
    const id = setTimeout(() => onCenterMapRef.current?.(), 200);
    return () => clearTimeout(id);
  }, [peekBarH, isMobile]);

  // ── Panel outer ref (used for search-results positioning) ─────────────────
  const panelRef = useRef(null);

  // ── Search results bottom position ─────────────────────────────────────────
  const panelH = panelRef.current?.offsetHeight ?? vp.vh;
  const resultsBottomPx = panelH - currentTranslateY + 4;

  // ── Scroll-to-section refs & callback ─────────────────────────────────────
  const solarSectionRef = useRef(null);
  const lunarSectionRef = useRef(null);

  // Opens stage 2 (partial) then scrolls the scroll body to the given section.
  const scrollToSection = useCallback((sectionRef) => {
    setStage(2);
    // Wait for the stage transition and display:none removal before scrolling.
    setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  }, []);

  // ── Icon button helper ─────────────────────────────────────────────────────
  const iconBtn = (active) =>
    `w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-sm transition-all duration-200
    ${active
      ? 'bg-cyan-400 text-black shadow-[0_0_12px_2px_rgba(34,211,238,0.45)] border-black-400/50'
      : `${glassClass} ${textPrimary}`
    }`;

  // ── Pinned section content (stage 1) ─────────────────────────────────────
  const fmt = (d) => timezone && d ? formatTime(d, timezone, use24h) : '--';
  function pad(n) { return String(n).padStart(2, '0'); }

  // ── Overlay scale slider (single definition, rendered in pinned section) ───
  const pinnedSection = (
    <>
      {/* Brief sun / moon summary with sun angles */}
      <div className="flex items-center gap-3 py-2 text-xs">
        {/* Sun times — tapping jumps to stage 3 + solar section */}
        <button
          onClick={() => scrollToSection(solarSectionRef)}
          className="flex items-center gap-1.5 min-w-0 text-left active:opacity-70 transition-opacity"
        >
          <div className="leading-tight">
            <div className={`font-mono text-xs ${isLight ? 'text-orange-700' : 'text-orange-300'}`}>
              {fmt(sunData?.times?.sunrise)}
              {" "}
              {sunData?.eventAzimuths?.sunrise != null && (
                <span>({Math.round(sunData.eventAzimuths.sunrise)}°)</span>
              )}
            </div>
            <div className={`font-mono text-xs ${isLight ? 'text-red-700' : 'text-red-300'}`}>
              {fmt(sunData?.times?.sunset)}
              {" "}
              {sunData?.eventAzimuths?.sunset != null && (
                <span>({Math.round(sunData.eventAzimuths.sunset)}°)</span>
              )}
            </div>
          </div>
        </button>
        <div className={`w-px self-stretch ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />
        {/* Moon icon — tapping jumps to stage 3 + lunar section */}
        <button
          onClick={() => scrollToSection(lunarSectionRef)}
          className="flex items-center gap-1.5 min-w-0 active:opacity-70 transition-opacity"
        >
          {moonData?.illumination?.phase != null && (
            <MoonPhaseIcon phase={moonData.illumination.phase} />
          )}
        </button>
        <div className={`w-px self-stretch ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />
        {/* Date picker */}
        <div className='flex-1'>
          <input
            type="date"
            value={`${year}-${pad(month)}-${pad(day)}`}
            onChange={(e) => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                if (y && m && d) onDateChange(y, m, d);
            }}
            className={`w-full max-w-full appearance-none rounded-lg px-3 py-1.5 text-sm outline-none
              ${isLight
                ? 'bg-black/5 border border-black/10 text-slate-900 focus:border-amber-500/70'
                : 'bg-white/5 border border-white/10 text-white focus:border-amber-500/50'}`}
          />
        </div>
      </div>
      {/* Zoom level slider */}
      <div
        className={`border-t ${borderColor} pt-1`}
      >
        <div className="flex justify-between items-center mt-2 mb-1">
          <label className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
            Zoom Level
          </label>
        </div>
        <input
          type="range"
          min={OVERLAY_ZOOM.min}
          max={OVERLAY_ZOOM.max}
          step={OVERLAY_ZOOM.step}
          value={overlayZoom ?? DEFAULT_ZOOM}
          onChange={(e) => onOverlayZoomChange?.(Number(e.target.value))}
          className="w-full"
        />
        <div className={`flex justify-between text-[9px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-gray-600'}`}>
          <span>City</span>
          <span>Suburb</span>
          <span>Neighborhood</span>
          <span>Street</span>
          <span>House</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Search results — fixed to the viewport, bottom tracks the panel top.
           Rendered outside the transformed panel so position:fixed is
           relative to the viewport (not the transformed ancestor). */}
      {searchActive && mobileResultsOpen && mobileResults.length > 0 && (
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
        </ul>
      )}

      {/* Desktop: side panel / Mobile: 4-stage bottom sheet.
           Panel is always 100dvh on mobile; translateY controls visibility. */}
      <div
        ref={panelRef}
        className={`
          fixed z-30 transition-transform duration-300 ease-out
          md:top-0 md:left-0 md:h-full md:w-[360px]
          bottom-0 left-0 right-0 md:right-auto
          h-[100dvh] md:h-full
          touch-pan-y md:touch-auto
          md:${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={panelStyle}
      >
        <div className={`side-panel-inner h-full ${glassClass} md:rounded-none rounded-t-2xl flex flex-col overflow-hidden md:overflow-visible`}>

          {/* ── SECTION 1: Header ─────────────────────────────────────────────
               Contains the grab handle (mobile), title, coords/search, and
               hamburger. This is the drag target for all gesture handling. */}
          <div
            ref={headerRef}
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
              
              {/* Search icon — sits inside the middle area so coords fills max width */}
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
          {/* ── END SECTION 1: Header ─────────────────────────────────────── */}

          {/* ── SECTION 2: Pinned ─────────────────────────────────────────────
               Visible only in stage 1 (peeked). Shows a brief sun/moon
               summary and the overlay scale slider. On desktop this section
               is always hidden (slider lives in the scroll body). */}
          <div
            ref={pinnedRef}
            className={`shrink-0 px-4 border-t border-b ${borderColor}`}
            style={{
              display: (isMobile && stage === 1) ? undefined : 'none',
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
            }}
          >
            {pinnedSection}
          </div>
          {/* ── END SECTION 2: Pinned ─────────────────────────────────────── */}

          {/* ── SECTION 3: Scrollable body ────────────────────────────────────
               Shown in stages 2 (open) and 3 (full).
               Stage 2: maxHeight enforces the square-map constraint.
               Stage 3: unconstrained; flex-1 fills the remaining screen.    */}
          <div
            ref={scrollBodyRef}
            onTouchStart={onScrollBodyTouchStart}
            onTouchEnd={onScrollBodyTouchEnd}
            className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 py-3 space-y-4 [scrollbar-gutter:stable]
                        touch-pan-y md:touch-auto overscroll-none ${isLight ? 'light-panel' : ''}`}
            style={{
              ...(scrollBodyMaxH !== null ? { maxHeight: scrollBodyMaxH } : {}),
              ...(isMobile && stage < 2 ? { display: 'none' } : {}),
              paddingBottom: (isMobile && stage === 3)
                ? 'max(env(safe-area-inset-bottom, 0px), 24px)'
                : 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Pinned section */}
            <div
              className={`pb-3 border-b ${borderColor}`}
            >
              {pinnedSection}
            </div>

            <DateTimeControls
              year={year}
              month={month}
              day={day}
              timeMinutes={timeMinutes}
              sunTimes={sunData?.times}
              timezone={timezone}
              onDateChange={onDateChange}
              onTimeChange={onTimeChange}
              use24h={use24h}
              coords={coords}
              isLight={isLight}
            />

            <div ref={solarSectionRef} className={`border-t ${borderColor} pt-3`}>
              <SolarInfo sunData={sunData} timezone={timezone} isLight={isLight} use24h={use24h} />
            </div>

            <div ref={lunarSectionRef} className={`border-t ${borderColor} pt-3`}>
              <LunarInfo moonData={moonData} timezone={timezone} isLight={isLight} use24h={use24h} />
            </div>

            <div className={`border-t ${borderColor} pt-3`}>
              <AdvancedPanel sunData={sunData} timezone={timezone} elevation={elevation} isLight={isLight} use24h={use24h} onToggle24h={() => onUse24hChange(!use24h)} />
            </div>

            {timezone && (
              <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-600'} text-center pb-2`}>
                {LABELS.timezoneLabel}: {timezone}
              </div>
            )}
          </div>
          {/* ── END SECTION 3: Scrollable body ────────────────────────────── */}

        </div>
      </div>
    </>
  );
}
