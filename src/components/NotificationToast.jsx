/**
 * @file Toast notification overlay.
 *
 * Renders a stack of auto-dismissing notification messages anchored to the
 * bottom-right of the viewport.  Replaces silent catch blocks with visible
 * user feedback.
 *
 * @module components/NotificationToast
 */

import { useEffect, useState } from 'react';
import { useNotification } from '../hooks/notificationContext';

const LEVEL_STYLES = {
  info:  {
    dark:  'bg-slate-800 border-slate-600 text-slate-200',
    light: 'bg-white border-slate-300 text-slate-800',
  },
  warn:  {
    dark:  'bg-amber-900/90 border-amber-600 text-amber-100',
    light: 'bg-amber-50 border-amber-400 text-amber-900',
  },
  error: {
    dark:  'bg-red-900/90 border-red-500 text-red-100',
    light: 'bg-red-50 border-red-400 text-red-900',
  },
};

function useUiTheme() {
  const [isLight, setIsLight] = useState(
    () => document.documentElement.dataset.uiTheme === 'light',
  );
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsLight(document.documentElement.dataset.uiTheme === 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ui-theme'] });
    return () => obs.disconnect();
  }, []);
  return isLight;
}

/**
 * Floating toast container.  Place once in the component tree (e.g. App root).
 */
export default function NotificationToast() {
  const { notifications, dismiss } = useNotification();
  const isLight = useUiTheme();
  const theme = isLight ? 'light' : 'dark';

  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed right-4 top-4 z-50 flex flex-col gap-2 max-w-sm"
      style={{ bottom: 'calc(var(--panel-bar-h, 0px) + 1rem)' }}
    >
      {notifications.map((n) => {
        const levelKey = LEVEL_STYLES[n.level] ? n.level : 'info';
        return (
          <div
            key={n.id}
            role="alert"
            className={`flex items-start gap-2 px-4 py-3 rounded-xl border backdrop-blur-lg text-sm shadow-lg animate-in fade-in slide-in-from-right ${LEVEL_STYLES[levelKey][theme]}`}
          >
            <span className="flex-1">{n.message}</span>
            <button
              onClick={() => dismiss(n.id)}
              className="opacity-60 hover:opacity-100 transition-opacity text-xs ml-2 shrink-0"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
