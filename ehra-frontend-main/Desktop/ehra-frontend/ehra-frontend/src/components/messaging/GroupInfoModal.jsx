import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import {
  listContacts,
  addMembers,
  removeMember,
  leaveConversation,
  updateConversationState,
} from "../../api/messagingApi";
import styles from "./NewChatModal.module.css";
import groupStyles from "./GroupInfoModal.module.css";

export default function GroupInfoModal({
  conversation,
  myIdentityId,
  onClose,
  onChanged,
}) {
  const [addingMode, setAddingMode] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  // The real per-conversation role, straight from the backend
  // (MsgConversationSummary#myRole) — this used to be `|| true`, showing
  // "Add members" and the remove-member (×) button to every single
  // person in every group regardless of whether they were actually an
  // admin. The backend was always the real enforcement either way, but
  // showing controls that then fail on click is a bad, confusing
  // experience — this makes the UI match what's actually allowed.
  const isAdmin = conversation.myRole === "ADMIN";

  useEffect(() => {
    if (addingMode) {
      listContacts().then(({ data }) => {
        const existingIds = new Set(
          conversation.participants.map((p) => p.identityId),
        );
        setContacts(data.filter((c) => !existingIds.has(c.identityId)));
      });
    }
  }, [addingMode, conversation.participants]);

  const handleAdd = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      await addMembers(conversation.id, selected);
      setAddingMode(false);
      setSelected([]);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (identityId) => {
    setBusy(true);
    try {
      await removeMember(conversation.id, identityId);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    setBusy(true);
    try {
      await leaveConversation(conversation.id);
      onClose();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const handleMute = async () => {
    await updateConversationState(conversation.id, {
      muted: !conversation.muted,
    });
    onChanged?.();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Group info</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div className={groupStyles.summary}>
          <Avatar
            name={conversation.name}
            src={conversation.avatarUrl}
            size={64}
          />
          <h4>{conversation.name}</h4>
          <span>{conversation.participants?.length || 0} members</span>
        </div>

        <div className={groupStyles.actionsRow}>
          <button onClick={handleMute}>
            <i
              className={conversation.muted ? "ti ti-bell" : "ti ti-bell-off"}
            />
            {conversation.muted ? "Unmute" : "Mute"}
          </button>
          {isAdmin && (
            <button onClick={() => setAddingMode((v) => !v)}>
              <i className="ti ti-user-plus" /> Add members
            </button>
          )}
        </div>

        {addingMode ? (
          <>
            <div className={styles.list}>
              {contacts.map((c) => (
                <label key={c.identityId} className={styles.contactRow}>
                  <input
                    type="checkbox"
                    checked={selected.includes(c.identityId)}
                    onChange={() =>
                      setSelected((prev) =>
                        prev.includes(c.identityId)
                          ? prev.filter((id) => id !== c.identityId)
                          : [...prev, c.identityId],
                      )
                    }
                  />
                  <Avatar name={c.name} src={c.avatarUrl} size={38} />
                  <div className={styles.contactInfo}>
                    <span className={styles.contactName}>{c.name}</span>
                    <span className={styles.contactRole}>{c.roleLabel}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className={styles.footer}>
              <button
                className={styles.cancelBtn}
                onClick={() => setAddingMode(false)}
              >
                Cancel
              </button>
              <button
                className={styles.createBtn}
                disabled={selected.length === 0 || busy}
                onClick={handleAdd}
              >
                Add
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.list}>
              {conversation.participants?.map((p) => (
                <div key={p.identityId} className={groupStyles.memberRow}>
                  <Avatar
                    name={p.name}
                    src={p.avatarUrl}
                    size={38}
                    showPresence
                    online={p.online}
                  />
                  <div className={styles.contactInfo}>
                    <span className={styles.contactName}>{p.name}</span>
                    <span className={styles.contactRole}>{p.roleLabel}</span>
                  </div>
                  {isAdmin && p.identityId !== myIdentityId && (
                    <button
                      className={groupStyles.removeBtn}
                      onClick={() => handleRemove(p.identityId)}
                      disabled={busy}
                    >
                      <i className="ti ti-x" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.footer}>
              <button
                className={groupStyles.leaveBtn}
                onClick={handleLeave}
                disabled={busy}
              >
                <i className="ti ti-door-exit" /> Leave group
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
