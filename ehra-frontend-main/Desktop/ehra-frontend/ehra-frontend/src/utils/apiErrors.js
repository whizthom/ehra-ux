// Turns a raw axios error from a backend API call into one specific,
// user-facing message — instead of the old "if no err.response, assume
// the server's asleep; if err.response, assume it's a credentials
// problem" logic, which mislabeled a genuine unrelated 500 as "wrong
// password or phone number".
//
// Order matters below — each check is meaningfully different from the
// others and deliberately checked in this sequence:
//   1. offline given first because it's the single most actionable,
//      deterministic signal available (navigator.onLine) — no point
//      guessing at server-side causes when the device itself has no
//      connection.
//   2. canceled requests return null — a request the app itself aborted
//      (e.g. a superseded duplicate) is not a failure worth showing the
//      person anything about.
//   3. timeout vs. generic network error are both "no err.response"
//      cases but come from genuinely different axios error codes and
//      deserve different copy — a timeout means SOMETHING was reachable
//      and just slow (the classic Render free-tier cold-start case this
//      was originally written for); ERR_NETWORK means nothing answered
//      at all (DNS failure, connection refused, offline mid-request,
//      or a CORS rejection — the browser deliberately gives JS no way
//      to tell CORS apart from a true network failure, so that case is
//      folded into this same bucket rather than pretending to detect
//      it).
//   4. once a real err.response exists, prefer the backend's own
//      message for anything a specific GlobalExceptionHandler entry
//      would have crafted (401 wrong-password/no-account, 403
//      suspended/deleted, 429 rate-limited, etc.) — but 5xx is
//      DELIBERATELY never shown from the backend's raw message, even if
//      one is present, since an unexpected 500 falls through to
//      GlobalExceptionHandler's generic Exception handler, which echoes
//      ex.getMessage() verbatim — that's a raw Java exception string,
//      not something meant for a person to read.
export function describeApiError(err, fallback = "Something went wrong. Please try again.") {
  if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") {
    return null;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your internet connection and try again.";
  }

  if (!err?.response) {
    if (err?.code === "ECONNABORTED") {
      return "That's taking longer than expected — Ehral's server may be waking up after being idle, or your connection may be slow. Please wait a few seconds and try again.";
    }
    return "We couldn't reach Ehral's servers. Check your connection and try again — if this keeps happening, our servers may be temporarily down.";
  }

  const { status, data } = err.response;
  const backendMessage = typeof data?.message === "string" ? data.message : null;

  if (status === 502 || status === 503 || status === 504) {
    return "Ehral's servers are starting up or temporarily unavailable. Please try again in a few seconds.";
  }

  if (status >= 500) {
    // Deliberately NOT backendMessage here — see the file-level comment.
    return "Something went wrong on our end. Please try again, and let us know if it continues.";
  }

  if (status === 429) {
    return backendMessage || "Too many attempts. Please wait a moment and try again.";
  }

  return backendMessage || (typeof data === "string" ? data : null) || fallback;
}