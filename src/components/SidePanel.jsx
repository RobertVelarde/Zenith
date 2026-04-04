/**
 * @file Collapsible side panel containing all controls and data displays.
 *
 * On desktop it renders as a left-docked panel; on mobile it becomes a
 * bottom sheet that can be toggled.
 *
 * @module components/SidePanel
 */

import { useState } from 'react';
import SearchBar from './SearchBar';
import DateTimeControls from './DateTimeControls';
import SolarInfo from './SolarInfo';
import LunarInfo from './LunarInfo';
import AdvancedPanel from './AdvancedPanel';
import ExternalLinks from './ExternalLinks';
import LayerToggle from './LayerToggle';
import { LABELS } from '../config';

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
}) {
  const isLight = mapStyle === 'light';
  const glassClass = isLight ? 'glass-light' : 'glass';
  const textPrimary = isLight ? 'text-slate-900' : 'text-white';
  const borderColor = isLight ? 'border-slate-200' : 'border-white/5';

  const [use24h, setUse24h] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={onToggle}
        className={`md:hidden fixed top-4 left-4 z-40 ${glassClass} rounded-xl p-2 ${textPrimary}`}
        aria-label="Toggle panel"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Desktop: side panel / Mobile: bottom sheet */}
      <div
        className={`
          fixed z-30 transition-transform duration-300 ease-out
          md:top-0 md:left-0 md:h-full md:w-[340px]
          bottom-0 left-0 right-0 md:right-auto
          ${isOpen
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:-translate-x-full'}
        `}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-600 rounded-full" />
        </div>

        <div className={`h-full ${glassClass} md:rounded-none rounded-t-2xl flex flex-col overflow-hidden`}>
          {/* Header */}
          <div className={`px-4 pt-4 pb-2 border-b ${borderColor} shrink-0`}>
            <div className="flex items-center justify-between mb-3">
              <h1 className={`text-sm font-semibold ${textPrimary} tracking-wide`}>
                ☀️ {LABELS.appTitle}
              </h1>
              <LayerToggle current={mapStyle} onChange={onStyleChange} />
            </div>
            <SearchBar onSelect={(c) => onCoordsChange(c)} isLight={isLight} />
          </div>

          {/* Scrollable body */}
          <div className={`flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-4
                          max-h-[60vh] md:max-h-none ${isLight ? 'light-panel' : ''}`}>
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

            <div className={`border-t ${borderColor} pt-3 pb-2`}>
              <ExternalLinks coords={coords} isLight={isLight} />
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
