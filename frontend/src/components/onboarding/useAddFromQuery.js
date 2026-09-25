import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// Opens a page's Add modal when the URL carries `?add=1` (the intro reel's
// "Log your first title"), then strips the param so a reload or back-nav
// doesn't reopen it. Watches the param rather than running once on mount, in
// case the page is already mounted when the navigation lands (`/` and
// `/movies` both render MoviesPage).
// Takes the page's `setShowAddModal` state setter, which React keeps stable.
export default function useAddFromQuery(setShowAddModal) {
  const [searchParams, setSearchParams] = useSearchParams();
  const wantsAdd = searchParams.get('add') === '1';

  useEffect(() => {
    if (!wantsAdd) return;
    setShowAddModal(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('add');
      return next;
    }, { replace: true });
  }, [wantsAdd, setShowAddModal, setSearchParams]);
}
