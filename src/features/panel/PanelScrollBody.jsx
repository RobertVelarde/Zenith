/**
 * @file PanelScrollBody.jsx
 *
 * Section 3 of the panel: the scrollable content body.
 *
 * Visible at mobile stages 2+ and always on desktop.
 * Stage 2: maxHeight is constrained so the map above maintains a square aspect ratio.
 * Stage 3: unconstrained — fills remaining screen height via flex-1.
 *
 * Contains, in order:
 *  1. A duplicate of PinnedSection (so it's visible in the scroll body at stages 2+)
 *  2. DateTimeControls
 *  3. SolarInfo (with a section ref for scroll-to)
 *  4. LunarInfo (with a section ref for scroll-to)
 *  5. AdvancedPanel
 *  6. Timezone label footer
 */

import PinnedSection from './PinnedSection';
import DateTimeControls from '../datetime/DateTimeControls';
import SolarInfo from '../solar/SolarInfo';
import LunarInfo from '../lunar/LunarInfo';
import AdvancedPanel from '../solar/AdvancedPanel';
import { LABELS } from '../../config';
import { useTheme } from '../../shared/hooks/useTheme';
import { useTimeFormat } from '../../shared/hooks/useTimeFormat';
import { useAppState, useAppDispatch } from '../../app/AppContext';

export default function PanelScrollBody({
  // Ref + gesture handlers (from useBottomSheet via SidePanel)
  scrollBodyRef,
  onTouchStart,
  onTouchEnd,
  // Height constraint (stage 2 square-map constraint)
  scrollBodyMaxH,
  // Visibility control
  isMobile,
  stage,
  // Section refs for scroll-to navigation
  solarSectionRef,
  lunarSectionRef,
  // Scroll-to callbacks
  onScrollToSolar,
  onScrollToLunar,
}) {
  const { isLight, borderColor } = useTheme();
  const { timezone, use24h, setUse24h } = useTimeFormat();
  const { sunData, moonData, year, month, day, overlayZoom, timeMinutes, elevation, coords } = useAppState();
  const { handleOverlayZoomChange, handleDateChange, setTimeMinutes } = useAppDispatch();
  return (
    <div
      ref={scrollBodyRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 py-0 space-y-4 [scrollbar-gutter:stable]
                  touch-pan-y md:touch-auto overscroll-none ${isLight ? 'light-panel' : ''} border-b border-t ${borderColor}`}
      style={{
        ...(scrollBodyMaxH !== null ? { maxHeight: scrollBodyMaxH } : {}),
        ...(isMobile && stage < 2 ? { display: 'none' } : {}),
        paddingBottom: (isMobile && stage === 3)
          ? 'max(env(safe-area-inset-bottom, 0px), 24px)'
          : 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Pinned section duplicate — always visible in the scroll body */}
      <div className={`pb-3`}>
        <PinnedSection
          onScrollToSolar={onScrollToSolar}
          onScrollToLunar={onScrollToLunar}
        />
      </div>

      <DateTimeControls
        year={year}
        month={month}
        day={day}
        timeMinutes={timeMinutes}
        sunTimes={sunData?.times}
        onDateChange={handleDateChange}
        onTimeChange={setTimeMinutes}
        coords={coords}
      />

      <div ref={solarSectionRef} className={`border-t ${borderColor} pt-3`}>
        <SolarInfo />
      </div>

      <div ref={lunarSectionRef} className={`border-t ${borderColor} pt-3`}>
        <LunarInfo />
      </div>

      <div className={`border-t ${borderColor} pt-3`}>
        <AdvancedPanel />
      </div>

      {timezone && (
        <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-600'} text-center pb-2`}>
          {LABELS.timezoneLabel}: {timezone}
        </div>
      )}
    </div>
  );
}
