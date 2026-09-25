import { useCallback, useEffect, useRef, useState } from "react";
import useMessageStream from "../../hooks/useMessageStream";
import {
  deleteNotification,
  markNotificationRead,
} from "../../api/notificationApi";
import styles from "../../pages/Dashboard.module.css";
import timeAgo from "../../utils/timeAgo";

const RETAIL_TYPES = new Set([
  "RETAIL_ORDER_PLACED", "RETAIL_ORDER_STATUS_CHANGED", "RETAIL_ORDER_CANCELLED", "RETAIL_ORDER_REFUNDED",
  "RETAIL_PAYMENT_RECEIVED", "RETAIL_PAYMENT_FAILED", "RETAIL_PAYMENT_REFUNDED", "RETAIL_SALE_COMPLETED", "RETAIL_SALE_REFUNDED",
  "RETAIL_INVENTORY_LOW_STOCK", "RETAIL_CUSTOMER_CREATED", "RETAIL_PURCHASE_CREATED", "RETAIL_PURCHASE_REVERSED",
  "RETAIL_SUPPLIER_CREATED", "RETAIL_SUPPLIER_UPDATED", "RETAIL_SUPPLIER_DEACTIVATED",
  "RETAIL_CUSTOMER_MESSAGE_RECEIVED", "RETAIL_COUPON_AWARDED", "RETAIL_COUPON_REDEEMED",
]);
const CUSTOMER_TYPES = new Set([
  "CUSTOMER_ORDER_PLACED", "CUSTOMER_ORDER_CONFIRMED", "CUSTOMER_ORDER_PROCESSING", "CUSTOMER_ORDER_READY",
  "CUSTOMER_ORDER_SHIPPED", "CUSTOMER_ORDER_DELIVERED", "CUSTOMER_ORDER_CANCELLED", "CUSTOMER_ORDER_REFUNDED",
  "CUSTOMER_PAYMENT_RECEIVED", "CUSTOMER_PAYMENT_FAILED", "CUSTOMER_PAYMENT_REFUNDED",
  "CUSTOMER_COUPON_AWARDED", "CUSTOMER_COUPON_REDEEMED", "CUSTOMER_ANNOUNCEMENT", "CUSTOMER_SUPPORT_REPLY",
]);

const ICON = {
  RETAIL_ORDER_PLACED: "ti-shopping-bag", RETAIL_ORDER_STATUS_CHANGED: "ti-package",
  RETAIL_ORDER_CANCELLED: "ti-circle-x", RETAIL_ORDER_REFUNDED: "ti-receipt-refund",
  RETAIL_PAYMENT_RECEIVED: "ti-cash", RETAIL_PAYMENT_FAILED: "ti-credit-card-off", RETAIL_PAYMENT_REFUNDED: "ti-receipt-refund",
  RETAIL_SALE_COMPLETED: "ti-cash-register", RETAIL_SALE_REFUNDED: "ti-receipt-refund",
  RETAIL_INVENTORY_LOW_STOCK: "ti-alert-triangle", RETAIL_CUSTOMER_CREATED: "ti-user-plus",
  RETAIL_PURCHASE_CREATED: "ti-truck-delivery", RETAIL_PURCHASE_REVERSED: "ti-truck-return",
  RETAIL_SUPPLIER_CREATED: "ti-building-warehouse", RETAIL_SUPPLIER_UPDATED: "ti-building-store",
  RETAIL_SUPPLIER_DEACTIVATED: "ti-building-off", RETAIL_CUSTOMER_MESSAGE_RECEIVED: "ti-message-circle",
  RETAIL_COUPON_AWARDED: "ti-ticket", RETAIL_COUPON_REDEEMED: "ti-ticket-off",
  CUSTOMER_ORDER_PLACED: "ti-shopping-bag", CUSTOMER_ORDER_CONFIRMED: "ti-circle-check",
  CUSTOMER_ORDER_PROCESSING: "ti-loader", CUSTOMER_ORDER_READY: "ti-package",
  CUSTOMER_ORDER_SHIPPED: "ti-truck-delivery", CUSTOMER_ORDER_DELIVERED: "ti-circle-check-filled",
  CUSTOMER_ORDER_CANCELLED: "ti-circle-x", CUSTOMER_ORDER_REFUNDED: "ti-receipt-refund",
  CUSTOMER_PAYMENT_RECEIVED: "ti-cash", CUSTOMER_PAYMENT_FAILED: "ti-credit-card-off",
  CUSTOMER_PAYMENT_REFUNDED: "ti-receipt-refund", CUSTOMER_COUPON_AWARDED: "ti-ticket",
  CUSTOMER_COUPON_REDEEMED: "ti-ticket-off", CUSTOMER_ANNOUNCEMENT: "ti-speakerphone",
  CUSTOMER_SUPPORT_REPLY: "ti-message-circle",
};


function iconClass(type) {
  if (type?.includes("FAILED") || type?.includes("CANCELLED") || type?.includes("REFUNDED")) return `${styles.notifIcon} ${styles.no}`;
  if (type?.includes("LOW_STOCK")) return `${styles.notifIcon} ${styles.reg}`;
  if (type?.includes("PAYMENT") || type?.includes("COMPLETED") || type?.includes("DELIVERED") || type?.includes("CONFIRMED")) return `${styles.notifIcon} ${styles.ok}`;
  return `${styles.notifIcon} ${styles.sys}`;
}

export default function NotificationCenter({
  mode,
  fetchNotifications,
  fetchUnreadCount,
  markAllRead,
  onViewAll,
  enabled = true,
}) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState(new Map());
  const ref = useRef(null);
  const filter = mode === "retail" ? RETAIL_TYPES : CUSTOMER_TYPES;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, count] = await Promise.all([fetchNotifications(), fetchUnreadCount()]);
      setNotifs(list?.data || []);
      setUnreadCount(Number(count?.data || 0));
    } finally { setLoading(false); }
  }, [fetchNotifications, fetchUnreadCount]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  useMessageStream({
    notificationFilter: (payload) => filter.has(payload?.type),
    onNewNotification: (payload) => {
      if (!filter.has(payload?.type)) return;
      setNotifs((prev) => prev.some((n) => n.id === payload.id) ? prev : [payload, ...prev]);
      setUnreadCount((n) => n + (payload?.isRead ? 0 : 1));
    },
  }, enabled);

  useEffect(() => {
    const onClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markOne = async (id) => {
    const current = notifs.find((n) => n.id === id);
    if (!current || current.isRead) return;
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount((n) => Math.max(0, n - 1));
    try { await markNotificationRead(id); } catch { load().catch(() => {}); }
  };

  const markAll = async () => {
    if (!unreadCount) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try { await markAllRead(); } catch { load().catch(() => {}); }
  };

  const remove = (notification) => {
    setNotifs((prev) => prev.filter((n) => n.id !== notification.id));
    const timer = window.setTimeout(() => {
      deleteNotification(notification.id).catch(() => {});
      setPendingDeletes((prev) => { const next = new Map(prev); next.delete(notification.id); return next; });
    }, 3500);
    setPendingDeletes((prev) => new Map(prev).set(notification.id, { notification, timer }));
  };

  const undo = (id) => {
    const entry = pendingDeletes.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    setNotifs((prev) => [entry.notification, ...prev].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    setPendingDeletes((prev) => { const next = new Map(prev); next.delete(id); return next; });
  };

  return (
    <div className={styles.notifWrapper} ref={ref}>
      <button
        type="button"
        className={styles.notifBtn}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <i className="ti ti-bell" aria-hidden="true" />
        {unreadCount > 0 && <span className={styles.notifCount}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && (
        <div className={styles.notifPanel}>
          <div className={styles.notifPanelHdr}>
            <span className={styles.notifPanelTitle}>Notifications {unreadCount > 0 && <span className={styles.notifPageBadge}>{unreadCount} new</span>}</span>
            <button className={styles.notifMarkAll} onClick={markAll} disabled={!unreadCount}>Mark all read</button>
          </div>
          <div className={styles.notifList}>
            {loading ? <p className={styles.notifEmpty}>Loading…</p> : notifs.length === 0 ? (
              <div className={styles.notifEmpty}><div className={styles.notifEmptyIcon}>🔔</div><p>You're all caught up!</p></div>
            ) : notifs.slice(0, 12).map((n) => (
              <div key={n.id} className={`${styles.notifItem} ${!n.isRead ? styles.unread : ""}`} onClick={() => markOne(n.id)}>
                <div className={styles.notifItemTop}>
                  <div className={iconClass(n.type)}><i className={`ti ${ICON[n.type] || "ti-bell"}`} aria-hidden="true" /></div>
                  <div className={styles.notifBody}>
                    <div className={styles.notifTitle}>{n.title}</div>
                    <div className={styles.notifMsg}>{n.message}</div>
                    <div className={styles.notifTime}>{timeAgo(n.createdAt)}</div>
                  </div>
                  <div className={styles.notifItemRight}>
                    {!n.isRead && <div className={styles.notifUnreadDot} />}
                    <button type="button" className={styles.notifDeleteBtn} aria-label="Delete notification" onClick={(e) => { e.stopPropagation(); remove(n); }}>
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className={styles.notifViewAll} onClick={() => { setOpen(false); onViewAll?.(); }}>View all notifications</button>
        </div>
      )}
      {pendingDeletes.size > 0 && (
        <div className={styles.notifUndoStack}>
          {[...pendingDeletes.keys()].slice(-1).map((id) => <button key={id} onClick={() => undo(id)}>Notification deleted. Undo</button>)}
        </div>
      )}
    </div>
  );
}

export function NotificationsPage({ notifs, unreadCount, loading, onMarkAllRead, onMarkOneRead, onDelete }) {
  return (
    <section className={styles.notifPageWrap}>
      <div className={styles.notifPageHdr}>
        <span className={styles.notifPageTitle}>Notifications {unreadCount > 0 && <span className={styles.notifPageBadge}>{unreadCount} new</span>}</span>
        <button className={styles.notifMarkAll} onClick={onMarkAllRead} disabled={!unreadCount}>Mark all read</button>
      </div>
      <div className={styles.notifPageList}>
        {loading ? <p className={styles.notifEmpty}>Loading…</p> : notifs.length === 0 ? <div className={styles.notifEmpty}><div className={styles.notifEmptyIcon}>🔔</div><p>You're all caught up!</p></div> : notifs.map((n) => (
          <div key={n.id} className={`${styles.notifItem} ${!n.isRead ? styles.unread : ""}`} onClick={() => onMarkOneRead(n.id)}>
            <div className={styles.notifItemTop}><div className={iconClass(n.type)}><i className={`ti ${ICON[n.type] || "ti-bell"}`} /></div><div className={styles.notifBody}><div className={styles.notifTitle}>{n.title}</div><div className={styles.notifMsg}>{n.message}</div><div className={styles.notifTime}>{timeAgo(n.createdAt)}</div></div><div className={styles.notifItemRight}>{!n.isRead && <div className={styles.notifUnreadDot}/>}<button type="button" className={styles.notifDeleteBtn} onClick={(e) => {e.stopPropagation(); onDelete(n);}}><i className="ti ti-trash"/></button></div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function NotificationsPageView({ mode, fetchNotifications, fetchUnreadCount, markAllRead }) {
  const filter = mode === "retail" ? RETAIL_TYPES : CUSTOMER_TYPES;
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingDeletes, setPendingDeletes] = useState(new Map());
  const load = useCallback(async () => {
    setLoading(true);
    try { const [list, count] = await Promise.all([fetchNotifications(), fetchUnreadCount()]); setNotifs(list?.data || []); setUnreadCount(Number(count?.data || 0)); }
    finally { setLoading(false); }
  }, [fetchNotifications, fetchUnreadCount]);
  useEffect(() => { load().catch(() => {}); }, [load]);
  useMessageStream({ notificationFilter: (p) => filter.has(p?.type), onNewNotification: (p) => { if (!filter.has(p?.type)) return; setNotifs((prev) => prev.some((n) => n.id === p.id) ? prev : [p, ...prev]); setUnreadCount((n) => n + (p?.isRead ? 0 : 1)); } });
  const markOne = async (id) => { const n = notifs.find((x) => x.id === id); if (!n || n.isRead) return; setNotifs((prev) => prev.map((x) => x.id === id ? { ...x, isRead: true } : x)); setUnreadCount((n) => Math.max(0, n - 1)); try { await markNotificationRead(id); } catch { load().catch(() => {}); } };
  const markAll = async () => { setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true }))); setUnreadCount(0); try { await markAllRead(); } catch { load().catch(() => {}); } };
  const remove = (n) => { setNotifs((prev) => prev.filter((x) => x.id !== n.id)); const timer = window.setTimeout(() => { deleteNotification(n.id).catch(() => {}); setPendingDeletes((prev) => { const x = new Map(prev); x.delete(n.id); return x; }); }, 3500); setPendingDeletes((prev) => new Map(prev).set(n.id, { notification: n, timer })); };
  const undo = (id) => { const e = pendingDeletes.get(id); if (!e) return; clearTimeout(e.timer); setNotifs((prev) => [e.notification, ...prev].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))); setPendingDeletes((prev) => { const x = new Map(prev); x.delete(id); return x; }); };
  return <><NotificationsPage notifs={notifs} unreadCount={unreadCount} loading={loading} onMarkAllRead={markAll} onMarkOneRead={markOne} onDelete={remove} />{pendingDeletes.size > 0 && <div className={styles.notifUndoStack}>{[...pendingDeletes.keys()].slice(-1).map((id) => <button key={id} onClick={() => undo(id)}>Notification deleted. Undo</button>)}</div>}</>;
}
