import { useEffect } from "react";
import Avatar from "./Avatar";
import base from "./NewChatModal.module.css";
import styles from "./ThreadPickerModal.module.css";

// One-tap "who do you want to message?" picker shared by both sides of the
// Business <-> Customer inbox (NewCustomerChatModal for staff picking a
// customer, NewBusinessChatModal for a customer picking a business).
// Unlike NewChatModal (multi-select, group creation) this is single-select:
// tapping a row IS the action. It reuses NewChatModal's stylesheet for the
// modal chrome so it looks native to the messaging UI.
export default function ThreadPickerModal({
  title,
  placeholder,
  items,
  loading,
  error,
  query,
  onQueryChange,
  getKey,
  getName,
  getAvatar,
  getSecondary,
  isOnline,
  hasThread,
  onPick,
  busyKey,
  emptyTitle,
  emptyText,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={base.overlay} onClick={onClose}>
      <div
        className={base.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={base.header}>
          <h3>{title}</h3>
          <button className={base.closeBtn} onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>

        <div className={base.searchWrap}>
          <i className="ti ti-search" />
          <input
            className={base.searchInput}
            placeholder={placeholder}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            autoFocus
          />
        </div>

        <div className={base.list}>
          {loading && items.length === 0 ? (
            <div className={base.emptyState}>Loading…</div>
          ) : error ? (
            <div className={base.emptyState}>{error}</div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <strong>{emptyTitle}</strong>
              {emptyText && <span>{emptyText}</span>}
            </div>
          ) : (
            items.map((item) => {
              const key = getKey(item);
              const busy = busyKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`${base.contactRow} ${styles.pickRow}`}
                  disabled={busyKey != null}
                  onClick={() => onPick(item)}
                >
                  <Avatar
                    name={getName(item)}
                    src={getAvatar?.(item)}
                    size={40}
                    showPresence={Boolean(isOnline)}
                    online={isOnline ? isOnline(item) : false}
                  />
                  <div className={base.contactInfo}>
                    <span className={base.contactName}>{getName(item)}</span>
                    {getSecondary?.(item) && (
                      <span className={base.contactRole}>{getSecondary(item)}</span>
                    )}
                  </div>
                  <span className={styles.trail}>
                    {busy ? (
                      <i className={`ti ti-loader-2 ${styles.spin}`} />
                    ) : hasThread?.(item) ? (
                      <span className={styles.chip}>Chat</span>
                    ) : (
                      <i className="ti ti-chevron-right" />
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
