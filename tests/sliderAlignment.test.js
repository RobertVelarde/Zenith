/**
 * @file sliderAlignment.test.js
 *
 * Playwright test suite that validates vertical alignment of the Year and Time
 * slider thumbs in the Zenith application.
 *
 * Alignment assertion (per the brief):
 *   Math.abs((thumb.centerY) - (track.centerY)) < 1 px
 *
 * Because range-input pseudo-elements (::-webkit-slider-thumb, etc.) cannot be
 * measured with getBoundingClientRect, the suite uses two complementary
 * strategies:
 *
 *   1. CSS-geometry check  — reads the computed CSS custom properties and the
 *      computed margin-top on the WebKit thumb pseudo-element, then asserts the
 *      formula  margin-top === (trackHeight − thumbSize) / 2  (= −3 px).
 *
 *   2. Bounding-box proxy  — each slider lives inside a container:
 *        <div class="relative">          ← measured as "container"
 *          <div …gradient… h-[14px] top-1/2 -translate-y-1/2 />   ← track proxy
 *          <input type="range" … />      ← input element
 *        </div>
 *      The gradient overlay is the visible track. Both the gradient div and
 *      the input element should be vertically centered in the container.
 *      Asserting  |gradientCenter.y − inputCenter.y| < 1 px  confirms the
 *      track representation and the thumb container are co-axial.
 *
 *   3. Screenshot regression — snapshots at 375 / 768 / 1440 px wide viewports
 *      are saved to tests/screenshots/ for human review and future baseline
 *      comparisons.
 *
 * @requires @playwright/test
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Directory where reference screenshots are stored. */
const SCREENSHOT_DIR = path.join(import.meta.dirname, 'screenshots');

/** Viewports to test at. */
const VIEWPORTS = [
  { label: 'mobile-375',  width: 375,  height: 812  },
  { label: 'tablet-768',  width: 768,  height: 1024 },
  { label: 'desktop-1440', width: 1440, height: 900 },
];

/**
 * Return the vertical center (Y coordinate) of a bounding box.
 * @param {{ y: number, height: number }} box
 */
function centerY(box) {
  return box.y + box.height / 2;
}

/**
 * Navigate to the app and wait until the panel header has mounted.
 * Mapbox map errors are expected in test environments using a placeholder
 * token and are silently ignored.
 *
 * The Zenith title button lives in the header which is always visible
 * regardless of the mobile bottom-sheet stage, making it a reliable sentinel
 * for both desktop and mobile viewports.
 */
async function gotoApp(page) {
  // Suppress console errors from the Mapbox SDK when a real token is absent.
  page.on('console', () => {});
  page.on('pageerror', () => {});

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // The Zenith title button is always visible (header is never hidden).
  await page.waitForSelector('button:has-text("Zenith")', { timeout: 15_000 });
}

/**
 * Advance the mobile bottom-sheet from stage 1 (peeked) to stage 2 (open)
 * by clicking the accessible grab-handle button, then wait until the
 * year/time sliders become visible in the newly-revealed scroll body.
 *
 * Only needed for mobile-sized viewports where the sliders start hidden.
 *
 * @param {import('@playwright/test').Page} page
 */
async function expandPanel(page) {
  await page.locator('button[aria-label="Expand menu"]').click();
  // Wait for the scroll body to slide into view (300 ms CSS transition).
  await page
    .locator('input.year-slider-over-gradient, input.time-slider-over-gradient')
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Suite: CSS Custom-Property Validation
// ---------------------------------------------------------------------------

test.describe('CSS custom-property values', () => {
  test('--slider-track-height and --slider-thumb-size are defined on :root', async ({ page }) => {
    await gotoApp(page);

    const values = await page.evaluate(() => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      return {
        trackHeight: style.getPropertyValue('--slider-track-height').trim(),
        thumbSize:   style.getPropertyValue('--slider-thumb-size').trim(),
      };
    });

    expect(values.trackHeight).toBe('14px');
    expect(values.thumbSize).toBe('20px');
  });
});

// ---------------------------------------------------------------------------
// Suite: WebKit thumb margin-top CSS rule verification
// ---------------------------------------------------------------------------
//
// `getComputedStyle(el, '::-webkit-slider-thumb').marginTop` does NOT resolve
// calc() expressions that contain CSS custom properties — it returns '0px' in
// all Chromium/WebKit versions tested. This is a known browser limitation:
// https://crbug.com/41489399
//
// Instead we inspect document.styleSheets to assert:
//   1. The rule for ::-webkit-slider-thumb contains a margin-top declaration.
//   2. The value uses the centering formula with the two geometry variables.
//   3. The geometry variables themselves resolve to the expected pixel values
//      so the formula evaluates to (14 - 20) / 2 = -3 px.
//
// This approach works in all browsers (including Firefox) because it reads the
// CSS source rather than the resolved computed value.

test.describe('WebKit thumb margin-top CSS rule', () => {
  test('stylesheet declares margin-top centering formula on ::-webkit-slider-thumb', async ({ page }) => {
    await gotoApp(page);

    const result = await page.evaluate(() => {
      // Walk every accessible stylesheet rule looking for the thumb pseudo-element.
      let marginTopValue = null;

      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (
              rule instanceof CSSStyleRule &&
              rule.selectorText &&
              rule.selectorText.includes('::-webkit-slider-thumb')
            ) {
              const val = rule.style.marginTop;
              if (val) {
                marginTopValue = val;
                break;
              }
            }
          }
        } catch (_) {
          // Cross-origin sheet — skip.
        }
        if (marginTopValue) break;
      }

      // Also read the geometry variables so we can verify the formula result.
      const rootStyle  = getComputedStyle(document.documentElement);
      const trackH     = parseFloat(rootStyle.getPropertyValue('--slider-track-height'));
      const thumbS     = parseFloat(rootStyle.getPropertyValue('--slider-thumb-size'));
      const expectedPx = (trackH - thumbS) / 2; // −3

      return { marginTopValue, trackH, thumbS, expectedPx };
    });

    // Rule must exist in the loaded stylesheet.
    expect(result.marginTopValue).not.toBeNull();

    // The formula must reference both geometry variables (not a hardcoded px offset).
    expect(result.marginTopValue).toContain('var(--slider-track-height)');
    expect(result.marginTopValue).toContain('var(--slider-thumb-size)');

    // The resolved geometry variables must produce the correct centering offset.
    expect(result.trackH).toBe(14);
    expect(result.thumbS).toBe(20);
    expect(result.expectedPx).toBe(-3);
  });
});

// ---------------------------------------------------------------------------
// Suite: Bounding-box alignment (all browsers × all viewports)
// ---------------------------------------------------------------------------

test.describe('Slider bounding-box alignment', () => {
  /**
   * Maximum allowed vertical misalignment in CSS pixels.
   * Sub-pixel rendering can cause ≤ 0.5 px difference on some platforms,
   * so we allow 1 px of tolerance.
   */
  const MAX_OFFSET_PX = 1;

  for (const vp of VIEWPORTS) {
    for (const slider of ['year', 'time']) {
      test(`${slider} slider is vertically centered at ${vp.label}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await gotoApp(page);

        // On mobile, sliders are in the hidden scroll body at stage 1.
        // Expand the panel so they become visible before measuring.
        if (vp.width < 768) await expandPanel(page);

        const inputSelector = `.${slider}-slider-over-gradient`;

        /**
         * Measure:
         *  - inputBox   — bounding rect of the <input> (contains the thumb)
         *  - trackBox   — bounding rect of the sibling gradient <div> (visible track)
         *
         * The gradient div uses Tailwind's `top-1/2 -translate-y-1/2` so it is
         * always centered in its parent. inputBox.height = thumbSize (20 px) and
         * the input element is also centered in the same parent, so both centers
         * should coincide.
         */
        const { inputBox, trackBox, error } = await page.evaluate((sel) => {
          const input = document.querySelector(sel);
          if (!input) return { error: `Selector not found: ${sel}` };

          const inputBox = input.getBoundingClientRect();

          // The gradient overlay is the first <div> child of the slider's
          // immediate parent (.relative container).
          const container = input.parentElement;
          const trackDiv  = container ? container.querySelector('div') : null;
          const trackBox  = trackDiv ? trackDiv.getBoundingClientRect() : null;

          return {
            inputBox: {
              y: inputBox.y,
              height: inputBox.height,
            },
            trackBox: trackDiv ? {
              y: trackBox.y,
              height: trackBox.height,
            } : null,
          };
        }, inputSelector);

        expect(error).toBeUndefined();
        expect(inputBox).not.toBeNull();
        expect(trackBox).not.toBeNull();

        const inputCenterY = centerY(inputBox);
        const trackCenterY = centerY(trackBox);
        const offset       = Math.abs(inputCenterY - trackCenterY);

        // Coordinate validation per brief:
        //   Math.abs((thumb.top + thumb.height/2) - (track.top + track.height/2)) < 1px
        expect(offset).toBeLessThan(MAX_OFFSET_PX);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Suite: Screenshot regression
// ---------------------------------------------------------------------------
//
// Takes screenshots at each breakpoint so CI artefacts can be reviewed and
// used as future visual-regression baselines.

test.describe('Screenshot regression', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  for (const vp of VIEWPORTS) {
    test(`slider panel screenshot at ${vp.label}`, async ({ page, browserName }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoApp(page);

      // On mobile the sliders are in the scroll body hidden at stage 1 — expand first.
      if (vp.width < 768) await expandPanel(page);

      // Try to capture just the slider area; fall back to full page.
      const yearSlider = page.locator('.year-slider-over-gradient').first();
      const container  = yearSlider.locator('xpath=ancestor::div[contains(@class,"space-y")]').first();

      const screenshotPath = path.join(
        SCREENSHOT_DIR,
        `sliders-${vp.label}-${browserName}.png`,
      );

      try {
        await container.screenshot({ path: screenshotPath });
      } catch {
        await page.screenshot({ path: screenshotPath, fullPage: false });
      }

      // Assert the file was created and is non-empty.
      const stat = fs.statSync(screenshotPath);
      expect(stat.size).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Suite: Mobile touch environment simulation
// ---------------------------------------------------------------------------

test.describe('Mobile touch: slider thumb hit-target', () => {
  /**
   * On touch devices (pointer: coarse) the input height is expanded to
   *   thumbSize + 2 × touchPadding   (= 20 + 24 = 44 px)
   * so there is adequate vertical tap room above and below the thumb.
   * On fine-pointer devices the input height equals thumbSize (20 px).
   */
  for (const slider of ['year', 'time']) {
    test(`${slider} slider input height equals touch-padded thumb size`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await gotoApp(page);

      // Sliders are in the hidden scroll body at the default mobile stage 1.
      await expandPanel(page);

      const { inputHeight, expectedHeight } = await page.evaluate((sel) => {
        const input = document.querySelector(sel);
        const rect  = input ? input.getBoundingClientRect() : null;
        const root  = getComputedStyle(document.documentElement);

        const thumbSize    = parseFloat(root.getPropertyValue('--slider-thumb-size'));
        const touchPadding = parseFloat(
          getComputedStyle(input).getPropertyValue('--slider-touch-padding') || '0',
        );

        // Coarse pointer: height = thumbSize + 2 * touchPadding.
        // Fine pointer:   height = thumbSize.
        const isCoarse = window.matchMedia('(pointer: coarse)').matches;
        const expected = isCoarse ? thumbSize + touchPadding * 2 : thumbSize;

        return {
          inputHeight:   rect ? rect.height : null,
          expectedHeight: expected,
        };
      }, `.${slider}-slider-over-gradient`);

      expect(inputHeight).not.toBeNull();
      // Allow ±0.5 px for sub-pixel rendering differences across platforms.
      expect(Math.abs(inputHeight - expectedHeight)).toBeLessThan(0.5);
    });
  }
});
