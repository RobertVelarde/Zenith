/**
 * @file useBottomSheet.js
 *
 * Encapsulates the 4-stage mobile bottom-sheet gesture system:
 *   stage 0 – closed   (only header bar visible)
 *   stage 1 – peeked   (header + pinned summary)
 *   stage 2 – open     (header + scrollable body)
 *   stage 3 – full     (panel covers entire screen)
 *
 * The panel is always 100dvh on mobile; translateY controls which portion is
 * visible. Snap positions are provided by the caller (derived from measured
 * DOM heights) so this hook stays free of layout concerns.
 *
 * @param {object}              params
 * @param {number[]}            params.snapPositions  - translateY for each stage [0..3]
 * @param {boolean}             params.isMobile       - true when viewport width < 768 px
 * @param {React.RefObject}     params.pinnedRef      - ref on the pinned section DOM node
 * @param {React.RefObject}     params.headerRef      - ref on the header DOM node
 * @param {React.RefObject}     params.scrollBodyRef  - ref on the scroll-body DOM node
 *
 * @returns {{ stage, setStage, panelStyle, snapPositions, currentTranslateY, handlers }}
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

/**
 * Returns the index of the snap position nearest the momentum-projected
 * translateY value, choosing the stage the panel should settle on.
 *
 * @param {number}   projected - momentum-projected translateY (px);
 *                               computed as baseY + dy + velocity × MOMENTUM_PROJECTION_MS
 * @param {number[]} snaps     - translateY value for each stage (index = stage)
 * @returns {number} stage index (0–3)
 */
function snapToNearest(projected, snaps) {
  return snaps
    .map((y, i) => ({ i, d: Math.abs(y - projected) }))
    .sort((a, b) => a.d - b.d)[0].i;
}

/**
 * Momentum projection window (ms).
 *
 * The projected position is:  baseY + dy + velocity × MOMENTUM_PROJECTION_MS
 * This simulates where the panel would travel under its current flick velocity,
 * so a fast upward swipe snaps further open than a slow drag to the same spot.
 */
const MOMENTUM_PROJECTION_MS = 150;

export function useBottomSheet({ snapPositions, isMobile, pinnedRef, headerRef, scrollBodyRef }) {
  const [stage, setStage]               = useState(() => window.innerWidth < 768 ? 1 : 0);
  const [liveTransform, setLiveTransform] = useState(null);

  const dragRef       = useRef(null);
  const scrollDragRef = useRef(null);

  const snappedTranslateY = isMobile ? (snapPositions[stage] ?? 0) : 0;

  // Stable refs so native event handlers always see the latest values without
  // needing to be re-registered every time state or props change.
  const snapPositionsRef = useRef(snapPositions);
  useEffect(() => { snapPositionsRef.current = snapPositions; }, [snapPositions]);

  const snappedTYRef = useRef(snappedTranslateY);
  useEffect(() => { snappedTYRef.current = snappedTranslateY; }, [snappedTranslateY]);

  // ── Header drag gesture ────────────────────────────────────────────────────

  const onDragStart = useCallback((e) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    dragRef.current = { startY: touch.clientY, startTime: Date.now(), baseY: snappedTranslateY };
    setLiveTransform(snappedTranslateY);
  }, [isMobile, snappedTranslateY]);

  const onDragMove = useCallback((e) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dy    = touch.clientY - dragRef.current.startY;
    // Clamp between stage 3 (0 px) and stage 0 (most-closed position).
    setLiveTransform(Math.max(0, Math.min(snapPositions[0], dragRef.current.baseY + dy)));
  }, [snapPositions]);

  // Non-passive touchmove on header + pinned so e.preventDefault() can block
  // scroll passthrough while a drag gesture is in progress.
  useEffect(() => {
    const els = [headerRef.current, pinnedRef.current].filter(Boolean);
    els.forEach((el) => el.addEventListener('touchmove', onDragMove, { passive: false }));
    return () => els.forEach((el) => el.removeEventListener('touchmove', onDragMove));
  }, [onDragMove, headerRef, pinnedRef]);

  const onDragEnd = useCallback((e) => {
    if (!dragRef.current) return;
    const touch = e.changedTouches[0];
    const dy  = touch.clientY - dragRef.current.startY;
    const dt  = Math.max(1, Date.now() - dragRef.current.startTime);
    const vel = dy / dt; // px/ms — positive = downward

    // Project position forward to factor in momentum.
    const projected = dragRef.current.baseY + dy + vel * MOMENTUM_PROJECTION_MS;
    dragRef.current = null;
    setLiveTransform(null);

    setStage(snapToNearest(projected, snapPositions));
  }, [snapPositions]);

  // ── Pinned section: native touch handlers ───────────────────────────────────
  // Native listeners fire as the event bubbles through the real DOM, BEFORE
  // React processes synthetic events at the root container. This means they
  // are never blocked by React's e.stopPropagation() in any child element,
  // which is why this is more reliable than React onTouchStart/onTouchEnd on
  // the pinned div.
  //
  // • e.target.closest('input') — exempts date & range inputs so they keep
  //   their native behaviour (date picker, slider).
  // • Non-passive touchend — lets us call e.preventDefault() on significant
  //   drags starting from buttons (sun/moon) to suppress the synthesised
  //   click that would otherwise fight the panel-close action.
  useEffect(() => {
    const el = pinnedRef.current;
    if (!el) return;

    let touchStartY = 0, touchStartTime = 0, pinnedActive = false;

    const handleTouchStart = (e) => {
      if (window.innerWidth >= 768) return;
      if (e.target.closest('input')) return; // let date/range inputs work natively
      touchStartY    = e.touches[0].clientY;
      touchStartTime = Date.now();
      pinnedActive   = true;
      // Prime the shared dragRef so onDragMove can do live panel tracking.
      dragRef.current = { startY: touchStartY, startTime: touchStartTime, baseY: snappedTYRef.current };
      setLiveTransform(snappedTYRef.current);
    };

    const handleTouchEnd = (e) => {
      if (!pinnedActive) return;
      pinnedActive = false;
      const dy  = e.changedTouches[0].clientY - touchStartY;
      const dt  = Math.max(1, Date.now() - touchStartTime);
      const vel = dy / dt;

      dragRef.current = null;
      setLiveTransform(null);

      // Suppress the synthesised click on buttons when a flick is detected, so
      // tapping sun/moon (small dy) still fires onClick, but dragging closes.
      const isSignificantMove = Math.abs(vel) > 0.2 || Math.abs(dy) > 30;
      if (isSignificantMove) e.preventDefault();

      const projected = snappedTYRef.current + dy + vel * MOMENTUM_PROJECTION_MS;
      setStage(snapToNearest(projected, snapPositionsRef.current));
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend',   handleTouchEnd,   { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend',   handleTouchEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ↑ Intentionally empty deps: all mutable values accessed via stable refs
  //   (snappedTYRef, snapPositionsRef, dragRef) or stable setters (setStage,
  //   setLiveTransform). Re-registering native listeners on every render
  //   would cause flicker and potential event-listener leaks.

  // ── Scroll-body drag-to-close ──────────────────────────────────────────────
  // When the panel is open and the user pulls down from the very top of the
  // scroll area, collapse the panel instead of rubber-banding. Normal
  // scrolling (including past the bottom) is unaffected.

  const onScrollBodyTouchStart = useCallback((e) => {
    if (window.innerWidth >= 768) return;
    scrollDragRef.current = { startY: e.touches[0].clientY, startTime: Date.now() };
  }, []);

  const onScrollBodyTouchMove = useCallback((e) => {
    if (!scrollDragRef.current) return;
    const el = scrollBodyRef.current;
    if (!el) return;
    const dy = e.touches[0].clientY - scrollDragRef.current.startY;
    if (el.scrollTop === 0 && dy > 0) {
      e.preventDefault(); // block rubber-band; we handle this gesture
    } else {
      scrollDragRef.current = null; // normal scroll — let browser handle it
    }
  }, [scrollBodyRef]);

  const onScrollBodyTouchEnd = useCallback((e) => {
    if (!scrollDragRef.current) return;
    const dy  = e.changedTouches[0].clientY - scrollDragRef.current.startY;
    const dt  = Math.max(1, Date.now() - scrollDragRef.current.startTime);
    const vel = dy / dt;
    scrollDragRef.current = null;
    // Pull-down from scroll body top collapses one stage (3→2, 2→1).
    if (vel > 0.3 || dy > 60) setStage((s) => Math.max(0, s - 1));
  }, []);

  // Non-passive so e.preventDefault() can block rubber-band bounce.
  useEffect(() => {
    const el = scrollBodyRef.current;
    if (!el) return;
    el.addEventListener('touchmove', onScrollBodyTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onScrollBodyTouchMove);
  }, [onScrollBodyTouchMove, scrollBodyRef]);

  // ── Panel transform style ──────────────────────────────────────────────────

  const panelStyle = useMemo(() => {
    if (!isMobile) return undefined;
    const ty = liveTransform !== null ? liveTransform : snappedTranslateY;
    return {
      transform:  `translateY(${ty}px)`,
      transition: liveTransform !== null ? 'none' : undefined,
      willChange: 'transform',
    };
  }, [isMobile, liveTransform, snappedTranslateY]);

  // Current visual translateY — used by callers to position overlays that
  // must track the panel top (e.g., the mobile search-results dropdown).
  const currentTranslateY = liveTransform !== null ? liveTransform : snappedTranslateY;

  return {
    stage,
    setStage,
    panelStyle,
    snapPositions,
    currentTranslateY,
    handlers: {
      onDragStart,
      onDragEnd,
      onScrollBodyTouchStart,
      onScrollBodyTouchMove,
      onScrollBodyTouchEnd,
    },
  };
}
