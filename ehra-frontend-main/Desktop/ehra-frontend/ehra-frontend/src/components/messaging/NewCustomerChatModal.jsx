import { useEffect, useRef, useState } from "react";
import ThreadPickerModal from "./ThreadPickerModal";
import { listCustomerContacts } from "../../api/messagingApi";

const DEBOUNCE_MS = 250;

// Staff side (employer / an employee the employer allowed): pick one of the
// business's customers to message. Searches the server as you type - a shop
// can have thousands of customers, so the full list is never loaded at once.
// Customers who already have a chat are marked, and picking one simply
// reopens it (the backend returns the existing shared thread).
export default function NewCustomerChatModal({ onClose, onPick }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    const timer = setTimeout(
      async () => {
        try {
          const { data } = await listCustomerContacts(query.trim());
          if (id !== requestId.current) return;
          setItems(data || []);
          setError("");
        } catch (err) {
          if (id !== requestId.current) return;
          setError(err?.response?.data?.message || "Couldn't load your customers. Please try again.");
        } finally {
          if (id === requestId.current) setLoading(false);
        }
      },
      query ? DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [query]);

  const handlePick = async (customer) => {
    setBusyKey(customer.identityId);
    try {
      await onPick(customer);
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't open that conversation. Please try again.");
      setBusyKey(null);
    }
  };

  return (
    <ThreadPickerModal
      title="Message a customer"
      placeholder="Search customers by name or phone"
      items={items}
      loading={loading}
      error={error}
      query={query}
      onQueryChange={(value) => {
        setQuery(value);
        setLoading(true);
      }}
      getKey={(c) => c.identityId}
      getName={(c) => c.name}
      getAvatar={(c) => c.avatarUrl}
      getSecondary={(c) => c.phone}
      isOnline={(c) => c.online}
      hasThread={(c) => c.hasConversation}
      onPick={handlePick}
      busyKey={busyKey}
      emptyTitle={query ? "No customers match that search" : "No customers linked yet"}
      emptyText={
        query
          ? "Try a different name or phone number."
          : "Customers appear here once they order from you or you add them."
      }
      onClose={onClose}
    />
  );
}
