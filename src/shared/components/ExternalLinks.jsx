/**
 * @file Coordinate display, clipboard copy, and external map/weather links.
 *
 * @module components/ExternalLinks
 */

import { useState } from 'react';
import { LABELS } from '../../config';
import { useTheme } from '../hooks/useTheme';

export default function ExternalLinks({ coords }) {
  const { isLight } = useTheme();
  const [copied, setCopied] = useState(false);
  const { lat, lng } = coords;

  const googleUrl = `https://www.google.com/maps/@${lat},${lng},15z`;
  const windyUrl = `https://www.windy.com/${lat}/${lng}`;
  const coordStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coordStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard API not available */ }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{coordStr}</span>
        <button
          onClick={copy}
          className={`text-[10px] ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-gray-400 hover:text-white'} transition-colors px-2 py-0.5 rounded-md hover:bg-white/5`}
        >
          {copied ? LABELS.copiedLabel : LABELS.copyLabel}
        </button>
      </div>

      <div className="flex gap-2">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex-1 text-center text-[10px] ${isLight ? 'text-slate-600 hover:text-slate-900 glass-light' : 'text-gray-300 hover:text-white glass'} rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors`}
        >
          {LABELS.googleMaps}
        </a>
        <a
          href={windyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex-1 text-center text-[10px] ${isLight ? 'text-slate-600 hover:text-slate-900 glass-light' : 'text-gray-300 hover:text-white glass'} rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors`}
        >
          {LABELS.weather}
        </a>
      </div>
    </div>
  );
}
