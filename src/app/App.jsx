/**
 * @file Application root bootstrap.
 */
import { NotificationProvider } from '../shared/hooks/useNotification';
import AppProvider from './AppContext';

export default function App() {
  return (
    <NotificationProvider>
      <AppProvider />
    </NotificationProvider>
  );
}
