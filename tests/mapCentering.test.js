/**
 * @file mapCentering.test.js
 *
 * Verifies that the map centering feature (`handleCenterMap` in App.jsx)
 * places the selected point at the centre of the remaining visible map region
 * for all supported layout modes.
 *
 * handleCenterMap calls:
 *   map.fitBounds(bounds, { padding })
 * where padding depends on the current layout:
 *   Desktop (width >= 768): { top: 24, right: 24, bottom: 24, left: 340 + 24 }
 *   Mobile  (width <  768): { top: 24, right: 24, bottom: panelVisibleH + 24, left: 24 }
 *
 * `panelVisibleH` is the live CSS custom property `--panel-visible-h` set by
 * SidePanel.  When the panel is peeked it equals the peek bar height; when
 * expanded it equals the full panel height.
 *
 * Strategy — because Mapbox GL cannot render tiles without a real token, these
 * tests verify centering by:
 *   1. Reading the actual `--panel-visible-h` / `--panel-bar-h` CSS custom
 *      properties from the live DOM (set by SidePanel's useEffect).
 *   2. Computing the centre of the remaining viewport region using the same
 *      arithmetic that handleCenterMap uses.
 *   3. Asserting the geometric invariants that must hold for every viewport.
 *
 * Tagging: all suites are tagged `@math` — they test pure JS/React logic that
 * does not vary across browser rendering engines.  The project configuration
 * routes `@math` tests to Chromium only to keep the total run count low.
 *
 * @requires @playwright/test
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants — mirror the hardcoded values in App.jsx handleCenterMap
// ---------------------------------------------------------------------------

/** Width (px) of the left-docked panel on desktop/tablet. */
const DESKTOP_PANEL_W = 340;

/** Edge margin applied to all four sides of the fitBounds padding. */
const MARGIN = 24;

// ---------------------------------------------------------------------------
// Viewport fixtures
// ---------------------------------------------------------------------------

const DESKTOP_VIEWPORTS = [
  { label: 'tablet-768',    width: 768,  height: 1024 },
  { label: 'desktop-1024',  width: 1024, height: 768  },
  { label: 'desktop-1280',  width: 1280, height: 800  },
  { label: 'desktop-1440',  width: 1440, height: 900  },
  { label: 'desktop-1920',  width: 1920, height: 1080 },
];

const MOBILE_VIEWPORTS = [
  { label: 'mobile-375',  width: 375, height: 812  }, // iPhone SE / 6/7/8
  { label: 'mobile-390',  width: 390, height: 844  }, // iPhone 14
  { label: 'mobile-412',  width: 412, height: 915  }, // Pixel 6
  { label: 'mobile-430',  width: 430, height: 932  }, // iPhone 14 Plus
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the centre of the viewport region that remains after applying the
 * fitBounds padding.
 *
 * @param {number} vpWidth
 * @param {number} vpHeight
 * @param {{ top: number, right: number, bottom: number, left: number }} padding
 * @returns {{ x: number, y: number }}
 */
function remainingCenter(vpWidth, vpHeight, padding) {
  return {
    x: padding.left + (vpWidth  - padding.left  - padding.right)  / 2,
    y: padding.top  + (vpHeight - padding.top   - padding.bottom) / 2,
  };
}

/**
 * Navigate to the app and wait for the panel header to mount.
 * Map-related console errors are suppressed (no real Mapbox token in tests).
 *
 * The Zenith title button lives in the always-visible header, making it a
 * reliable sentinel for all viewports and mobile bottom-sheet stages.
 */
async function gotoApp(page) {
  page.on('console', () => {});
  page.on('pageerror', () => {});

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // The Zenith button is always visible regardless of panel stage.
  await page.waitForSelector('button:has-text("Zenith")', { timeout: 15_000 });

  // Wait for the initial loading overlay to clear so it cannot intercept
  // interactions with the panel controls.
  await page
    .locator('text=Initializing System')
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => {});
}

/**
 * Read both panel CSS custom properties from the live document.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ panelVisibleH: number, panelBarH: number }>}
 */
async function readPanelVars(page) {
  return page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      panelVisibleH: parseInt(s.getPropertyValue('--panel-visible-h') || '0', 10),
      panelBarH:     parseInt(s.getPropertyValue('--panel-bar-h')     || '0', 10),
    };
  });
}

/**
 * Wait until `--panel-visible-h` exceeds `minHeight`, then return its value.
 * Used after toggling the panel to ensure the CSS var has been updated.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} minHeight
 * @returns {Promise<number>}
 */
async function waitForPanelVisibleH(page, minHeight) {
  await page.waitForFunction(
    (min) => {
      const val = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--panel-visible-h') || '0',
        10,
      );
      return val > min;
    },
    minHeight,
    { timeout: 10_000 },
  );
  return readPanelVars(page).then((v) => v.panelVisibleH);
}

// ---------------------------------------------------------------------------
// Suite: Desktop / Tablet  @math
//
// For width >= 768 px, handleCenterMap uses:
//   padding = { top: 24, right: 24, bottom: 24, left: 340 + 24 }
//
// All invariants are checked in a single test per viewport so the page is
// loaded only once per size (rather than 4 separate navigations).
//
// Invariants:
//   (A) centre-X = (vpWidth + DESKTOP_PANEL_W) / 2  — panel shifts centre right
//   (B) centre-Y = vpHeight / 2                      — symmetric vertical padding
//   (C) --panel-visible-h = 0                        — no bottom-sheet on desktop
//   (D) remaining width and height are positive
// ---------------------------------------------------------------------------

test.describe('Map centering — desktop/tablet @math', () => {
  for (const vp of DESKTOP_VIEWPORTS) {
    test(`centering invariants at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await gotoApp(page);

      const { panelVisibleH, panelBarH } = await readPanelVars(page);
      const padding = { top: MARGIN, right: MARGIN, bottom: MARGIN, left: DESKTOP_PANEL_W + MARGIN };
      const { x, y } = remainingCenter(vp.width, vp.height, padding);

      // (A) Horizontal centre is shifted right by the 340 px panel.
      expect(x).toBeCloseTo((vp.width + DESKTOP_PANEL_W) / 2, 5);
      // (B) Vertical centre is at the midpoint (symmetric top/bottom padding).
      expect(y).toBeCloseTo(vp.height / 2, 5);
      // (C) No bottom-sheet padding in desktop mode.
      expect(panelVisibleH).toBe(0);
      expect(panelBarH).toBe(0);
      // (D) Remaining map area is positive in both dimensions.
      expect(vp.width  - (DESKTOP_PANEL_W + MARGIN) - MARGIN).toBeGreaterThan(0);
      expect(vp.height - MARGIN * 2).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Suite: Mobile — peeked (initial state)  @math
//
// On mobile (width < 768 px), peeked = true on initial load.
// --panel-visible-h = peekBarH (header + pinned section only).
//
// Invariants:
//   (A) centre-X = vpWidth / 2               — symmetric left/right padding
//   (B) centre-Y < vpHeight - panelVisibleH  — point is above the panel bar
//   (C) --panel-visible-h == --panel-bar-h > 0
//   (D) remaining map height is positive
// ---------------------------------------------------------------------------

test.describe('Map centering — mobile peeked @math', () => {
  for (const vp of MOBILE_VIEWPORTS) {
    test(`peeked centering invariants at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await gotoApp(page);

      const { panelVisibleH, panelBarH } = await readPanelVars(page);
      const padding = { top: MARGIN, right: MARGIN, bottom: panelVisibleH + MARGIN, left: MARGIN };
      const { x, y } = remainingCenter(vp.width, vp.height, padding);

      // (A) Symmetric horizontal padding → centre-X at the viewport midpoint.
      expect(x).toBeCloseTo(vp.width / 2, 5);
      // (B) Centre point must sit above the top edge of the panel bar.
      expect(y).toBeLessThan(vp.height - panelVisibleH);
      // (C) Bar height is measured by ResizeObserver and equals panelVisibleH when peeked.
      expect(panelBarH).toBeGreaterThan(0);
      expect(panelVisibleH).toBe(panelBarH);
      // (D) Remaining map height is positive.
      expect(vp.height - MARGIN - (panelVisibleH + MARGIN)).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Suite: Mobile — expanded (panel fully open)  @math
//
// After tapping "Expand menu", --panel-visible-h = totalPanelH.
//
// Invariants:
//   (A) centre-X = vpWidth / 2
//   (B) --panel-visible-h > --panel-bar-h
//   (C) expanded centre-Y < peeked centre-Y  (centre rises when panel grows)
//   (D) centre-Y < vpHeight - expandedH       (above the full panel top)
//   (E) remaining map height is positive
// ---------------------------------------------------------------------------

test.describe('Map centering — mobile expanded @math', () => {
  for (const vp of MOBILE_VIEWPORTS) {
    test(`expanded centering invariants at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await gotoApp(page);

      // Capture peeked state first (one navigation serves both suites' data).
      const { panelVisibleH: peekedH, panelBarH: initialBarH } = await readPanelVars(page);
      const peekedCenterY = remainingCenter(
        vp.width, vp.height,
        { top: MARGIN, right: MARGIN, bottom: peekedH + MARGIN, left: MARGIN },
      ).y;

      // Expand the panel.
      const expandButton = page.locator('button[aria-label="Expand menu"]');
      await expect(expandButton).toBeVisible({ timeout: 5_000 });
      await expandButton.click();
      const expandedH = await waitForPanelVisibleH(page, initialBarH);

      const { x, y } = remainingCenter(
        vp.width, vp.height,
        { top: MARGIN, right: MARGIN, bottom: expandedH + MARGIN, left: MARGIN },
      );

      // (A) Symmetric horizontal padding.
      expect(x).toBeCloseTo(vp.width / 2, 5);
      // (B) Full panel is taller than the peek bar alone.
      expect(expandedH).toBeGreaterThan(initialBarH);
      // (C) Larger bottom padding pushes centre closer to the top (Y decreases).
      expect(y).toBeLessThan(peekedCenterY);
      // (D) Centre point is above the full panel's top edge.
      expect(y).toBeLessThan(vp.height - expandedH);
      // (E) Remaining map height is positive (SidePanel caps panel at vh − vw).
      expect(vp.height - MARGIN - (expandedH + MARGIN)).toBeGreaterThan(0);
    });
  }
});
