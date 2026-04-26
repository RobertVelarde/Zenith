import { test, expect } from '@playwright/test';

// Intercept Mapbox geocoding requests and return a deterministic result.
const SAMPLE_FEATURES = {
  type: 'FeatureCollection',
  features: [
    {
      id: 'test.1',
      type: 'Feature',
      place_name: 'Test Place, Example City',
      center: [-74.006, 40.7128],
    },
  ],
};

test('clicking a search result sets the app coordinates', async ({ page }, testInfo) => {
  // Mock geocoding API responses so tests don't rely on external network.
  await page.route('**/geocoding/v5/mapbox.places/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SAMPLE_FEATURES),
    });
  });

  // Suppress Mapbox console noise in test output.
  page.on('console', () => {});
  page.on('pageerror', () => {});

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button:has-text("Zenith")', { timeout: 15000 });
  await page.waitForFunction(
    () => {
      const overlay = document.querySelector('[data-testid="loading-screen"]');
      if (!overlay) return true;
      const hidden = overlay.getAttribute('aria-hidden') === 'true';
      const pe = window.getComputedStyle(overlay).pointerEvents;
      return hidden && pe === 'none';
    },
    null,
    { timeout: 25_000 },
  );

  const isMobileProject = /mobile/i.test(testInfo.project.name);

  // Keep desktop projects in desktop layout; mobile projects should use the
  // real bottom-sheet flow.
  if (!isMobileProject) {
    await page.setViewportSize({ width: 1280, height: 800 });
  } else {
    const expandMenu = page.locator('button[aria-label="Expand menu"]');
    await expect(expandMenu).toBeVisible({ timeout: 5000 });
    await expandMenu.click({ force: true });
  }

  // Open the search input and type a query.
  const searchButton = page.locator('button[aria-label="Search location"]').first();
  await expect(searchButton).toBeVisible({ timeout: 5000 });
  await searchButton.click({ force: true });
  await page.waitForFunction(
    () => {
      const overlay = document.querySelector('[data-testid="loading-screen"]');
      if (!overlay) return true;
      const hidden = overlay.getAttribute('aria-hidden') === 'true';
      const pe = window.getComputedStyle(overlay).pointerEvents;
      return hidden && pe === 'none';
    },
    null,
    { timeout: 10_000 },
  );
  const input = page.locator('input[placeholder^="Search location"]').first();
  if (isMobileProject) {
    // iOS/WebKit can occasionally collapse the header mode after the first tap.
    if (await input.count() === 0) {
      await searchButton.click({ force: true });
    }
  }
  await expect(input).toBeVisible({ timeout: 10000 });
  await input.fill('Test');

  // Wait for the mocked result to appear and click the visible item.
  const resultItem = page.locator('li:has-text("Test Place, Example City"):visible').first();
  await expect(resultItem).toBeVisible({ timeout: 10000 });
  await resultItem.click({ force: true });

  // The header should update to show the new coordinates (6 decimals).
  await expect(page.locator('text=40.712800, -74.006000')).toBeVisible();
});
