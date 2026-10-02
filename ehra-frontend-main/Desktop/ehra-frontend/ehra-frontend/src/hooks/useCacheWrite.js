import { useEffect, useRef } from "react";
import { putCache } from "../utils/viewCache";

/**
 * Keeps the view cache in step with a piece of screen data held in plain
 * useState, so the screen can paint from it next time (see
 * utils/viewCache.js):
 *
 *   const [rows, setRows] = useState(() => seedFromCache("rows", []));
 *   useCacheWrite("rows", rows);
 *
 * Whatever the screen ends up showing (fetch results, optimistic edits,
 * live updates) is written back. The value the state started with - the
 * default, or the copy that was just read from the cache - is never
 * written, so a placeholder can't overwrite real data.
 *
 * It does not fetch or decide freshness; the screen keeps its own mount
 * fetch, which replaces the cached copy within one round trip.
 */
export default function useCacheWrite(key, value) {
  const firstValue = useRef(value);
  useEffect(() => {
    if (!Object.is(value, firstValue.current)) putCache(key, value);
  }, [key, value]);
}
