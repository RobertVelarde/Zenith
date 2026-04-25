/**
 * @file ThemeContext — centralizes dark/light/satellite theme state.
 *
 * ThemeProvider derives `isDark` and `isSatellite` synchronously from the
 * `mapStyle` prop (owned by App), eliminating the one-render desync that
 * existed when SidePanel had to sync local state from the prop via useEffect.
 *
 * @module hooks/useTheme
 */

import { createContext, useContext, useMemo, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

/**
 * Provides derived theme values to the component tree.
 *
 * @param {Object}   props
 * @param {string}   props.mapStyle      - 'dark' | 'light' | 'satellite'
 * @param {Function} props.onStyleChange - Setter for mapStyle (owned by App).
 * @param {React.ReactNode} props.children
 */
export function ThemeProvider({ mapStyle, onStyleChange, children }) {
  const isDark      = mapStyle !== 'light';
  const isSatellite = mapStyle === 'satellite';
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
    if (!isSatellite) onStyleChange(next ? 'dark' : 'light');
  }, [isSatellite, onStyleChange]);

  const setIsSatellite = useCallback((next) => {
    onStyleChange(next ? 'satellite' : isDark ? 'dark' : 'light');
  }, [isDark, onStyleChange]);

  const value = useMemo(() => ({
    isDark, isLight, isSatellite, glassClass, textPrimary, borderColor,
    setIsDark, setIsSatellite,
  }), [isDark, isLight, isSatellite, glassClass, textPrimary, borderColor, setIsDark, setIsSatellite]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
