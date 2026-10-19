import { flushSync } from 'react-dom';

// Cross-fades between two full page routes using the View Transitions API
// (the same primitive ThemeToggle already uses for the light/dark wipe),
// instead of the instant unmount/remount a plain react-router navigate()
// gives. flushSync forces the route change to land inside the transition's
// synchronous DOM-mutation callback, which is what the API requires.
// Falls back to a plain navigate on browsers without support.
export function viewTransitionNavigate(navigate, to, options) {
  if (typeof document.startViewTransition !== 'function') {
    navigate(to, options);
    return;
  }
  document.startViewTransition(() => {
    flushSync(() => navigate(to, options));
  });
}
