import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useBottomSheet } from '../hooks/useBottomSheet';
import { LAYOUT } from '../config';
import { useTheme } from '../hooks/useTheme';
import PanelHeader from './PanelHeader';
import PinnedSection from './PinnedSection';
import PanelScrollBody from './PanelScrollBody';

export default function SidePanel({
  coords, year, month, day, timeMinutes, elevation,
  sunData, moonData, isOpen,
  onCoordsChange, onDateChange, onTimeChange, onCenterMap,
  overlayZoom, onOverlayZoomChange, onZenithHold, zenithGold, onZenithTap,
  zenithBlue,
}) {
  const { glassClass, borderColor } = useTheme();
  const [vp, setVp] = useState({ vw: window.innerWidth, vh: window.innerHeight });
  useEffect(() => {
    const u = () => setVp({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener('resize', u); window.addEventListener('orientationchange', u);
    return () => { window.removeEventListener('resize', u); window.removeEventListener('orientationchange', u); };
  }, []);
  const isMobile = vp.vw < LAYOUT.mobileBreakpoint;
  const headerRef = useRef(null), pinnedRef = useRef(null), scrollBodyRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [pinnedHeight, setPinnedHeight] = useState(0);
  const lastPinnedHeightRef = useRef(0);
  useLayoutEffect(() => {
    if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    if (pinnedRef.current) { const ph = pinnedRef.current.offsetHeight; setPinnedHeight(ph); if (ph > 0) lastPinnedHeightRef.current = ph; }
  }, []);
  useEffect(() => {
    const hEl = headerRef.current, pEl = pinnedRef.current;
    if (!hEl || !pEl) return;
    const ro = new ResizeObserver(() => {
      setHeaderHeight(hEl.offsetHeight);
      const ph = pEl.offsetHeight; setPinnedHeight(ph); if (ph > 0) lastPinnedHeightRef.current = ph;
    });
    ro.observe(hEl); ro.observe(pEl); return () => ro.disconnect();
  }, []);
  const snapPositions = useMemo(() => {
    const eph = pinnedHeight || lastPinnedHeightRef.current;
    return [vp.vh - headerHeight, Math.max(0, vp.vh - headerHeight - eph), Math.max(0, vp.vw), 0];
  }, [vp, headerHeight, pinnedHeight]);
  const { stage, setStage, panelStyle, currentTranslateY, handlers: {
    onDragStart, onDragEnd, onScrollBodyTouchStart, onScrollBodyTouchEnd,
  } } = useBottomSheet({ snapPositions, isMobile, pinnedRef, headerRef, scrollBodyRef });
  const peekBarH = headerHeight + (pinnedHeight || lastPinnedHeightRef.current);
  useEffect(() => {
    if (!isMobile) {
      document.documentElement.style.setProperty('--panel-bar-h', '0px');
      document.documentElement.style.setProperty('--panel-visible-h', '0px'); return;
    }
    document.documentElement.style.setProperty('--panel-bar-h', `${peekBarH}px`);
    const visH = stage === 0 ? headerHeight : stage === 1 ? peekBarH : stage === 2 ? Math.max(0, vp.vh - vp.vw) : 0;
    document.documentElement.style.setProperty('--panel-visible-h', `${visH}px`);
  }, [isMobile, stage, peekBarH, headerHeight, vp]);
  const scrollBodyMaxH = useMemo(
    () => (!isMobile || stage !== 2) ? null : Math.max(0, vp.vh - vp.vw - headerHeight),
    [isMobile, stage, vp, headerHeight],
  );
  const onCenterMapRef = useRef(onCenterMap);
  useEffect(() => { onCenterMapRef.current = onCenterMap; }, [onCenterMap]);
  const isFirstStageEffect = useRef(true);
  useEffect(() => {
    if (isFirstStageEffect.current) { isFirstStageEffect.current = false; return; }
    if (!isMobile || stage === 3) return;
    const id = setTimeout(() => onCenterMapRef.current?.(), 50); return () => clearTimeout(id);
  }, [stage, isMobile]);
  const hasInitialCentered = useRef(false);
  useEffect(() => {
    if (hasInitialCentered.current || peekBarH === 0 || !isMobile) return;
    hasInitialCentered.current = true;
    const id = setTimeout(() => onCenterMapRef.current?.(), 200); return () => clearTimeout(id);
  }, [peekBarH, isMobile]);
  const panelRef = useRef(null);
  const resultsBottomPx = (panelRef.current?.offsetHeight ?? vp.vh) - currentTranslateY + 4;
  const solarSectionRef = useRef(null), lunarSectionRef = useRef(null);
  const scrollToSection = useCallback((ref) => {
    setStage(2);
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  }, [setStage]);
  const onScrollToSolar = useCallback(() => scrollToSection(solarSectionRef), [scrollToSection]);
  const onScrollToLunar = useCallback(() => scrollToSection(lunarSectionRef), [scrollToSection]);

  return (
    <div
      ref={panelRef}
      className={`fixed z-30 transition-transform duration-300 ease-out
        md:top-0 md:left-0 md:h-full md:w-[var(--panel-width)]
        bottom-0 left-0 right-0 md:right-auto h-[100dvh] md:h-full
        touch-pan-y md:touch-auto md:${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      style={panelStyle}
    >
      <div className={`side-panel-inner h-full ${glassClass} md:rounded-none rounded-t-2xl flex flex-col overflow-hidden md:overflow-visible`}>
        <PanelHeader
          ref={headerRef} stage={stage} setStage={setStage}
          zenithGold={zenithGold} zenithBlue={zenithBlue} onZenithTap={onZenithTap} onZenithHold={onZenithHold}
          coords={coords} onCoordsChange={onCoordsChange}
          onDragStart={onDragStart} onDragEnd={onDragEnd} resultsBottomPx={resultsBottomPx}
        />
        <div
          ref={pinnedRef}
          className={`shrink-0 px-4 border-t border-b ${borderColor}`}
          style={{ display: (isMobile && stage === 1) ? undefined : 'none', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
        >
          <PinnedSection {...{ sunData, moonData, year, month, day,
            overlayZoom, onOverlayZoomChange, onDateChange,
            onScrollToSolar, onScrollToLunar }} />
        </div>
        <PanelScrollBody
          scrollBodyRef={scrollBodyRef} onTouchStart={onScrollBodyTouchStart} onTouchEnd={onScrollBodyTouchEnd}
          scrollBodyMaxH={scrollBodyMaxH} isMobile={isMobile} stage={stage}
          solarSectionRef={solarSectionRef} lunarSectionRef={lunarSectionRef}
          {...{ sunData, moonData, year, month, day, elevation,
            overlayZoom, onOverlayZoomChange, onDateChange, onTimeChange,
            timeMinutes, coords, onScrollToSolar, onScrollToLunar }}
        />
      </div>
    </div>
  );
}