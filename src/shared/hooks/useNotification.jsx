/**
 * @file NotificationProvider component.
 *
 * Wraps the app root to make `useNotification()` available to all children.
 * The context and hook are defined in notificationContext.js to satisfy the
 * react-refresh/only-export-components lint rule.
 *
 * @module hooks/useNotification
 */

import { useState, useCallback, useRef } from 'react';
import { NotificationContext } from './notificationContext';
export { useNotification } from './notificationContext';

let nextId = 1;
const AUTO_DISMISS_MS = 5000;

/**
 * Provider component — wrap the app root so all children can call `useNotification()`.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback((message, level = 'info') => {
    const id = `notif-${nextId++}`;
    setNotifications((prev) => [...prev, { id, message, level }]);
    timers.current[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss }}>
      {children}
    </NotificationContext.Provider>
  );
}
