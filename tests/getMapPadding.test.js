import { test, expect } from '@playwright/test';
import { getMapPadding } from '../src/utils/getMapPadding.js';
import { LAYOUT } from '../src/config.js';

test('getMapPadding returns correct mobile padding', async () => {
  const isMobile = true;
  const panelVisibleH = 120;
  const padding = getMapPadding({ isMobile, panelVisibleH, panelWidth: LAYOUT.panelWidth });
  expect(padding.top).toBe(LAYOUT.mapPadding.default);
  expect(padding.right).toBe(LAYOUT.mapPadding.default);
  expect(padding.left).toBe(LAYOUT.mapPadding.default);
  expect(padding.bottom).toBe(panelVisibleH + LAYOUT.mapPadding.default);
});

test('getMapPadding returns correct desktop padding', async () => {
  const isMobile = false;
  const panelVisibleH = 0; // ignored on desktop
  const padding = getMapPadding({ isMobile, panelVisibleH, panelWidth: LAYOUT.panelWidth });
  expect(padding.top).toBe(LAYOUT.mapPadding.default);
  expect(padding.right).toBe(LAYOUT.mapPadding.default);
  expect(padding.bottom).toBe(LAYOUT.mapPadding.default);
  expect(padding.left).toBe(LAYOUT.panelWidth + LAYOUT.mapPadding.default);
});
