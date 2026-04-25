/**
 * @file PinnedSection.jsx
 *
 * Section 2 (pinned) of the panel: brief sun/moon summary + date picker + zoom slider.
 *
 * Rendered in two places by the parent:
 *  1. Inside the `ref={pinnedRef}` div — visible only at mobile stage 1 (peeked)
 *  2. At the top of PanelScrollBody — visible at stages 2+ and on desktop
 *
 * Accepts callbacks `onScrollToSolar` and `onScrollToLunar` so it can trigger
 * the scrollToSection logic that lives in SidePanel without needing direct
 * access to the scroll-body refs.
 */

import MoonPhaseIcon from './MoonPhaseIcon';
import { OVERLAY_ZOOM, DEFAULT_ZOOM } from '../config';
import { formatTime } from '../utils/timezone';

export default function PinnedSection({
  sunData,
  moonData,
  year,
  month,
  day,
  timezone,
  use24h,
  overlayZoom,
  onOverlayZoomChange,
  onDateChange,
  isLight,
  borderColor,
  onScrollToSolar,
  onScrollToLunar,
}) {
  const fmt = (d) => timezone && d ? formatTime(d, timezone, use24h) : '--';
  function pad(n) { return String(n).padStart(2, '0'); }

  return (
    <>
      {/* Brief sun / moon summary with sun angles */}
      <div className="flex items-center gap-3 py-2 text-xs">
        {/* Sun times — tapping jumps to stage 3 + solar section */}
        <button
          onClick={onScrollToSolar}
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
          onClick={onScrollToLunar}
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
      <div className={`border-t ${borderColor} pt-1`}>
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
}
