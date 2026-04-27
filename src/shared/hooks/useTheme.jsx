/**
 * @file ThemeContext — centralizes dark/light/satellite theme state.
 *
 * ThemeProvider derives theme flags from separate base-theme and satellite
 * props so the settings remain independent.
 *
 * @module hooks/useTheme
 */

import { createContext, useContext, useMemo, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

/**
 * Provides derived theme values to the component tree.
 *
 * @param {Object}   props
 * @param {string}   props.baseMapStyle      - 'dark' | 'light'
 * @param {boolean}  props.satelliteEnabled  - Whether satellite mode is active
 * @param {Function} props.onBaseStyleChange - Setter for the base theme
 * @param {Function} props.onSatelliteChange - Setter for satellite mode
 * @param {React.ReactNode} props.children
 */
export function ThemeProvider({
  baseMapStyle,
  satelliteEnabled,
  onBaseStyleChange,
  onSatelliteChange,
  children,
}) {
  const isDark      = baseMapStyle !== 'light';
  const isSatellite = satelliteEnabled;
  const isLight     = !isDark;
  const glassClass  = isLight ? 'glass-light' : 'glass';
  const textPrimary = isLight ? 'text-slate-900' : 'text-white';
  const borderColor = isLight ? 'border-slate-200' : 'border-white/5';

  // Mirror the active theme onto the root element so global CSS selectors
  // (e.g. scrollbar overrides) can target the current theme without prop drilling.
  useEffect(() => {
    document.documentElement.dataset.uiTheme = isLight ? 'light' : 'dark';
  }, [isLight]);

  const setIsDark = useCallback((next) => {
    onBaseStyleChange(next ? 'dark' : 'light');
  }, [onBaseStyleChange]);

  const setIsSatellite = useCallback((next) => {
    onSatelliteChange(next);
  }, [onSatelliteChange]);

  const value = useMemo(() => ({
    isDark, isLight, isSatellite, glassClass, textPrimary, borderColor,
    setIsDark, setIsSatellite,
  }), [isDark, isLight, isSatellite, glassClass, textPrimary, borderColor, setIsDark, setIsSatellite]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
