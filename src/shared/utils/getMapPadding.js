/**
 * Compute the padding object for Mapbox `fitBounds` calls.
 *
 * This helper centralizes the mobile/desktop branch and the use of the
 * `--panel-visible-h` CSS variable so map padding arithmetic lives in
 * exactly one place.
 *
 * @param {object} opts
 * @param {boolean} opts.isMobile - true when viewport is considered mobile
 * @param {number} opts.panelVisibleH - height in px of the visible panel area
 * @param {number} opts.panelWidth - panel width in px (desktop)
 * @returns {{ top: number, right: number, bottom: number, left: number }} padding
 */
import { LAYOUT } from '../../config';

export function getMapPadding({ isMobile, panelVisibleH, panelWidth }) {
  const pad = LAYOUT.mapPadding?.default ?? 24;
  if (isMobile) {
    return {
      top: pad,
      right: pad,
      bottom: (Number.isFinite(panelVisibleH) ? panelVisibleH : 0) + pad,
      left: pad,
    };
  }
  return {
    top: pad,
    right: pad,
    bottom: pad,
    left: (Number.isFinite(panelWidth) ? panelWidth : LAYOUT.panelWidth) + pad,
  };
}

export default getMapPadding;
