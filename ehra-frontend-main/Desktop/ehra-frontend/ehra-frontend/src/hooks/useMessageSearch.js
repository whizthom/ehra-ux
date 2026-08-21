import { useEffect, useRef, useState } from "react";
import { searchMessaging } from "../api/messagingApi";

const DEBOUNCE_MS = 300;

// Backend-powered search over conversation names AND message text/
// document filenames (see MsgMessageRepository#searchBody's doc) —
// distinct from ChatList's own instant client-side filter, which can
// only ever see the conversation names already loaded on screen, never
// message content. This is what actually makes "search messages" work at
// all; before this hook existed, the /api/messaging/search endpoint was
// fully built on the backend but had no caller anywhere in the UI.
export default function useMessageSearch(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const thisRequestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await searchMessaging(trimmed);
        // A slower earlier request finishing after a newer one would
        // otherwise clobber more current results with stale ones.
        if (thisRequestId === requestIdRef.current) setResults(data);
      } catch {
        if (thisRequestId === requestIdRef.current) setResults([]);
      } finally {
        if (thisRequestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return { results, loading };
}