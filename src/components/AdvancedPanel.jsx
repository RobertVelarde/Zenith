/**
 * @file Collapsible "Advanced" panel — twilight times, elevation, day-length
 *       breakdown, and time-format toggle.
 *
 * @module components/AdvancedPanel
 */

import { useState } from 'react';
import { formatTime, formatDuration } from '../utils/timezone';
import { LABELS } from '../config';
import DataRow from './DataRow';

/**
 * @param {Object} props
 * @param {Object}   props.sunData    - Result from `getSunData()`.
 * @param {string}   props.timezone   - IANA timezone string.
 * @param {number|null} props.elevation - Elevation in metres.
 * @param {boolean}  props.isLight    - Light-theme flag.
 * @param {boolean}  props.use24h     - 24-hour format flag.
 * @param {Function} props.onToggle24h - Toggle between 12/24h.
 */
export default function AdvancedPanel({ sunData, timezone, elevation, isLight, use24h, onToggle24h }) {
  const [open, setOpen] = useState(false);

  if (!sunData || !timezone) return null;

  const t = sunData.times;
  const fmt = (d) => formatTime(d, timezone, use24h);
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
          {/* Time format toggle */}
          <div className="flex justify-between items-center py-1">
            <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{LABELS.timeFormat}</span>
            <button
              onClick={onToggle24h}
              className={`text-[11px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                use24h
                  ? (isLight ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-amber-500/20 border-amber-400/40 text-amber-300')
                  : (isLight ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white/10 border-white/20 text-gray-300')
              }`}
            >
              {use24h ? LABELS.format24h : LABELS.format12h}
            </button>
          </div>

          {elevation != null && (
            <DataRow label={LABELS.elevation} value={`${elevation.toFixed(0)} m`} isLight={isLight} />
          )}

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
