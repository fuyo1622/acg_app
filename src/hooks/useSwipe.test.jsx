import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSwipe } from './useSwipe';

function SwipeArea({ onSwipeLeft, onSwipeRight }) {
  const swipe = useSwipe({ onSwipeLeft, onSwipeRight });
  return (
    <div data-testid="area" {...swipe}>
      <div data-testid="strip" data-swipe-ignore>
        <span data-testid="thumbnail">thumbnail</span>
      </div>
    </div>
  );
}

function renderArea() {
  const handlers = { onSwipeLeft: vi.fn(), onSwipeRight: vi.fn() };
  render(<SwipeArea {...handlers} />);
  return handlers;
}

function swipe(element, from, to, { fingers = 1 } = {}) {
  const touches = Array.from({ length: fingers }, () => ({ clientX: from.x, clientY: from.y }));
  fireEvent.touchStart(element, { touches });
  fireEvent.touchEnd(element, { changedTouches: [{ clientX: to.x, clientY: to.y }] });
}

describe('useSwipe', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('reports a leftward and a rightward swipe', () => {
    const handlers = renderArea();
    const area = screen.getByTestId('area');

    swipe(area, { x: 300, y: 200 }, { x: 180, y: 210 });
    expect(handlers.onSwipeLeft).toHaveBeenCalledTimes(1);

    swipe(area, { x: 300, y: 200 }, { x: 420, y: 190 });
    expect(handlers.onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('ignores short, mostly vertical, two-finger and screen-edge gestures', () => {
    const handlers = renderArea();
    const area = screen.getByTestId('area');

    swipe(area, { x: 300, y: 200 }, { x: 260, y: 200 }); // too short
    swipe(area, { x: 300, y: 200 }, { x: 200, y: 360 }); // a scroll
    swipe(area, { x: 300, y: 200 }, { x: 100, y: 200 }, { fingers: 2 }); // a pinch
    swipe(area, { x: 10, y: 200 }, { x: 200, y: 200 }); // the system's back gesture

    expect(handlers.onSwipeLeft).not.toHaveBeenCalled();
    expect(handlers.onSwipeRight).not.toHaveBeenCalled();
  });

  it('leaves swipes on a sideways-scrolling strip to the strip', () => {
    const handlers = renderArea();

    swipe(screen.getByTestId('thumbnail'), { x: 300, y: 200 }, { x: 100, y: 200 });

    expect(handlers.onSwipeLeft).not.toHaveBeenCalled();
  });

  it('lets a zoomed-in page pan instead of changing records', () => {
    vi.stubGlobal('visualViewport', { scale: 2 });
    const handlers = renderArea();

    swipe(screen.getByTestId('area'), { x: 300, y: 200 }, { x: 100, y: 200 });

    expect(handlers.onSwipeLeft).not.toHaveBeenCalled();
  });
});
