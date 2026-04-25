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

test('clicking a search result sets the app coordinates', async ({ page }) => {
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
  await page
    .locator('[data-testid="loading-screen"][aria-hidden="false"]')
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => {});

  // Ensure desktop layout so the inline dropdown is used in tests.
  await page.setViewportSize({ width: 1280, height: 800 });

  // Open the search input and type a query.
  await page.locator('button[aria-label="Search location"]').click();
  const input = page.locator('input[placeholder^="Search location"]').first();
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill('Test');

  // Wait for the mocked result to appear and click it.
  await page.waitForSelector('text=Test Place, Example City', { timeout: 5000 });
  await page.click('text=Test Place, Example City');

  // The header should update to show the new coordinates (6 decimals).
  await expect(page.locator('text=40.712800, -74.006000')).toBeVisible();
});
