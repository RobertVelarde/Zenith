import { useEffect, useState } from 'react';
import { LABELS } from '../../config';

const HOLD_DELAY = 1000;
const FADE_DURATION = 300;

function StatusRow({ label, done }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 flex items-center justify-center">
        {done ? (
          <svg className="w-5 h-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879A1 1 0 003.293 9.293l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5 animate-spin text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M22 12a10 10 0 00-10-10" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="text-sm text-slate-200">{label}</div>
    </div>
  );
}

export default function LoadingScreen({ visible = true, statuses = {} }) {
  const [shouldRender, setShouldRender] = useState(visible);
  const [isActuallyVisible, setIsActuallyVisible] = useState(visible);

  useEffect(() => {
    let fadeTimeout;
    let unmountTimeout;

    if (!visible) {
      fadeTimeout = setTimeout(() => {
        setIsActuallyVisible(false);
        unmountTimeout = setTimeout(() => {
          setShouldRender(false);
        }, FADE_DURATION + 50);
      }, HOLD_DELAY);
    } else {
      setShouldRender(true);
      setIsActuallyVisible(true);
    }

    return () => {
      clearTimeout(fadeTimeout);
      clearTimeout(unmountTimeout);
    };
  }, [visible]);

  if (!shouldRender) return null;

  const { savedStateLoaded, coordsSet, mapIdle, overlaysReady, solarLoaded } = statuses;

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center transition-opacity duration-300 
        ${isActuallyVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        /* 1. DARK & TRANSPARENT FULLSCREEN BACKGROUND */
        bg-slate-950/80 backdrop-blur-md`}
      aria-hidden={!isActuallyVisible}
    >
      {/* 2. REMOVED CARD STYLING - Now just a layout container */}
      <div className="flex flex-col items-center gap-6 w-[min(400px,92%)] text-center text-white">
        
        {/* App Branding */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-3xl font-bold tracking-tight text-white drop-shadow-md">
            {LABELS.appTitle}
          </div>
        </div>

        {/* Status List - Subtle grouping */}
        <div className="w-full space-y-3 bg-white/5 p-6 rounded-2xl border border-white/10 shadow-2xl">
          <StatusRow label="Saved state loaded" done={!!savedStateLoaded} />
          <StatusRow label="Coordinates initialized" done={!!coordsSet} />
          <StatusRow label="Map ready / zoomed" done={!!mapIdle} />
          <StatusRow label="Overlays drawn" done={!!overlaysReady} />
          <StatusRow label="Solar & lunar data" done={!!solarLoaded} />
        </div>

        {/* Footer Loader */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            {visible ? 'Initializing System' : 'System Ready'}
          </div>
          <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 
                ${visible 
                  ? 'w-1/2 bg-cyan-500 animate-[loading_1.5s_infinite_ease-in-out]' 
                  : 'w-full bg-green-400'
                }`} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}