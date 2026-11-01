import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// After an album import, the list page opens with `state.importedCount`. The count is
// shown once and then cleared from history, so a reload or Back does not repeat it.
export function useImportedNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const [importedCount, setImportedCount] = useState(null);
  const count = location.state?.importedCount;

  useEffect(() => {
    if (!Number.isInteger(count)) return;
    setImportedCount(count);
    navigate(location.pathname, { replace: true, state: null });
  }, [count, location.pathname, navigate]);

  return [importedCount, () => setImportedCount(null)];
}
