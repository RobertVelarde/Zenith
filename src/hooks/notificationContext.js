/**
 * @file Notification context and consumer hook (no JSX).
 *
 * The context is created here and shared with the Provider component
 * in useNotification.jsx.  This separation satisfies the
 * react-refresh/only-export-components rule.
 *
 * @module hooks/notificationContext
 */

import { createContext, useContext } from 'react';

export const NotificationContext = createContext(null);

/**
 * Hook to access the notification system.
 *
 * @returns {{ notifications: Array, notify: Function, dismiss: Function }}
 */
export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within <NotificationProvider>');
  return ctx;
}
