/**
 * @file Collapsible side panel containing all controls and data displays.
 *
 * On desktop it renders as a left-docked panel; on mobile it becomes a
 * bottom sheet with a persistent header bar.
 *
 * Mobile layout — three distinct sections with known, measured heights:
 *
 *   ┌─────────────────────┐
 *   │   HEADER SECTION    │  ← title, search, coords, settings, arrow
 *   ├─────────────────────┤
 *   │   PINNED SECTION    │  ← overlay scale slider (always here, never moves)
 *   ├─────────────────────┤
 *   │   SCROLLABLE BODY   │  ← date/time, solar, lunar, … (off-screen when peeked)
 *   └─────────────────────┘
 *
 * When peeked the panel is translated downward so only the header + pinned
 * sections are visible.  Because the pinned section never changes parents,
 * there is no layout jitter during the open/close transition.
 *
 * Exposed CSS custom properties (mobile only; 0 on desktop):
 *   --panel-bar-h     : peek bar height = headerH + pinnedH  (toast positioning)
 *   --panel-visible-h : visible panel slice (peek bar when peeked, capped at
 *                       vh−vw when open — used by map padding)
 *
 * @module components/SidePanel
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import DateTimeControls from './DateTimeControls';
import SolarInfo from './SolarInfo';
import LunarInfo from './LunarInfo';
import AdvancedPanel from './AdvancedPanel';
import { LABELS, MAPBOX_TOKEN, API, DEFAULT_ZOOM, ZENITH, OVERLAY_ZOOM } from '../config';
import { useNotification } from '../hooks/notificationContext';

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

  // ── Three-section height tracking ──────────────────────────────────────────
  // Section 1: headerRef  — button/title row (drag handle on mobile)
  // Section 2: pinnedRef  — overlay scale slider (always between header and body)
  // Section 3: scrollBodyRef — scrollable content (off-screen when peeked)
  //
  // Heights are measured synchronously via useLayoutEffect so the panel is
  // already positioned correctly before the browser's first paint — no flash.
  const headerRef     = useRef(null);
  const pinnedRef     = useRef(null);
  const scrollBodyRef = useRef(null);

  const [headerHeight, setHeaderHeight] = useState(0);
  const [pinnedHeight, setPinnedHeight] = useState(0);
  const [scrollBodyHeight, setScrollBodyHeight] = useState(0);
  // Cache the last non-zero pinnedHeight so peekBarH is correct on the very
  // first frame after transitioning open → peeked (before ResizeObserver fires).
  const lastPinnedHeightRef = useRef(0);

  // Synchronous initial measurement — fires before paint, preventing any
  // visible jump from translateY(0) → peeked position.
  useLayoutEffect(() => {
    if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    if (pinnedRef.current) {
      const ph = pinnedRef.current.offsetHeight;
      setPinnedHeight(ph);
      if (ph > 0) lastPinnedHeightRef.current = ph;
    }
    if (scrollBodyRef.current) setScrollBodyHeight(scrollBodyRef.current.offsetHeight);
  }, []);

  // Keep measurements updated as content reflows (e.g. search bar opens,
  // scrollable body grows when the slider migrates into it).
  useEffect(() => {
    const hEl = headerRef.current;
    const pEl = pinnedRef.current;
    const sEl = scrollBodyRef.current;
    if (!hEl || !pEl || !sEl) return;
    const ro = new ResizeObserver(() => {
      setHeaderHeight(hEl.offsetHeight);
      const ph = pEl.offsetHeight;
      setPinnedHeight(ph);
      if (ph > 0) lastPinnedHeightRef.current = ph;
      setScrollBodyHeight(sEl.offsetHeight);
    });
    ro.observe(hEl);
    ro.observe(pEl);
    ro.observe(sEl);
    return () => ro.disconnect();
  }, []);

  
  // ── Peek (partial-collapse) state ──────────────────────────────────────────
  const [peeked, setPeeked] = useState(() => window.innerWidth < 768);

  // Sync --peeked CSS var; scroll body back to top when collapsing.
  useEffect(() => {
    document.documentElement.style.setProperty('--peeked', `${peeked}`);
    if (peeked && scrollBodyRef.current) {
      scrollBodyRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [peeked]);

  // Peek bar: visible height when the panel is in the peeked state.
  // Use lastPinnedHeightRef as fallback so the value is correct on the first
  // frame after peeked becomes true (before ResizeObserver fires and updates
  // pinnedHeight from display:none → display:block).
  const peekBarH = headerHeight + (pinnedHeight || lastPinnedHeightRef.current);
  // Total panel height (header + pinned + actual rendered scrollable body).
  const totalPanelH = headerHeight + pinnedHeight + scrollBodyHeight;

  // ── CSS custom properties ──────────────────────────────────────────────────
  // --panel-bar-h     : peek bar height (used by NotificationToast positioning)
  // --panel-visible-h : actual visible slice (used by App fitBounds padding)
  useEffect(() => {
    const update = () => {
      if (window.innerWidth >= 768) {
        document.documentElement.style.setProperty('--panel-bar-h', '0px');
        document.documentElement.style.setProperty('--panel-visible-h', '0px');
        return;
      }
      document.documentElement.style.setProperty('--panel-bar-h', `${peekBarH}px`);
      if (peeked) {
        document.documentElement.style.setProperty('--panel-visible-h', `${peekBarH}px`);
      } else {
        document.documentElement.style.setProperty('--panel-visible-h', `${totalPanelH}px`);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [peeked, peekBarH, totalPanelH]);

  // ── Scrollable body max height ─────────────────────────────────────────────
  // Constrain the scrollable body so total panel height ≤ (vh − vw),
  // keeping at least a square of map visible when the panel is open.
  const [scrollBodyMaxH, setScrollBodyMaxH] = useState(null);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth >= 768) { setScrollBodyMaxH(null); return; }
      const maxPanel = Math.max(0, window.innerHeight - window.innerWidth);
      // The pinned section is hidden when the panel is open, so the scroll
      // body takes all space below the header (slider is inside it instead).
      setScrollBodyMaxH(Math.max(0, maxPanel - headerHeight));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [headerHeight]);

  // Expose light/dark theme so components outside the React prop tree stay in sync.
  useEffect(() => {
    document.documentElement.dataset.uiTheme = isLight ? 'light' : 'dark';
  }, [isLight]);

  // Keep a stable ref to onCenterMap to avoid stale closure issues.
  const onCenterMapRef = useRef(onCenterMap);
  useEffect(() => { onCenterMapRef.current = onCenterMap; }, [onCenterMap]);

  // Re-centre the map after the panel opens or closes on mobile.
  const isFirstPeekEffect = useRef(true);
  useEffect(() => {
    if (isFirstPeekEffect.current) { isFirstPeekEffect.current = false; return; }
    if (window.innerWidth >= 768) return;
    const id = setTimeout(() => onCenterMapRef.current?.(), 50);
    return () => clearTimeout(id);
  }, [peeked]);

  // Initial centering: once heights are measured (and --panel-visible-h is set),
  // centre the map on the default location with correct bottom padding.
  // The 200 ms delay gives the Mapbox instance time to fully initialise.
  const hasInitialCentered = useRef(false);
  useEffect(() => {
    if (hasInitialCentered.current || peekBarH === 0 || window.innerWidth >= 768) return;
    hasInitialCentered.current = true;
    const id = setTimeout(() => onCenterMapRef.current?.(), 200);
    return () => clearTimeout(id);
  }, [peekBarH]);

  // Slide the panel so only header + pinned are above the viewport bottom.
  const peekStyle =
    peeked && peekBarH > 0 && window.innerWidth < 768
      ? { transform: `translateY(calc(100% - ${peekBarH}px))` }
      : undefined;

  // ── Drag gesture ───────────────────────────────────────────────────────────
  const panelRef = useRef(null);
  const dragRef  = useRef(null);
  const [liveTransform, setLiveTransform] = useState(null);

  const computeBaseY = useCallback(() => {
    const h = panelRef.current?.offsetHeight ?? 0;
    return peeked ? h - peekBarH : 0;
  }, [peeked, peekBarH]);

  const onDragStart = useCallback((e) => {
    if (window.innerWidth >= 768) return;
    const touch = e.touches[0];
    const baseY = computeBaseY();
    dragRef.current = { startY: touch.clientY, startTime: Date.now(), baseY };
    setLiveTransform(baseY);
  }, [computeBaseY]);

  const onDragMove = useCallback((e) => {
    if (!dragRef.current) return;
    e.preventDefault(); // must be in a non-passive listener (see useEffect below)
    const touch = e.touches[0];
    const dy    = touch.clientY - dragRef.current.startY;
    setLiveTransform(Math.max(0, dragRef.current.baseY + dy));
  }, []);

  // React's onTouchMove is passive by default, so e.preventDefault() silently
  // fails. We register a native non-passive listener on the header element instead.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    el.addEventListener('touchmove', onDragMove, { passive: false });
    return () => el.removeEventListener('touchmove', onDragMove);
  }, [onDragMove]);

  const onDragEnd = useCallback((e) => {
    if (!dragRef.current) return;
    const touch = e.changedTouches[0];
    const dy    = touch.clientY - dragRef.current.startY;
    const dt    = Math.max(1, Date.now() - dragRef.current.startTime);
    const vel   = dy / dt; // px/ms — positive = downward

    const DIST = 80;   // px
    const VEL  = 0.3;  // px/ms

    if (peeked) {
      // Flick/drag upward → open fully.
      if (vel < -VEL || dy < -DIST) setPeeked(false);
      // Downward gesture while already peeked → ignore (no "fully closed" state).
    } else {
      // Flick/drag downward → peek.
      if (vel > VEL || dy > DIST) setPeeked(true);
    }

    dragRef.current = null;
    setLiveTransform(null);
  }, [peeked]);

  const panelStyle = liveTransform !== null
    ? { transform: `translateY(${liveTransform}px)`, transition: 'none', willChange: 'transform' }
    : peekStyle ? { ...peekStyle, willChange: 'transform' } : undefined;

  // ── Search results bottom position ─────────────────────────────────────────
  // Float the results list just above the panel top regardless of translation.
  const panelH = panelRef.current?.offsetHeight ?? 0;
  const currentTranslateY =
    liveTransform !== null
      ? liveTransform
      : peeked && peekBarH > 0
        ? panelH - peekBarH
        : 0;
  const resultsBottomPx = panelH - currentTranslateY + 4;

  // ── Scroll-body drag-to-close ──────────────────────────────────────────────
  // When the panel is open and the user pulls down from the very top of the
  // scroll area, collapse the panel instead of rubber-banding. Normal
  // scrolling (including past the bottom) is unaffected.
  const scrollDragRef = useRef(null);

  const onScrollBodyTouchStart = useCallback((e) => {
    if (window.innerWidth >= 768) return;
    scrollDragRef.current = { startY: e.touches[0].clientY, startTime: Date.now() };
  }, []);

  const onScrollBodyTouchMove = useCallback((e) => {
    if (!scrollDragRef.current) return;
    const el = scrollBodyRef.current;
    if (!el) return;
    const dy = e.touches[0].clientY - scrollDragRef.current.startY;
    if (el.scrollTop === 0 && dy > 0) {
      e.preventDefault(); // block rubber-band; we handle this gesture
    } else {
      scrollDragRef.current = null; // normal scroll — let browser handle it
    }
  }, []);

  const onScrollBodyTouchEnd = useCallback((e) => {
    if (!scrollDragRef.current) return;
    const dy  = e.changedTouches[0].clientY - scrollDragRef.current.startY;
    const dt  = Math.max(1, Date.now() - scrollDragRef.current.startTime);
    const vel = dy / dt;
    scrollDragRef.current = null;
    if (vel > 0.3 || dy > 60) setPeeked(true);
  }, []);

  useEffect(() => {
    const el = scrollBodyRef.current;
    if (!el) return;
    el.addEventListener('touchmove', onScrollBodyTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onScrollBodyTouchMove);
  }, [onScrollBodyTouchMove]);

  // ── Icon button helper ─────────────────────────────────────────────────────
  const iconBtn = (active) =>
    `w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-sm transition-all duration-200
    ${active
      ? 'bg-cyan-400 text-black shadow-[0_0_12px_2px_rgba(34,211,238,0.45)] border-black-400/50'
      : `${glassClass} ${textPrimary}`
    }`;

  // ── Overlay scale slider (single definition, rendered in pinned section) ───
  const overlayScaleSlider = (
    <>
      <div className="flex justify-between items-center mt-2 mb-1">
        <label className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
          Overlay Scale
        </label>
        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
          {(overlayZoom ?? DEFAULT_ZOOM) < DEFAULT_ZOOM ? 'Zoomed Out'
            : (overlayZoom ?? DEFAULT_ZOOM) > DEFAULT_ZOOM ? 'Zoomed In'
            : 'Default'}
        </span>
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
        <span>Far</span>
        <span>Default</span>
        <span>Close</span>
      </div>
    </>
  );

  return (
    <>
      {/* Search results — fixed to the viewport, bottom tracks the panel top.
           Rendered outside the transformed panel so that position:fixed is
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

      {/* Desktop: side panel / Mobile: bottom sheet (always visible on mobile) */}
      <div
        ref={panelRef}
        className={`
          fixed z-30 transition-transform duration-300 ease-out
          md:top-0 md:left-0 md:h-full md:w-[340px]
          bottom-0 left-0 right-0 md:right-auto
          touch-pan-y md:touch-auto
          translate-y-0
          md:${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={panelStyle}
      >

        <div className={`side-panel-inner h-full ${glassClass} md:rounded-none rounded-t-2xl flex flex-col overflow-hidden md:overflow-visible`}>

          {/* ── SECTION 1: Header ────────────────────────────────────────────
               Drag handle for the open/close gesture on mobile.
               The non-passive touchmove listener is registered on headerRef
               so e.preventDefault() correctly suppresses scroll passthrough. */}
          <div
            ref={headerRef}
            onTouchStart={onDragStart}
            onTouchEnd={onDragEnd}
            className={`shrink-0 relative select-none`}
          >
            <div className="flex items-center gap-1.5 px-2 py-2">

              {/* 1. Title — short tap centers the map; hold requests geolocation */}
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

              {/* 3. Search button */}
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

              {/* 2. Middle area — inner h-9 box clips height; relative wrapper
                   lets the desktop dropdown escape that clip boundary.        */}
              <div className="relative flex-1 min-w-0">
                <div className="h-9">
                  {settingsActive ? (

                    /* Settings mode: Dark Mode + Satellite toggles. */
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
                          onStyleChange( isSatellite ? 'satellite' :isDark ? 'dark' : 'light');
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

                    /* Search mode: text input — 16 px font prevents iOS auto-zoom. */
                    <div className={`flex h-full items-center gap-1.5 ${glassClass} rounded-xl px-2.5`}>
                      <input
                        autoFocus
                        ref={mobileSearchInput}
                        type="text"
                        value={mobileQuery}
                        onChange={(e) => { setMobileQuery(e.target.value); mobileSearch(e.target.value); }}
                        onBlur={() => {
                          // Delay so a result tap/click registers before we close.
                          setTimeout(() => setSearchActive(false), 150);
                        }}
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

                    /* Normal mode: coordinates — tap to copy */
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
                      className={`h-full w-full px-2.5 rounded-xl ${glassClass} text-xs font-mono text-left truncate flex items-center transition-all duration-200 ${textPrimary}`}
                    >
                      {coordsFlash
                        ? 'Coordinates copied!'
                        : coords
                          ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
                          : <span className={isLight ? 'text-slate-400' : 'text-gray-500'}>No location</span>
                      }
                    </button>

                  )}
                </div>

                {/* Desktop/tablet search results — inline dropdown below the input.
                     Mobile uses the fixed-positioned list rendered outside the panel. */}
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

              {/* Hamburger / settings button */}
              <button
                onClick={toggleSettings}
                className={iconBtn(settingsActive)}
                aria-label="Map settings"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Arrow — mobile only */}
              <button
                onClick={() => setPeeked((v) => !v)}
                className={`${iconBtn(false)} md:hidden`}
                aria-label={peeked ? 'Expand menu' : 'Collapse menu'}
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-300 ${peeked ? 'rotate-0' : 'rotate-180'}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>

            </div>
          </div>
          {/* ── END SECTION 1: Header ───────────────────────────────────────── */}

          {/* ── SECTION 2: Pinned ────────────────────────────────────────────
               Visible only when the panel is peeked. Contains the overlay
               scale slider so the user can adjust it without opening the panel.
               When the panel opens the slider migrates into the scrollable body
               (Section 3) and this section collapses to display:none so the
               scroll body gains the extra space.
               lastPinnedHeightRef caches the height so peekBarH is correct on
               the very first frame of the open→peeked transition.           */}
          <div
            ref={pinnedRef}
            className={`shrink-0 px-3 border-t border-b ${borderColor}`}
            style={{
              display: peeked ? undefined : 'none',
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {overlayScaleSlider}
          </div>
          {/* ── END SECTION 2: Pinned ───────────────────────────────────────── */}

          {/* ── SECTION 3: Scrollable body ───────────────────────────────────
               Translated off-screen when peeked; constrained in height so
               the remaining map area is at least a square.                  */}
          <div
            ref={scrollBodyRef}
            onTouchStart={onScrollBodyTouchStart}
            onTouchEnd={onScrollBodyTouchEnd}
            className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 py-3 space-y-4
                        touch-pan-y md:touch-auto ${isLight ? 'light-panel' : ''}`}
            style={{
              ...(scrollBodyMaxH !== null ? { maxHeight: scrollBodyMaxH } : {}),
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* ── Overlay scale slider (migrated from pinned section when open) ── */}
            {!peeked && (
              <div
                className={`pb-3 border-b ${borderColor}`}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                {overlayScaleSlider}
              </div>
            )}

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

            <div className={`border-t ${borderColor} pt-3`}>
              <SolarInfo sunData={sunData} timezone={timezone} isLight={isLight} use24h={use24h} />
            </div>

            <div className={`border-t ${borderColor} pt-3`}>
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

        </div>
      </div>
    </>
  );
}
