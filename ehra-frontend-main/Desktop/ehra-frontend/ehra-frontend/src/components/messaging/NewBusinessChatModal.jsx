import { useMemo, useState } from "react";
import ThreadPickerModal from "./ThreadPickerModal";

// Customer side: pick one of the businesses you're connected to and open
// your chat with it. `businesses` is the customer overview's list
// (businessId / businessName / businessLogo / businessTypeLabel), so no
// extra request is needed - filtering is local.
export default function NewBusinessChatModal({ businesses = [], onClose, onPick }) {
  const [query, setQuery] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((b) =>
      `${b.businessName || ""} ${b.businessTypeLabel || ""} ${b.businessCategory || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [businesses, query]);

  const handlePick = async (business) => {
    setBusyKey(business.businessId);
    setError("");
    try {
      await onPick(business);
    } catch (err) {
      setError(err?.response?.data?.message || "Messaging isn't available for this business right now.");
      setBusyKey(null);
    }
  };

  return (
    <ThreadPickerModal
      title="Message a business"
      placeholder="Search your businesses"
      items={filtered}
      loading={false}
      error={error}
      query={query}
      onQueryChange={setQuery}
      getKey={(b) => b.businessId}
      getName={(b) => b.businessName}
      getAvatar={(b) => b.businessLogo}
      getSecondary={(b) => b.businessTypeLabel || b.businessType || "Ehral business"}
      onPick={handlePick}
      busyKey={busyKey}
      emptyTitle={query ? "No businesses match that search" : "You're not connected to any business yet"}
      emptyText={
        query
          ? "Try a different name."
          : "Discover businesses on Ehral, or order from one, and you can message them here."
      }
      onClose={onClose}
    />
  );
}
