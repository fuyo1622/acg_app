import { useRef } from 'react';

const MIN_DISTANCE = 60;
const EDGE_MARGIN = 24;

// Touch handlers for horizontal swipes. A swipe must travel at least 60px, mostly sideways.
// It is ignored when it starts at a screen edge, where the system has gestures of its own,
// inside an element marked data-swipe-ignore (such as a strip that scrolls sideways), or
// while the page is zoomed in, when a sideways drag pans the page.
export function useSwipe({ onSwipeLeft, onSwipeRight }) {
  const startRef = useRef(null);

  return {
    onTouchStart(event) {
      startRef.current = null;
      if (event.touches.length !== 1) return;
      if ((window.visualViewport?.scale ?? 1) > 1.01) return;
      if (event.target instanceof Element && event.target.closest('[data-swipe-ignore]')) return;

      const touch = event.touches[0];
      if (touch.clientX < EDGE_MARGIN || touch.clientX > window.innerWidth - EDGE_MARGIN) return;
      startRef.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd(event) {
      const start = startRef.current;
      startRef.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch) return;

      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    },
    onTouchCancel() {
      startRef.current = null;
    },
  };
}
