import { useEffect, useMemo, useState } from "react";
import Avatar from "./Avatar";
import { listContacts } from "../../api/messagingApi";
import styles from "./NewChatModal.module.css";

export default function NewChatModal({ onClose, onCreate }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]); // array of identityId
  const [groupMode, setGroupMode] = useState(false);
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
    setSelected((prev) => {
      const next = prev.includes(identityId)
        ? prev.filter((id) => id !== identityId)
        : [...prev, identityId];
      if (next.length > 1) setGroupMode(true);
      if (next.length <= 1 && !groupMode) setGroupMode(false);
      return next;
    });
  };

  const canCreate = groupMode
    ? selected.length > 1 && groupName.trim().length > 0
    : selected.length === 1;

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      await onCreate({
        memberIdentityIds: selected,
        groupName: groupMode ? groupName.trim() : undefined,
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{groupMode ? "New group" : "New conversation"}</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        {selected.length > 1 && (
          <div className={styles.groupNameRow}>
            <input
              className={styles.groupNameInput}
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div className={styles.searchWrap}>
          <i className="ti ti-search" />
          <input
            className={styles.searchInput}
            placeholder="Search people"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.emptyState}>Loading contacts…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>No one to message yet.</div>
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
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.createBtn}
            disabled={!canCreate || creating}
            onClick={handleCreate}
          >
            {creating ? "Starting…" : groupMode ? "Create group" : "Start chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
