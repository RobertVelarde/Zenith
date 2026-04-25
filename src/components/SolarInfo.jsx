/**
 * @file Solar information panel displaying sun event times and position.
 *
 * @module components/SolarInfo
 */

import { formatDuration } from '../shared/utils/timezone';
import { LABELS } from '../config';
import DataRow from './DataRow';
import { useTheme } from '../hooks/useTheme';
import { useTimeFormat } from '../hooks/useTimeFormat';

/**
 * Render a summary of solar events (sunrise, sunset, golden hours, etc.)
 * and the current sun position for the selected date/location.
 *
 * @param {Object} props
 * @param {Object}  props.sunData  - Result from `getSunData()`.
 * @param {string}  props.timezone - IANA timezone string.
 * @param {boolean} props.isLight  - Light-theme flag.
 * @param {boolean} props.use24h   - 24-hour time format flag.
 */
export default function SolarInfo({ sunData }) {
  const { isLight } = useTheme();
  const { fmt } = useTimeFormat();
  if (!sunData) {
    return <div className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{LABELS.noData}</div>;
  }

  const t = sunData.times;
  const p = sunData.position;
  const az = sunData.eventAzimuths;
  const dayLength =
    t.sunset && t.sunrise && !isNaN(t.sunset.getTime()) && !isNaN(t.sunrise.getTime())
      ? t.sunset - t.sunrise
      : null;

  const srAz = az?.sunrise != null ? ` (${Math.round(az.sunrise)}°)` : '';
  const ssAz = az?.sunset  != null ? ` (${Math.round(az.sunset)}°)`  : '';

  return (
    <div className="space-y-0.5">
      <h3 className={`text-xs font-semibold ${isLight ? 'text-amber-600' : 'text-amber-400'} uppercase tracking-wider mb-1 flex items-center gap-1.5`}>
        <span className="text-base">{LABELS.solarHeader}</span> 
      </h3>
      <DataRow label={LABELS.sunrise} value={`${fmt(t.sunrise)}${srAz}`} color="text-orange-300" isLight={isLight} />
      <DataRow label={LABELS.goldenHourAM} value={fmt(t.goldenHourEnd)} color="text-amber-200" isLight={isLight} />
      <DataRow label={LABELS.solarNoon} value={fmt(t.solarNoon)} color="text-yellow-200" isLight={isLight} />
      <DataRow label={LABELS.goldenHourPM} value={fmt(t.goldenHour)} color="text-amber-200" isLight={isLight} />
      <DataRow label={LABELS.sunset} value={`${fmt(t.sunset)}${ssAz}`} color="text-red-300" isLight={isLight} />
      <DataRow label={LABELS.dayLength} value={dayLength ? formatDuration(dayLength) : '--'} isLight={isLight} />

      <div className={`border-t ${isLight ? 'border-slate-200' : 'border-white/5'} mt-2 pt-2`}>
        <DataRow label={LABELS.azimuth} value={`${Math.round(p.azimuth)}°`} isLight={isLight} />
        <DataRow label={LABELS.altitude} value={`${Math.round(p.altitude)}°`} isLight={isLight} />
      </div>
    </div>
  );
}
