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
import DateTimeControls from './DateTimeControls';
import SolarInfo from './SolarInfo';
import LunarInfo from './LunarInfo';
import AdvancedPanel from './AdvancedPanel';
import { LABELS } from '../config';
import { useTheme } from '../hooks/useTheme';
import { useTimeFormat } from '../hooks/useTimeFormat';

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
  // PinnedSection props (rendered at the top of the scroll body)
  sunData,
  moonData,
  year,
  month,
  day,
  overlayZoom,
  onOverlayZoomChange,
  onDateChange,
  onScrollToSolar,
  onScrollToLunar,
  // DateTimeControls props
  timeMinutes,
  onTimeChange,
  coords,
  // AdvancedPanel props
  elevation,
}) {
  const { isLight, borderColor } = useTheme();
  const { timezone, use24h, setUse24h } = useTimeFormat();
  return (
    <div
      ref={scrollBodyRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
      {/* Pinned section duplicate — always visible in the scroll body */}
      <div className={`pb-3 border-b ${borderColor}`}>
        <PinnedSection
          sunData={sunData}
          moonData={moonData}
          year={year}
          month={month}
          day={day}
          overlayZoom={overlayZoom}
          onOverlayZoomChange={onOverlayZoomChange}
          onDateChange={onDateChange}
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
        onDateChange={onDateChange}
        onTimeChange={onTimeChange}
        coords={coords}
      />

      <div ref={solarSectionRef} className={`border-t ${borderColor} pt-3`}>
        <SolarInfo sunData={sunData} />
      </div>

      <div ref={lunarSectionRef} className={`border-t ${borderColor} pt-3`}>
        <LunarInfo moonData={moonData} />
      </div>

      <div className={`border-t ${borderColor} pt-3`}>
        <AdvancedPanel
          sunData={sunData}
          elevation={elevation}
        />
      </div>

      {timezone && (
        <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-600'} text-center pb-2`}>
          {LABELS.timezoneLabel}: {timezone}
        </div>
      )}
    </div>
  );
}
