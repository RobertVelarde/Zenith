/**
 * @file Collapsible side panel containing all controls and data displays.
 *
 * On desktop it renders as a left-docked panel; on mobile it becomes a
 * bottom sheet with a persistent header bar.
 *
 * @module components/SidePanel
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import DateTimeControls from './DateTimeControls';
import SolarInfo from './SolarInfo';
import LunarInfo from './LunarInfo';
import AdvancedPanel from './AdvancedPanel';
import ExternalLinks from './ExternalLinks';
import { LABELS, MAPBOX_TOKEN, API, DEFAULT_ZOOM, ZENITH } from '../config';
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

  const [use24h, setUse24h] = useState(false);

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

  // ── Peek (partial-collapse) state ──────────────────────────────────────────
  // On mobile the bottom sheet starts peeked — only the header bar is visible.
  // The arrow button (or a flick gesture) toggles between peeked and fully open.
  // Desktop is unaffected: peekStyle is always undefined when >= md.
  const [peeked, setPeeked] = useState(() => window.innerWidth < 768);
  const peekZoneRef = useRef(null);
  const [peekZoneHeight, setPeekZoneHeight] = useState(0);

  useEffect(() => {
    const el = peekZoneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPeekZoneHeight(el.offsetHeight));
    ro.observe(el);
    setPeekZoneHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  // Expose the header bar height as a CSS custom property so other components
  // (e.g. NotificationToast) can position themselves above the panel on mobile
  // without any prop-drilling or shared context.
  useEffect(() => {
    const update = () => {
      document.documentElement.style.setProperty(
        '--panel-bar-h',
        window.innerWidth < 768 ? `${peekZoneHeight}px` : '0px',
      );
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [peekZoneHeight]);

  // Expose the current light/dark theme so components outside the React
  // prop tree (e.g. NotificationToast at the app root) can stay in sync.
  useEffect(() => {
    document.documentElement.dataset.uiTheme = isLight ? 'light' : 'dark';
  }, [isLight]);

  // Expose the full visible panel height so App can pad fitBounds correctly.
  // --panel-bar-h   = peek bar height only (used by toast positioning)
  // --panel-visible-h = actual visible slice of the panel (bar when peeked,
  //                     full panel when open)
  useEffect(() => {
    const update = () => {
      // Desktop: panel doesn't affect map height.
      if (window.innerWidth >= 768) {
        document.documentElement.style.setProperty('--panel-visible-h', '0px');
        return;
      }

      const h = panelRef.current?.offsetHeight ?? 0;
      let visibleH = peeked ? peekZoneHeight : h;

      // When fully open on mobile, cap the visible panel height so the
      // remaining map area is at least square (height >= width). That means
      // panel visible height <= window.innerHeight - window.innerWidth.
      if (!peeked) {
        const maxVisible = Math.max(0, window.innerHeight - window.innerWidth);
        if (maxVisible > 0) {
          visibleH = Math.min(visibleH, maxVisible);
        }
      }

      document.documentElement.style.setProperty('--panel-visible-h', `${visibleH}px`);
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [peeked, peekZoneHeight]);

  // ── Scroll-body max height ──────────────────────────────────────────────────
  // Cap total panel height (header + body) to (vh − vw) so the remaining map
  // area is at least a square. Recomputed whenever the header height or the
  // viewport dimensions change.
  const [scrollBodyMaxH, setScrollBodyMaxH] = useState(null);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth >= 768) {
        setScrollBodyMaxH(null); // desktop: panel is side-docked, no constraint
        return;
      }
      const maxPanel = window.innerHeight - window.innerWidth;
      setScrollBodyMaxH(Math.max(0, maxPanel - peekZoneHeight));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [peekZoneHeight]);

  // Keep a stable ref to onCenterMap so the peeked effect below can always
  // call the latest version without listing it as a dependency (which would
  // cause spurious re-centres on every coords change).
  const onCenterMapRef = useRef(onCenterMap);
  useEffect(() => { onCenterMapRef.current = onCenterMap; }, [onCenterMap]);

  // When the panel opens or closes on mobile, re-centre the map inside the
  // visible (unobscured).
  const isFirstPeekEffect = useRef(true);
  useEffect(() => {
    if (isFirstPeekEffect.current) { isFirstPeekEffect.current = false; return; }
    if (window.innerWidth >= 768) return;
    const id = setTimeout(() => onCenterMapRef.current());
    return () => clearTimeout(id);
  }, [peeked]);

  // Only apply the peek translateY on mobile (< 768 px).
  const peekStyle =
    peeked && peekZoneHeight > 0 && window.innerWidth < 768
      ? { transform: `translateY(calc(100% - ${peekZoneHeight}px))` }
      : undefined;

  // ── Drag gesture ───────────────────────────────────────────────────────────
  const panelRef  = useRef(null);
  const dragRef   = useRef(null);
  const [liveTransform, setLiveTransform] = useState(null);

  const computeBaseY = useCallback(() => {
    const h = panelRef.current?.offsetHeight ?? 0;
    return peeked ? h - peekZoneHeight : 0;
  }, [peeked, peekZoneHeight]);

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
  // fails. We register a native non-passive listener instead.
  useEffect(() => {
    const el = peekZoneRef.current;
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

  // ── Search results positioning ─────────────────────────────────────────────
  // The results list must float just above the top of the panel, wherever it
  // currently sits — open, peeked, or mid-drag.
  // Panel is `bottom-0`; its top (in viewport px from the bottom) =
  //   panelHeight − currentTranslateY.
  // So: results bottom = panelHeight − currentTranslateY + gap.
  const panelH = panelRef.current?.offsetHeight ?? 0;
  const currentTranslateY =
    liveTransform !== null
      ? liveTransform
      : peeked && peekZoneHeight > 0
        ? panelH - peekZoneHeight
        : 0;
  const resultsBottomPx = panelH - currentTranslateY + 4;

  // ── Scroll-body drag-to-close ──────────────────────────────────────────────
  // When the panel is open and the user pulls down from the very top of the
  // scroll area, collapse the panel instead of rubber-banding. Normal
  // scrolling (including past the bottom) is unaffected.
  const scrollBodyRef = useRef(null);
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

        <div className={`h-full ${glassClass} md:rounded-none rounded-t-2xl flex flex-col overflow-hidden md:overflow-visible`}>

          {/* ── Panel header — shared across all breakpoints ─────────────────
               Mobile : bottom-sheet strip; touch-drag and arrow toggle peek.
               Desktop/tablet : top bar with border-b; no arrow, no drag.    */}
          <div
            ref={peekZoneRef}
            onTouchStart={onDragStart}
            onTouchEnd={onDragEnd}
            className={`shrink-0 relative select-none md:border-b ${borderColor}`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
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
                          setUse24h(next);
                          onStyleChange( isDark ? 'dark' : 'light');
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
                        const text = "";
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

              {/* 4. Hamburger / settings button */}
              <button
                onClick={toggleSettings}
                className={iconBtn(settingsActive)}
                aria-label="Map settings"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* 5. Arrow — mobile only; hidden on tablet and desktop */}
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

            {/* Overlay Scale slider — lives in the peek zone so it's accessible
                 even when the panel is collapsed to just the header bar.        */}
            <div
              className={`px-3 pb-2 border-t ${borderColor}`}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
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
                min={9}
                max={17}
                step={0.01}
                value={overlayZoom ?? DEFAULT_ZOOM}
                onChange={(e) => onOverlayZoomChange?.(Number(e.target.value))}
                className="w-full"
              />
              <div className={`flex justify-between text-[9px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-gray-600'}`}>
                <span>Far</span>
                <span>Default</span>
                <span>Close</span>
              </div>
            </div>

          </div>
          {/* ── End panel header ─────────────────────────────────────────────── */}

          {/* ── Scrollable body ───────────────────────────────────────────────── */}
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
              <AdvancedPanel sunData={sunData} timezone={timezone} elevation={elevation} isLight={isLight} use24h={use24h} onToggle24h={() => setUse24h((v) => !v)} />
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
