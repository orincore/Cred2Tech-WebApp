import { useEffect } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import { ROUTE_TITLES } from './routeTitles';

/**
 * Keeps the browser tab title in sync with client-side navigation.
 *
 * React Router navigation never reloads the document, so without this the tab
 * keeps showing whatever index.html's static <title> was (or whatever the
 * previous route last set) no matter where the user navigates. Rendered once,
 * near the top of AppRouter — not per-page — so every route is covered
 * automatically and a newly added route only needs an entry in routeTitles.js,
 * not a copy-pasted useEffect in its own component.
 *
 * A handful of pages (LoginPage, the MSME portal pages, etc.) still set
 * document.title themselves. That predates this component and is harmless:
 * their effect runs after this one on mount and writes the identical string,
 * so nothing flickers or conflicts.
 */
function RouteTitle() {
  const location = useLocation();

  useEffect(() => {
    const match = ROUTE_TITLES.find((entry) => matchPath({ path: entry.path, end: true }, location.pathname));
    document.title = match ? `Cred2Tech | ${match.title}` : 'Cred2Tech';
  }, [location.pathname]);

  return null;
}

export default RouteTitle;
