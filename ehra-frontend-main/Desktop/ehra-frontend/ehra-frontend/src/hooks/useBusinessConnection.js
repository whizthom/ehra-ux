import { useCallback, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  connectCustomerToBusinessId,
  disconnectCustomerFromBusinessId,
} from "../api/commerceApi";

// Connect / Disconnect a business for the signed-in customer.
//
//   connect(businessId, { bind })   links the customer to the business.
//                                   bind=true also scopes the session to that
//                                   business (the business page does this so
//                                   the store can take orders straight away).
//   disconnect(businessId)          ends the link. The server only soft-removes
//                                   it, so orders/receipts stay and connecting
//                                   again restores it.
//   phaseOf(businessId)             null | "connecting" | "disconnecting" -
//                                   drives button labels and disabled state.
//
// Both calls throw on failure so the caller can show its own message.
export default function useBusinessConnection() {
  const { switchContext } = useAuth();
  const [pending, setPending] = useState({});
  // A ref, not state: two fast taps can land before React re-renders.
  const inflight = useRef(new Set());

  const run = useCallback(async (businessId, phase, action) => {
    if (inflight.current.has(String(businessId))) return undefined;
    inflight.current.add(String(businessId));
    setPending((p) => ({ ...p, [businessId]: phase }));
    try {
      return await action();
    } finally {
      inflight.current.delete(String(businessId));
      setPending((p) => {
        const next = { ...p };
        delete next[businessId];
        return next;
      });
    }
  }, []);

  const connect = useCallback(
    (businessId, { bind = false } = {}) =>
      run(businessId, "connecting", async () => {
        const { data } = await connectCustomerToBusinessId(businessId);
        if (bind) await switchContext("CUSTOMER", data.membershipId);
        return data;
      }),
    [run, switchContext],
  );

  const disconnect = useCallback(
    (businessId) =>
      run(businessId, "disconnecting", async () => {
        await disconnectCustomerFromBusinessId(businessId);
        // If this session is scoped to the business being left, step back to
        // the general customer session so later token refreshes don't point
        // at a link that no longer exists. The API also tolerates a stale
        // scope, so a failure here is not worth failing the disconnect for.
        const scopedHere =
          localStorage.getItem("contextType") === "CUSTOMER" &&
          String(localStorage.getItem("businessId")) === String(businessId);
        if (scopedHere) {
          try {
            await switchContext("CUSTOMER", null);
          } catch {
            /* see above */
          }
        }
        return true;
      }),
    [run, switchContext],
  );

  const phaseOf = useCallback(
    (businessId) => pending[businessId] || null,
    [pending],
  );

  return { connect, disconnect, phaseOf };
}