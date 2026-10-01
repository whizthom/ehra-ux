import { useEffect, useRef } from "react";

/**
 * setInterval that only ticks while the browser tab is actually visible.
 *
 * Why: several screens re-fetch on a timer so the admin sees fresh data.
 * A background tab (or a laptop left open overnight) shows that data to
 * nobody, yet kept hitting the backend and database every tick. This keeps
 * the exact same period while the tab is visible, stops while it is hidden,
 * and - so nothing is ever left stale - runs the callback once immediately
 * when the tab becomes visible again if at least one full period has passed
 * since the last run.
 *
 * `callback` is read through a ref, so passing a new function each render
 * never restarts the timer. Pass a falsy `delayMs` to disable.
 */
export default function useVisibleInterval(callback, delayMs) {
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  });

  useEffect(() => {
    if (!delayMs) return undefined;

    let timer = null;
    let lastRun = Date.now();

    const run = () => {
      lastRun = Date.now();
      savedCallback.current?.();
    };
    const start = () => {
      if (timer === null) timer = setInterval(run, delayMs);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
        return;
      }
      if (Date.now() - lastRun >= delayMs) run();
      start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [delayMs]);
}
