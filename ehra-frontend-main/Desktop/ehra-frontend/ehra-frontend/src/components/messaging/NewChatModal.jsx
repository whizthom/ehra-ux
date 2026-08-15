import { useEffect, useMemo, useState } from "react";
import Avatar from "./Avatar";
import { listContacts } from "../../api/messagingApi";
import styles from "./NewChatModal.module.css";

// Group creation only — the old "start a 1:1 chat" flow this modal also
// used to handle was removed from the UI (ChatList's header icon is gone;
// direct conversations are now auto-populated per person's org
// relationships instead, see MembershipDirectoryService#listAutoContacts
// on the backend). This modal's only job now is what the Group tab's
// "+ New group" button opens.
export default function NewChatModal({ onClose, onCreate }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]); // array of identityId
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listContacts()
      .then(({ data }) => setContacts(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return contacts;
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => c.name.toLowerCase().includes(q));
  }, [contacts, query]);

  const toggle = (identityId) => {
    setSelected((prev) =>
      prev.includes(identityId)
        ? prev.filter((id) => id !== identityId)
        : [...prev, identityId],
    );
  };

  const canCreate = selected.length >= 2 && groupName.trim().length > 0;

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      await onCreate({
        memberIdentityIds: selected,
        groupName: groupName.trim(),
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>New group</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div className={styles.groupNameRow}>
          <input
            className={styles.groupNameInput}
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.searchWrap}>
          <i className="ti ti-search" />
          <input
            className={styles.searchInput}
            placeholder="Search people to add"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.emptyState}>Loading contacts…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>No one to add yet.</div>
          ) : (
            filtered.map((c) => (
              <label key={c.identityId} className={styles.contactRow}>
                <input
                  type="checkbox"
                  checked={selected.includes(c.identityId)}
                  onChange={() => toggle(c.identityId)}
                />
                <Avatar
                  name={c.name}
                  src={c.avatarUrl}
                  size={38}
                  showPresence
                  online={c.online}
                />
                <div className={styles.contactInfo}>
                  <span className={styles.contactName}>{c.name}</span>
                  <span className={styles.contactRole}>{c.roleLabel}</span>
                </div>
              </label>
            ))
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.selectionHint}>
            {selected.length < 2
              ? "Pick at least 2 people"
              : `${selected.length} people selected`}
          </span>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.createBtn}
            disabled={!canCreate || creating}
            onClick={handleCreate}
          >
            {creating ? "Creating…" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}
