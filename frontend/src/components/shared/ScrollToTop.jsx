import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Every page shell is a min-h-screen div, so the window is the scroller, and
// a client-side <Link> swap leaves window.scrollY wherever the previous page
// had it. Reset on each pathname change -- before paint, so the new page never
// flashes at the old offset. (React Router's <ScrollRestoration> needs a data
// router; App.jsx uses the declarative <BrowserRouter>.)
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
