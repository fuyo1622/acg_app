import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';

function isTyping(target) {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

// Moves between the records of a list from a detail page, in the order the list showed
// them, with its filters: the list passes that order in the link's state. Opened without
// one, such as from a bookmark, the page follows the list's default order, newest first.
// Moving replaces the history entry, so Back still returns to the list.
export function useSiblingNavigation({ table, id, path }) {
  const location = useLocation();
  const navigate = useNavigate();
  const passedOrder = Array.isArray(location.state?.order) ? location.state.order : null;
  const defaultOrder = useLiveQuery(
    () => (passedOrder ? [] : table.orderBy('created_at').reverse().primaryKeys()),
    [passedOrder, table],
  );
  const order = useMemo(
    () => passedOrder ?? (Array.isArray(defaultOrder) ? defaultOrder : []),
    [passedOrder, defaultOrder],
  );

  const index = order.indexOf(id);
  const previousId = index > 0 ? order[index - 1] : null;
  const nextId = index >= 0 && index < order.length - 1 ? order[index + 1] : null;
  // Passed on to the edit page, which hands it back, so the order survives an edit.
  const linkState = order.length > 0 ? { order } : null;

  useEffect(() => {
    const go = (targetId, from) => {
      navigate(`${path}/${targetId}`, { replace: true, state: { order, from } });
    };

    // The arrow keys move too, unless focus is in a field or a dialog is open.
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isTyping(event.target) || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (event.key === 'ArrowLeft' && previousId !== null) go(previousId, 'left');
      else if (event.key === 'ArrowRight' && nextId !== null) go(nextId, 'right');
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, nextId, order, path, previousId]);

  return {
    position: index + 1,
    total: order.length,
    hasPrevious: previousId !== null,
    hasNext: nextId !== null,
    goPrevious: () => {
      if (previousId !== null) navigate(`${path}/${previousId}`, { replace: true, state: { order, from: 'left' } });
    },
    goNext: () => {
      if (nextId !== null) navigate(`${path}/${nextId}`, { replace: true, state: { order, from: 'right' } });
    },
    // Which side the record came in from, for the slide-in animation.
    slideFrom: location.state?.from ?? null,
    linkState,
  };
}
