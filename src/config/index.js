/**
 * @file Centralized application configuration.
 *
 * Every magic number, color, label, and style constant lives here so the
 * entire UI can be themed or localized by editing a single file.
 */

// =============================================================================
// Mapbox Access Token
// SECURITY: Restrict this token in the Mapbox dashboard to these domains:
//   - localhost
//   - www.robertvelardejr.com
//   - robertvelardejr.com
//   - maps.robertvelardejr.com
// =============================================================================
// NOTE: Do NOT commit secret tokens. Provide the Mapbox token via Vite
// environment variable `VITE_MAPBOX_TOKEN` (see .env.example).
export const MAPBOX_TOKEN =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MAPBOX_TOKEN) ||
  (typeof process !== 'undefined' && process.env && process.env.MAPBOX_TOKEN) ||
  '';

// =============================================================================
// Map Configuration
// =============================================================================
export const MAP_STYLES = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

export const DEFAULT_COORDS = { lat: 40.7128, lng: -74.006 }; // New York City
export const DEFAULT_ZOOM = 13.000;
export const OVERLAY_RADIUS = 0.004; // degrees (~400 m) for sun/moon arcs

/** Overlay zoom slider bounds and step. */
export const OVERLAY_ZOOM = { min: 9, max: 17, step: 0.001 };

/** Map layer styles keyed by layer ID. */
export const MAP_LAYER_STYLES = {
  // Sun arc — above horizon
  sunArcAbove: { color: '#fbbf24', width: 3, opacity: 1 },
  // Sun arc — below horizon
  sunArcBelow: { color: '#92400e', width: 3, opacity: 1, dasharray: [4, 0] },

  // Sun direction lines
  sunriseLine:      { color: '#fb923c', width: 2, opacity: 1 },
  sunsetLine:       { color: '#f87171', width: 2, opacity: 1 },
  solarNoonLine:    { color: '#fde68a', width: 1.5, opacity: 1, dasharray: [3, 0] },
  sunCurrentLine:   { color: '#facc15', width: 2, opacity: 1 },
  sunCurrentBelow:  { color: '#b45309', width: 2, opacity: 1, dasharray: [4, 0] },

  // Sun point
  sunPoint:      { color: '#facc15', radius: 8, strokeWidth: 2, strokeColor: '#ffffff', opacity: 1 },
  sunPointBelow: { color: '#b45309', radius: 6, strokeWidth: 2, strokeColor: '#78350f', opacity: 1 },

  // Moon arc — above / below horizon
  moonArcAbove: { color: '#94a3b8', width: 3, opacity: 1 },
  moonArcBelow: { color: '#475569', width: 3, opacity: 1, dasharray: [4, 0] },

  // Moon direction lines
  moonDirLine:      { color: '#cbd5e1', width: 2, opacity: 1 },
  moonDirLineBelow: { color: '#64748b', width: 1.5, opacity: 1, dasharray: [4, 0] },
  moonriseLine:     { color: '#f87171', width: 2, opacity: 1 },
  moonsetLine:      { color: '#9C78B7', width: 2, opacity: 1 },
  moonCurrentLine:  { color: '#cbd5e1', width: 2, opacity: 1 },
  moonCurrentBelow: { color: '#64748b', width: 1.5, opacity: 1, dasharray: [4, 0] },

  // Moon point
  moonPoint:      { color: '#e2e8f0', radius: 8, strokeWidth: 2, strokeColor: '#64748b', opacity: 1 },
  moonPointBelow: { color: '#475569', radius: 6, strokeWidth: 1, strokeColor: '#334155', opacity: 1 },

  // Compass ticks and labels
  compassMajorTick: { color: '#e2e8f0', width: 3, opacity: 1 },
  compassMinorTick: { color: '#94a3b8', width: 2, opacity: 1 },
  compassLabel: { color: '#f8fafc', haloColor: '#0f172a', haloWidth: 1.5, opacity: 1 },
};

export const COMPASS_THEME_STYLES = {
  dark: {
    majorTick: { color: '#e2e8f0' },
    minorTick: { color: '#94a3b8' },
    label: { color: '#f8fafc', haloColor: '#0f172a' },
  },
  light: {
    majorTick: { color: '#0f172a' },
    minorTick: { color: '#334155' },
    label: { color: '#0f172a', haloColor: '#ffffff' },
  },
};

/** Marker color for the pin on the map. */
export const MARKER_COLOR = '#f59e0b';

// =============================================================================
// Twilight / Gradient colors
// =============================================================================

/** Day-night gradient colors for the time-of-day slider track. */
export const TWILIGHT_COLORS = {
  night:    '#0f172a',
  astro:    '#1e1b4b',
  nautical: '#312e81',
  civil:    '#c2410c',
  golden:   '#f59e0b',
  day:      '#38bdf8',
};

/** Yearly day-length gradient palette (anchored at 0 h / 12 h / 24 h). */
export const YEARLY_GRADIENT_PALETTE = {
  dark:   [15, 23, 42],    // #0f172a  — 0 h (polar night)
  mid:    [146, 64, 14],   // #92400e  — 12 h (equinox)
  bright: [251, 191, 36],  // #fbbf24  — 24 h (midnight sun)
};

// =============================================================================
// Glassmorphism / Visual parameters
// =============================================================================
export const GLASS = {
  darkBg:       'rgba(15, 23, 42, 0.78)',
  darkBorder:   'rgba(148, 163, 184, 0.18)',
  lightBg:      'rgba(255, 255, 255, 0.82)',
  lightBorder:  'rgba(203, 213, 225, 0.5)',
  blurAmount:   '20px',
  blurAmountLight: '24px',
  /** Fallback for browsers without backdrop-filter support. */
  fallbackDarkBg:  'rgba(15, 23, 42, 0.92)',
  fallbackLightBg: 'rgba(255, 255, 255, 0.94)',
};

export const SLIDER = {
  trackHeight: 14,      // px
  thumbSize:   20,      // px
  thumbColor:  '#f59e0b',
  thumbBorder: 'rgba(255, 255, 255, 0.9)',
  thumbGlow:   'rgba(245, 158, 11, 0.5)',
  trackBg:     'rgba(148, 163, 184, 0.2)',
};

export const TRANSITIONS = {
  panelSlide:     '300ms',
  panelEasing:    'ease-out',
  flyToDuration:  1200,      // ms — map flyTo on search/geolocation
  clickFlyTo:     600,       // ms — map flyTo on click
};

// =============================================================================
// Zenith Button Behavior
// =============================================================================
export const ZENITH = {
  /** How long (ms) the user must hold the Zenith button before geolocation
   *  is requested and the button turns gold. Adjust to taste. */
  holdDelay: 600,
};

// =============================================================================
// Layout Constants
// =============================================================================

/**
 * Panel and breakpoint dimensions — single source of truth for all layout
 * arithmetic in App.jsx, SidePanel.jsx, and useBottomSheet.js.
 *
 * Keep `--panel-width` in src/index.css :root in sync with `panelWidth`.
 */
export const LAYOUT = {
  panelWidth:       380,  // px — desktop side panel rendered width
  mobileBreakpoint: 768,  // px — Tailwind `md:` boundary
  mapPadding: {
    default:     24,      // px — standard map edge padding
  },
};

// =============================================================================
// API Configuration
// =============================================================================
export const API = {
  geocodingUrl:  'https://api.mapbox.com/geocoding/v5/mapbox.places',
  geocodingLimit: 5,
  timezoneUrl:   'https://timeapi.io/api/timezone/coordinate',
  /** Debounce delay in ms for geocoding search input. */
  searchDebounce: 300,
  /** Debounce delay in ms for coordinate/time updates. */
  coordDebounce:  150,
};

// =============================================================================
// UI Labels  (single source for future i18n / localization)
// =============================================================================
export const LABELS = {
  appTitle:      'Zenith',
  searchPlaceholder: 'Search location…',

  // Date / Time controls
  dateLabel:     'Date',
  yearlyLabel:   'Yearly',
  timeLabel:     'Time',
  dayPrefix:     'Day',

  // Solar section
  solarHeader:   'Solar',
  sunrise:       'Sunrise',
  goldenHourAM:  'Golden Hour AM',
  solarNoon:     'Solar Noon',
  goldenHourPM:  'Golden Hour PM',
  sunset:        'Sunset',
  dayLength:     'Day Length',
  azimuth:       'Azimuth',
  altitude:      'Altitude',

  // Lunar section
  lunarHeader:   'Lunar',
  moonrise:      'Moonrise',
  moonset:       'Moonset',
  alwaysUp:      'Always up',
  alwaysDown:    'Always down',
  illuminated:   'illuminated',

  // Advanced panel
  advancedHeader:   'Advanced',
  timeFormat:       'Time Format',
  format24h:        '24h',
  format12h:        '12h AM/PM',
  civilTwilight:    'Civil Twilight',
  nauticalTwilight: 'Nautical Twilight',
  astroTwilight:    'Astronomical Twilight',
  dawn:             'Dawn',
  dusk:             'Dusk',
  dayLengthHeader:  'Day Length',
  daylight:         'Daylight',
  night:            'Night',

  // External links
  copyLabel:     'Copy',
  copiedLabel:   '✓ Copied',
  googleMaps:    'Google Maps',
  weather:       'Windy.com',

  // Notifications
  geolocationDenied: 'Location access denied — using default coordinates.',
  timezoneFailed:    'Could not detect timezone — using UTC offset estimate.',
  geocodingFailed:   'Location search failed. Please try again.',
  mapLoadFailed:     'Map failed to load. Please refresh the page.',
  noData:            'Click the map to calculate…',
  timezoneLabel:     'Timezone',

  // Month abbreviations
  months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
};

export default {
  MAPBOX_TOKEN,
  MAP_STYLES,
  DEFAULT_COORDS,
  DEFAULT_ZOOM,
  OVERLAY_RADIUS,
  OVERLAY_ZOOM,
  MAP_LAYER_STYLES,
  COMPASS_THEME_STYLES,
  MARKER_COLOR,
  TWILIGHT_COLORS,
  YEARLY_GRADIENT_PALETTE,
  GLASS,
  SLIDER,
  TRANSITIONS,
  ZENITH,
  LAYOUT,
  API,
  LABELS,
};
