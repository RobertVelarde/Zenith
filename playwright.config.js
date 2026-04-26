import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Zenith UI tests.
 *
 * The dev server is started automatically before any test run; set
 * VITE_MAPBOX_TOKEN (or provide .env.local) so Vite does not abort on launch.
 * Slider-alignment tests do not need a real token — they only interact with
 * the controls panel, not the map tiles.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      // Runs the full suite, including @math tests (pure JS/CSS-var geometry checks).
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // CSS rendering and WebKit pseudo-element tests only — skip browser-agnostic math.
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      grepInvert: /@math/,
    },
    {
      // CSS rendering and WebKit pseudo-element tests only — skip browser-agnostic math.
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      grepInvert: /@math/,
    },
    {
      // Mobile CSS and touch hit-target tests — skip browser-agnostic math.
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      grepInvert: /@math/,
    },
    {
      // Mobile CSS and touch hit-target tests — skip browser-agnostic math.
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      grepInvert: /@math/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Allow Vite to start even without a real Mapbox token in CI.
      VITE_MAPBOX_TOKEN: process.env.VITE_MAPBOX_TOKEN ?? 'pk.test_placeholder',
    },
  },
});
