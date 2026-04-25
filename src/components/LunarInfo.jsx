/**
 * @file Lunar information panel — phase, rise/set times, position.
 *
 * @module components/LunarInfo
 */

import { formatTimeCrossDay } from '../utils/timezone';
import { getMoonPhaseName } from '../utils/sunMoonCalc';
import { LABELS } from '../config';
import DataRow from './DataRow';
import MoonPhaseIcon from './MoonPhaseIcon';
import { useTheme } from '../hooks/useTheme';
import { useTimeFormat } from '../hooks/useTimeFormat';

/**
 * Render lunar data for the current date/location.
 *
 * @param {Object} props
 * @param {Object}  props.moonData - Result from `getMoonData()`.
 * @param {string}  props.timezone - IANA timezone string.
 * @param {boolean} props.isLight  - Light-theme flag.
 * @param {boolean} props.use24h   - 24-hour time format flag.
 */
export default function LunarInfo({ moonData }) {
  const { isLight } = useTheme();
  const { use24h, timezone } = useTimeFormat();
  if (!moonData || !timezone) return null;

  const t = moonData.times;
  const p = moonData.position;
  const il = moonData.illumination;
  const az = moonData.eventAzimuths;

  const riseStr = t.rise
    ? formatTimeCrossDay(t.rise, timezone, moonData.riseDay, use24h)
    : (t.alwaysUp ? LABELS.alwaysUp : t.alwaysDown ? LABELS.alwaysDown : 'N/A');
  const setStr = t.set
    ? formatTimeCrossDay(t.set, timezone, moonData.setDay, use24h)
    : (t.alwaysUp ? LABELS.alwaysUp : t.alwaysDown ? LABELS.alwaysDown : 'N/A');

  const riseAz = az?.moonrise != null ? ` (${Math.round(az.moonrise)}°)` : '';
  const setAz  = az?.moonset  != null ? ` (${Math.round(az.moonset)}°)`  : '';

  return (
    <div className="space-y-0.5">
      <h3 className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'} uppercase tracking-wider mb-1 flex items-center gap-1.5`}>
        <span className="text-base">{LABELS.lunarHeader}</span>
      </h3>

      {/* Phase */}
      <div className="flex items-center gap-2 py-1">
        <MoonPhaseIcon phase={il.phase} />
        <div>
          <div className={`text-xs ${isLight ? 'text-slate-800' : 'text-gray-200'}`}>{getMoonPhaseName(il.phase)}</div>
          <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{(il.fraction * 100).toFixed(1)}% {LABELS.illuminated}</div>
        </div>
      </div>

      <DataRow label={LABELS.moonrise} value={`${riseStr}${riseAz}`} color="text-slate-300" isLight={isLight} />
      <DataRow label={LABELS.moonset} value={`${setStr}${setAz}`} color="text-slate-300" isLight={isLight} />

      <div className={`border-t ${isLight ? 'border-slate-200' : 'border-white/5'} mt-2 pt-2`}>
        <DataRow label={LABELS.azimuth} value={`${Math.round(p.azimuth)}°`} isLight={isLight} />
        <DataRow label={LABELS.altitude} value={`${Math.round(p.altitude)}°`} isLight={isLight} />
      </div>
    </div>
  );
}
