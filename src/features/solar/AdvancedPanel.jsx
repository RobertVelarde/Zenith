/**
 * @file Collapsible "Advanced" panel — twilight times, day-length
 *       breakdown, and time-format toggle.
 *
 * @module components/AdvancedPanel
 */

import { useState } from 'react';
import { formatDuration } from '../../shared/utils/timezone';
import { LABELS } from '../../config';
import DataRow from '../../shared/components/DataRow';
import { useTheme } from '../../shared/hooks/useTheme';
import { useTimeFormat } from '../../shared/hooks/useTimeFormat';
import { useAppState } from '../../app/AppContext';

/**
 * @param {Object} props
 * @param {Object}   props.sunData    - Result from `getSunData()`.
 * @param {string}   props.timezone   - IANA timezone string.
 * @param {boolean}  props.isLight    - Light-theme flag.
 * @param {boolean}  props.use24h     - 24-hour format flag.
 * @param {Function} props.onToggle24h - Toggle between 12/24h.
 */
export default function AdvancedPanel({ sunData: propSunData } = {}) {
  const [open, setOpen] = useState(false);
  const { isLight } = useTheme();
  const { fmt, timezone } = useTimeFormat();
  const { sunData: ctxSunData } = useAppState() || {};
  const sunData = ctxSunData ?? propSunData;

  if (!sunData || !timezone) return null;

  const t = sunData.times;
  const dayLen =
    t.sunset && t.sunrise && !isNaN(t.sunset.getTime()) && !isNaN(t.sunrise.getTime())
      ? t.sunset - t.sunrise
      : null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full text-xs ${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-gray-400 hover:text-gray-200'} py-1 transition-colors`}
      >
        <span className="uppercase tracking-wider font-medium">{LABELS.advancedHeader}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="space-y-0.5 pt-1 animate-in fade-in">
          <div className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-gray-600'} mt-2 mb-0.5`}>{LABELS.civilTwilight}</div>
          <DataRow label={LABELS.dawn} value={fmt(t.dawn)} isLight={isLight} />
          <DataRow label={LABELS.dusk} value={fmt(t.dusk)} isLight={isLight} />

          <div className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-gray-600'} mt-2 mb-0.5`}>{LABELS.nauticalTwilight}</div>
          <DataRow label={LABELS.dawn} value={fmt(t.nauticalDawn)} isLight={isLight} />
          <DataRow label={LABELS.dusk} value={fmt(t.nauticalDusk)} isLight={isLight} />

          <div className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-gray-600'} mt-2 mb-0.5`}>{LABELS.astroTwilight}</div>
          <DataRow label={LABELS.dawn} value={fmt(t.nightEnd)} isLight={isLight} />
          <DataRow label={LABELS.dusk} value={fmt(t.night)} isLight={isLight} />

          {dayLen != null && (
            <>
              <div className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-gray-600'} mt-2 mb-0.5`}>{LABELS.dayLengthHeader}</div>
              <DataRow label={LABELS.daylight} value={formatDuration(dayLen)} isLight={isLight} />
              <DataRow label={LABELS.night} value={formatDuration(86400000 - dayLen)} isLight={isLight} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
