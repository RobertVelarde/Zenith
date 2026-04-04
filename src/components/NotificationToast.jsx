/**
 * @file Toast notification overlay.
 *
 * Renders a stack of auto-dismissing notification messages anchored to the
 * bottom-right of the viewport.  Replaces silent catch blocks with visible
 * user feedback.
 *
 * @module components/NotificationToast
 */

import { useNotification } from '../hooks/notificationContext';

const LEVEL_STYLES = {
  info:  'bg-slate-800 border-slate-600 text-slate-200',
  warn:  'bg-amber-900/90 border-amber-600 text-amber-100',
  error: 'bg-red-900/90 border-red-500 text-red-100',
};

/**
 * Floating toast container.  Place once in the component tree (e.g. App root).
 */
export default function NotificationToast() {
  const { notifications, dismiss } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((n) => (
        <div
          key={n.id}
          role="alert"
          className={`flex items-start gap-2 px-4 py-3 rounded-xl border backdrop-blur-lg text-sm shadow-lg animate-in fade-in slide-in-from-right ${LEVEL_STYLES[n.level] || LEVEL_STYLES.info}`}
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
      ))}
    </div>
  );
}
