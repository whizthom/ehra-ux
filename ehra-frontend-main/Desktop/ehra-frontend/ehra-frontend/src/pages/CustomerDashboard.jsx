import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../components/Logo";
import MobileNavHub from "../components/MobileNavHub";
import ThemeToggleMenu from "../theme/ThemeToggleMenu";
import {
  getCustomerOverview,
  getCustomerReceiptPdf,
  discoverCustomerBusinesses,
  getCustomerBusinessTypes,
  getCustomerProfile,
  updateCustomerProfile,
} from "../api/commerceApi";
import {
  createCustomerBusinessConversation,
  getMessages,
  listCustomerConversations,
  markRead,
  sendMessage,
} from "../api/messagingApi";
import { useAuth } from "../context/AuthContext";
import useMessagingConnection from "../hooks/useMessagingConnection";
import {
  subscribeToConversation,
  subscribeToUserQueue,
} from "../services/messagingSocket";
import styles from "./CustomerDashboard.module.css";

// Matches Ehral\'s employer/employee mobile navigation behavior.
function useScrollThumb(ref) {
  const [thumb, setThumb] = useState({ left: 0, width: 100 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const update = () => {
      const { scrollWidth, clientWidth, scrollLeft } = el;
      if (scrollWidth <= clientWidth + 1) {
        setThumb({ left: 0, width: 100 });
        return;
      }
      const width = Math.max((clientWidth / scrollWidth) * 100, 15);
      const maxScroll = scrollWidth - clientWidth;
      const left = maxScroll > 0 ? (scrollLeft / maxScroll) * (100 - width) : 0;
      setThumb({ left, width });
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const settle = setTimeout(update, 400);
    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(update);
      observer.observe(el);
    }
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      clearTimeout(settle);
      observer?.disconnect();
    };
  }, [ref]);

  return thumb;
}

const money = (currency, value) =>
  `${currency || "NGN"} ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const date = (v) =>
  v
    ? new Date(v).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
const time = (v) =>
  v
    ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
const initials = (name = "Ehral") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className={styles.toast} role="status">
      <span className={styles.toastIcon}>
        <i className="ti ti-sparkles" />
      </span>
      <span>{message}</span>
      <button onClick={onClose} aria-label="Dismiss notification">
        <i className="ti ti-x" />
      </button>
    </div>
  );
}

function ReceiptView({ order, onClose, onDownload }) {
  if (!order) return null;
  const receiptReady = Boolean(order.receiptAvailable);
  const paid = Number(order.amountPaid || 0);
  const paymentStatus = String(order.paymentStatus || "UNPAID").toUpperCase();
  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={receiptReady ? "Purchase receipt" : "Order confirmation"}
    >
      <section className={styles.receiptModal}>
        <button
          className={styles.modalClose}
          onClick={onClose}
          aria-label="Close receipt"
        >
          <i className="ti ti-x" />
        </button>
        <div className={styles.receiptTop}>
          <div className={styles.receiptBrandRow}>
            <Logo size={112} variant="horizontal" tone="brand" title="Ehral" />
            <span className={styles.receiptSecure}>
              <i className="ti ti-shield-check" /> Secure record
            </span>
          </div>
          <div className={styles.receiptTitleBlock}>
            <div>
              <span className={styles.receiptKicker}>
                {receiptReady
                  ? "OFFICIAL PURCHASE RECEIPT"
                  : "ORDER CONFIRMATION"}
              </span>
              <h2>{order.businessName}</h2>
            </div>
            <div className={styles.receiptNumberBlock}>
              <small>{receiptReady ? "Receipt number" : "Order number"}</small>
              <strong>
                {receiptReady ? order.receiptNumber : `#${order.orderNumber}`}
              </strong>
            </div>
          </div>
        </div>
        <div className={styles.receiptBody}>
          <div className={styles.receiptBusiness}>
            <div className={styles.avatar}>
              {order.businessLogo ? (
                <img src={order.businessLogo} alt="" />
              ) : (
                initials(order.businessName)
              )}
            </div>
            <div className={styles.businessNameBlock}>
              <strong>{order.businessName}</strong>
              <small>
                Order #{order.orderNumber} · {date(order.createdAt)}
              </small>
            </div>
            <div className={styles.receiptStatus}>
              <span
                className={`${styles.statusPill} ${paymentStatus === "PAID" ? styles.status_paid : ""}`}
              >
                {paymentStatus.replaceAll("_", " ")}
              </span>
              <small>
                {receiptReady
                  ? `Issued ${date(order.receiptIssuedAt || order.createdAt)}`
                  : "Awaiting full payment"}
              </small>
            </div>
          </div>

          <div className={styles.receiptInfoGrid}>
            <div>
              <span>Customer</span>
              <strong>{order.customerName || "Ehral customer"}</strong>
              <small>{order.customerEmail || "No email on order"}</small>
              <small>{order.customerPhone || "No phone on order"}</small>
            </div>
            <div>
              <span>Fulfilment</span>
              <strong>
                {String(order.fulfillmentMethod || "Recorded").replaceAll(
                  "_",
                  " ",
                )}
              </strong>
              {order.deliveryAddress ? (
                <small>{order.deliveryAddress}</small>
              ) : (
                <small>Store collection or recorded order</small>
              )}
            </div>
            <div>
              <span>Payment</span>
              <strong>{order.paymentMethod || "Recorded payment"}</strong>
              <small>
                {receiptReady
                  ? `${money(order.currency, paid)} paid`
                  : `${money(order.currency, paid)} received`}
              </small>
            </div>
            <div>
              <span>Issued</span>
              <strong>{date(order.receiptIssuedAt || order.createdAt)}</strong>
              <small>{time(order.receiptIssuedAt || order.createdAt)}</small>
            </div>
          </div>

          <div className={styles.receiptSectionLabel}>
            <span>Purchase details</span>
            <small>
              {(order.items || []).length} line{" "}
              {(order.items || []).length === 1 ? "item" : "items"}
            </small>
          </div>
          <div className={styles.receiptLines}>
            {(order.items || []).map((item) => (
              <div
                key={item.id || item.productId}
                className={styles.receiptLine}
              >
                <div>
                  <strong>{item.productName}</strong>
                  <small>
                    {item.quantity} × {money(order.currency, item.unitPrice)}
                  </small>
                </div>
                <b>{money(order.currency, item.lineTotal)}</b>
              </div>
            ))}
          </div>

          <div className={styles.receiptTotals}>
            <div>
              <span>Subtotal</span>
              <b>{money(order.currency, order.subtotal)}</b>
            </div>
            <div>
              <span>Delivery</span>
              <b>{money(order.currency, order.deliveryFee)}</b>
            </div>
            <div>
              <span>Tax</span>
              <b>{money(order.currency, order.tax)}</b>
            </div>
            <div className={styles.receiptGrand}>
              <span>Total</span>
              <b>{money(order.currency, order.total)}</b>
            </div>
            <div className={styles.receiptPaid}>
              <span>{receiptReady ? "Amount paid" : "Amount received"}</span>
              <b>{money(order.currency, paid)}</b>
            </div>
          </div>

          {order.customerNote && (
            <div className={styles.receiptNote}>
              <i className="ti ti-note" />
              <div>
                <strong>Order note</strong>
                <span>{order.customerNote}</span>
              </div>
            </div>
          )}
          <div className={styles.receiptFooter}>
            <span>
              <i className="ti ti-shield-check" /> Verified payment record
            </span>
            <span>
              {receiptReady
                ? "Receipt stored in My Ehral"
                : "Receipt issued after full payment"}
            </span>
          </div>
          <div className={styles.receiptActions}>
            <button className={styles.secondaryAction} onClick={onClose}>
              Close
            </button>
            {receiptReady ? (
              <button
                className={styles.heroPrimary}
                onClick={() => onDownload(order)}
              >
                <i className="ti ti-file-download" /> Download premium PDF
              </button>
            ) : (
              <span className={styles.receiptPending}>
                <i className="ti ti-clock" /> Receipt available after full
                payment
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function MessagePanel({ conversation, onClose, onSent, initialDraft = "" }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState(initialDraft);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!conversation) return;
    setLoading(true);
    setError("");
    try {
      const r = await getMessages(conversation.conversationId, { limit: 80 });
      setMessages(r.data || []);
      await markRead(conversation.conversationId);
    } catch (e) {
      setError(
        e?.response?.data?.message || "We could not load this conversation.",
      );
    } finally {
      setLoading(false);
    }
  }, [conversation]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!conversation?.conversationId) return undefined;
    return subscribeToConversation(conversation.conversationId, (event) => {
      if (!event) return;
      if (
        [
          "MESSAGE_CREATED",
          "MESSAGE_UPDATED",
          "MESSAGE_DELETED",
          "MESSAGE_REACTION_UPDATED",
        ].includes(event.type)
      ) {
        const incoming = event.payload;
        if (!incoming) return;
        setMessages((current) => {
          const exists = current.some(
            (m) => String(m.id) === String(incoming.id),
          );
          if (exists)
            return current.map((m) =>
              String(m.id) === String(incoming.id) ? incoming : m,
            );
          return [...current, incoming];
        });
        if (event.type === "MESSAGE_CREATED")
          markRead(conversation.conversationId).catch(() => {});
      }
    });
  }, [conversation?.conversationId]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const body = text.trim();
    setText("");
    setError("");
    try {
      await sendMessage(conversation.conversationId, {
        messageType: "TEXT",
        body,
      });
      await load();
      onSent?.();
    } catch (e) {
      setText(body);
      setError(e?.response?.data?.message || "Your message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.chatShell}>
      <div className={styles.chatHead}>
        <div className={styles.chatIdentity}>
          <div className={styles.avatar}>
            {conversation?.businessLogo ? (
              <img src={conversation.businessLogo} alt="" />
            ) : (
              initials(conversation?.businessName)
            )}
          </div>
          <div>
            <strong>{conversation?.businessName}</strong>
            <small>
              <span className={styles.onlineDot} /> Ehral native messaging
            </small>
          </div>
        </div>
        <button
          className={styles.iconButton}
          onClick={onClose}
          aria-label="Close chat"
        >
          <i className="ti ti-x" />
        </button>
      </div>
      <div className={styles.chatMessages}>
        {loading ? (
          <div className={styles.inlineLoading}>
            <span /> Loading conversation…
          </div>
        ) : messages.length ? (
          messages.map((m) => (
            <div
              key={m.id}
              className={`${styles.bubbleRow} ${m.senderIdentityId === conversation.myIdentityId ? styles.mine : ""}`}
            >
              <div className={styles.bubble}>
                <span>{m.body}</span>
                <small>{time(m.createdAt)}</small>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyChat}>
            <i className="ti ti-message-circle-2" />
            <strong>Start the conversation</strong>
            <span>
              Ask about products, orders, delivery, availability or anything
              else.
            </span>
          </div>
        )}
      </div>
      {error && <div className={styles.chatError}>{error}</div>}
      <div className={styles.chatComposer}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a message…"
          rows={1}
          aria-label="Message"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          aria-label="Send message"
        >
          <i className={sending ? "ti ti-loader-2" : "ti ti-send"} />
        </button>
      </div>
    </div>
  );
}

function BusinessCard({ business, onVisit, onChat, detailed }) {
  return (
    <article className={styles.businessCard}>
      <div className={styles.businessIdentity}>
        <div className={styles.businessLogo}>
          {business.businessLogo ? (
            <img src={business.businessLogo} alt="" />
          ) : (
            initials(business.businessName)
          )}
        </div>
        <div className={styles.businessNameBlock}>
          <strong>{business.businessName}</strong>
          <small>
            {business.ordersCount} order{business.ordersCount === 1 ? "" : "s"}{" "}
            · {money(business.currency, business.totalSpent)} spent
          </small>
        </div>
        <span
          className={`${styles.connectedBadge} ${business.storefrontActive === false ? styles.connectedBadgeMuted : ""}`}
        >
          <i
            className={
              business.storefrontActive === false
                ? "ti ti-info-circle"
                : "ti ti-circle-check-filled"
            }
          />{" "}
          {business.storefrontActive === false
            ? "Connected · Store unavailable"
            : "Connected"}
        </span>
      </div>
      {detailed && (
        <div className={styles.businessMeta}>
          <span>
            <i className="ti ti-user-check" /> Customer relationship
          </span>
          <span>
            <i className="ti ti-shield-check" /> Protected by Ehral
          </span>
        </div>
      )}
      <div className={styles.cardActions}>
        <button
          onClick={() => onVisit(business)}
          disabled={
            !business.businessSlug || business.storefrontActive === false
          }
        >
          View business <i className="ti ti-arrow-up-right" />
        </button>
        <button
          className={styles.secondaryAction}
          onClick={() => onChat(business)}
        >
          Message <i className="ti ti-message-circle" />
        </button>
      </div>
    </article>
  );
}

function OrderList({ orders, onReceipt }) {
  if (!orders.length) {
    return (
      <div className={styles.emptyState}>
        <i className="ti ti-shopping-bag" />
        <h3>No orders yet</h3>
        <p>Your purchases will appear here once you shop through Ehral.</p>
      </div>
    );
  }
  return (
    <div className={styles.orderList}>
      {orders.map((o) => (
        <article className={styles.orderRow} key={o.id}>
          <div className={styles.orderStore}>
            <div className={styles.avatar}>
              {o.businessLogo ? (
                <img src={o.businessLogo} alt="" />
              ) : (
                initials(o.businessName)
              )}
            </div>
            <div>
              <strong>{o.businessName}</strong>
              <small>
                #{o.orderNumber} · {date(o.createdAt)}
              </small>
            </div>
          </div>
          <div className={styles.orderItems}>
            {(o.items || []).slice(0, 2).map((i) => (
              <span key={i.id || i.productId}>
                {i.productName} × {i.quantity}
              </span>
            ))}
            {(o.items || []).length > 2 && (
              <span>+{o.items.length - 2} more</span>
            )}
          </div>
          <div className={styles.orderStatus}>
            <span
              className={`${styles.statusPill} ${styles[`status_${String(o.status || "").toLowerCase()}`] || ""}`}
            >
              {String(o.status || "RECORDED").replaceAll("_", " ")}
            </span>
            <strong>{money(o.currency, o.total)}</strong>
          </div>
          <button
            className={styles.receiptButton}
            onClick={() => onReceipt(o)}
            disabled={!o.receiptAvailable}
          >
            <i className="ti ti-receipt" />{" "}
            {o.receiptAvailable ? "Receipt" : "Payment pending"}
          </button>
        </article>
      ))}
    </div>
  );
}

function ConversationList({ conversations, onOpen, large }) {
  if (!conversations.length) {
    return (
      <div className={styles.emptyState}>
        <i className="ti ti-message-off" />
        <h3>No conversations yet</h3>
        <p>Open a business and start a conversation with its team.</p>
      </div>
    );
  }
  return (
    <div
      className={`${styles.conversationList} ${large ? styles.conversationListLarge : ""}`}
    >
      {conversations.map((c) => {
        const s = c.summary || c;
        return (
          <button
            className={styles.conversationRow}
            key={c.conversationId || s.id}
            onClick={() => onOpen(c)}
          >
            <div className={styles.avatar}>
              {c.businessLogo ? (
                <img src={c.businessLogo} alt="" />
              ) : (
                initials(c.businessName || s.name)
              )}
            </div>
            <div className={styles.conversationCopy}>
              <strong>{c.businessName || s.name}</strong>
              <span>
                {s.lastMessagePreview ||
                  "Start a conversation with this business"}
              </span>
            </div>
            <div className={styles.conversationMeta}>
              {s.lastMessageAt && <small>{date(s.lastMessageAt)}</small>}
              {s.unreadCount > 0 && <em>{s.unreadCount}</em>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DiscoveryCard({ business, onView }) {
  return (
    <article className={styles.businessCard}>
      <div className={styles.businessIdentity}>
        <div className={styles.businessLogo}>
          {business.businessLogo ? (
            <img src={business.businessLogo} alt="" />
          ) : (
            initials(business.businessName)
          )}
        </div>
        <div className={styles.businessNameBlock}>
          <strong>{business.businessName}</strong>
          <small>
            {business.businessTypeLabel ||
              business.businessType ||
              "Ehral business"}
            {business.businessCategory ? ` · ${business.businessCategory}` : ""}
          </small>
        </div>
        <span
          className={`${styles.connectedBadge} ${business.connected ? "" : styles.connectedBadgeMuted}`}
        >
          <i
            className={
              business.connected ? "ti ti-circle-check-filled" : "ti ti-compass"
            }
          />
          {business.connected ? "Connected" : "Discoverable"}
        </span>
      </div>
      <div className={styles.businessMeta}>
        {business.address && (
          <span>
            <i className="ti ti-map-pin" /> {business.address}
          </span>
        )}
        {business.storefrontActive && (
          <span>
            <i className="ti ti-building-store" /> Store available
          </span>
        )}
      </div>
      {business.description && (
        <p className={styles.discoveryDescription}>{business.description}</p>
      )}
      <div className={styles.cardActions}>
        <button onClick={() => onView(business)}>
          View business <i className="ti ti-arrow-up-right" />
        </button>
      </div>
    </article>
  );
}

export default function CustomerDashboard() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout: contextLogout } = useAuth();
  useMessagingConnection();
  const [tab, setTab] = useState("home");
  const [data, setData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [discovery, setDiscovery] = useState([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryType, setDiscoveryType] = useState("");
  const [businessTypes, setBusinessTypes] = useState([]);
  const [profileForm, setProfileForm] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getCustomerOverview();
      setData(r.data);
    } catch (e) {
      setNotice(
        e?.response?.data?.message || "We could not load your Ehral account.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    setMessageLoading(true);
    try {
      const r = await listCustomerConversations();
      setMessages(r.data || []);
    } catch (e) {
      setNotice(
        e?.response?.data?.message || "We could not load your conversations.",
      );
    } finally {
      setMessageLoading(false);
    }
  }, []);

  const loadDiscovery = useCallback(
    async (q = discoveryQuery, type = discoveryType) => {
      setDiscoveryLoading(true);
      try {
        const r = await discoverCustomerBusinesses({
          q: q.trim() || undefined,
          type: type || undefined,
        });
        setDiscovery(r.data || []);
      } catch (e) {
        setNotice(
          e?.response?.data?.message ||
            "We could not load businesses on Ehral.",
        );
      } finally {
        setDiscoveryLoading(false);
      }
    },
    [discoveryQuery, discoveryType],
  );

  useEffect(() => {
    load();
    loadMessages();
    getCustomerBusinessTypes()
      .then(({ data: types }) => setBusinessTypes(types || []))
      .catch(() => {});
  }, [load, loadMessages]);

  useEffect(() => {
    return subscribeToUserQueue((event) => {
      if (!event) return;
      if (
        [
          "CONVERSATION_CREATED",
          "CONVERSATION_UPDATED",
          "NEW_MESSAGE_NOTIFICATION",
          "MESSAGE_MENTION",
        ].includes(event.type)
      )
        loadMessages();
    });
  }, [loadMessages]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (
      requestedTab &&
      [
        "home",
        "discover",
        "businesses",
        "orders",
        "receipts",
        "messages",
        "spending",
        "account",
      ].includes(requestedTab)
    ) {
      setTab(requestedTab);
      if (requestedTab === "discover") loadDiscovery();
    }
  }, [searchParams, loadDiscovery]);

  useEffect(() => {
    if (tab === "discover" && !discovery.length) loadDiscovery();
  }, [tab]);

  useEffect(() => {
    if (tab !== "account" || profileForm) return undefined;
    let cancelled = false;
    getCustomerProfile()
      .then(({ data: profile }) => {
        if (!cancelled) setProfileForm(profile);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, profileForm]);

  useEffect(() => {
    if (tab !== "discover") return undefined;
    const timer = window.setTimeout(() => loadDiscovery(), 250);
    return () => window.clearTimeout(timer);
  }, [discoveryQuery, discoveryType]);

  useEffect(() => {
    const conversationId = searchParams.get("chat");
    if (!conversationId || !messages.length) return;
    const found = messages.find(
      (m) => String(m.conversationId) === String(conversationId),
    );
    if (found) {
      const draft =
        sessionStorage.getItem(`ehral:pending-chat:${conversationId}`) || "";
      sessionStorage.removeItem(`ehral:pending-chat:${conversationId}`);
      setActiveChat({
        ...found,
        conversationId: found.conversationId,
        businessName: found.businessName,
        businessLogo: found.businessLogo,
        myIdentityId: user?.identityId,
        initialDraft: draft,
      });
      setTab("messages");
      setSearchParams({}, { replace: true });
    }
  }, [messages, searchParams, setSearchParams, user?.identityId]);

  const businesses = data?.businesses || [];
  const orders = data?.orders || [];
  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      [
        o.businessName,
        o.orderNumber,
        o.status,
        ...(o.items || []).map((i) => i.productName),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [orders, query]);
  const completed = orders.filter(
    (o) => String(o.paymentStatus || "").toUpperCase() === "PAID",
  );
  const average = completed.length
    ? Number(data?.totalSpent || 0) / completed.length
    : 0;
  const unread = messages.reduce(
    (sum, c) => sum + Number(c.summary?.unreadCount || c.unreadCount || 0),
    0,
  );

  const attentionItems = useMemo(() => {
    const items = [];
    const pendingOrders = orders.filter((o) =>
      [
        "PENDING",
        "PROCESSING",
        "CONFIRMED",
        "READY",
        "READY_FOR_PICKUP",
        "OUT_FOR_DELIVERY",
      ].includes(String(o.status || "").toUpperCase()),
    );
    pendingOrders.slice(0, 2).forEach((o) => {
      items.push({
        id: `order-${o.id}`,
        icon: "shopping-bag",
        title: `Order #${o.orderNumber} is ${String(o.status || "processing")
          .replaceAll("_", " ")
          .toLowerCase()}`,
        text: `${o.businessName} · ${money(o.currency, o.total)}`,
        action: () => setSelectedOrder(o),
        actionLabel: "View order",
      });
    });
    if (unread > 0) {
      const firstUnread = messages.find(
        (m) => Number((m.summary || m).unreadCount || 0) > 0,
      );
      items.push({
        id: "messages",
        icon: "message-circle",
        title: `${unread} unread business message${unread === 1 ? "" : "s"}`,
        text: firstUnread?.businessName
          ? `From ${firstUnread.businessName}`
          : "A business is waiting for your response",
        action: () => {
          setTab("messages");
          loadMessages();
        },
        actionLabel: "Open messages",
      });
    }
    const unpaid = orders.find(
      (o) =>
        !o.receiptAvailable && Number(o.amountPaid || 0) < Number(o.total || 0),
    );
    if (unpaid && !pendingOrders.some((o) => o.id === unpaid.id)) {
      items.push({
        id: `payment-${unpaid.id}`,
        icon: "receipt",
        title: `Receipt pending for order #${unpaid.orderNumber}`,
        text: `${unpaid.businessName} · Receipt becomes available after full payment`,
        action: () => setSelectedOrder(unpaid),
        actionLabel: "Review order",
      });
    }
    return items.slice(0, 3);
  }, [orders, messages, unread, loadMessages]);

  const activity = useMemo(() => {
    const orderActivity = orders.slice(0, 5).map((o) => ({
      id: `order-${o.id}`,
      icon: "shopping-bag",
      title: `Order ${o.orderNumber}`,
      text: `${o.businessName} · ${money(o.currency, o.total)}`,
      date: o.createdAt,
      action: () => setSelectedOrder(o),
    }));
    const messageActivity = messages.slice(0, 5).map((m) => {
      const s = m.summary || m;
      return {
        id: `message-${m.conversationId || s.id}`,
        icon: "message-circle",
        title: m.businessName || s.name || "Business message",
        text: s.lastMessagePreview || "Conversation updated",
        date: s.lastMessageAt,
        action: () => setActiveChat({ ...m, myIdentityId: user?.identityId }),
      };
    });
    return [...orderActivity, ...messageActivity]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 6);
  }, [orders, messages, user?.identityId]);

  const changeTab = (id) => {
    setTab(id);
    setMobileMoreOpen(false);
    if (id === "messages") loadMessages();
    if (id === "discover") loadDiscovery();
  };

  const visitBusiness = (business) => {
    if (business?.businessId) nav(`/customer/business/${business.businessId}`);
    else setNotice("This business could not be opened.");
  };

  const openBusinessChat = async (business) => {
    try {
      const r = await createCustomerBusinessConversation(business.businessId);
      await loadMessages();
      setActiveChat({
        conversationId: r.data.id,
        businessId: business.businessId,
        businessName: business.businessName,
        businessLogo: business.businessLogo,
        myIdentityId: user?.identityId,
      });
      setTab("messages");
    } catch (e) {
      setNotice(
        e?.response?.data?.message ||
          "Messaging is temporarily unavailable for this business.",
      );
    }
  };

  const downloadReceipt = async (order) => {
    try {
      const response = await getCustomerReceiptPdf(order.id);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Ehral-${order.orderNumber}-receipt.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setNotice(
        e?.response?.data?.message || "The receipt PDF is not available yet.",
      );
    }
  };

  const saveProfile = async () => {
    if (!profileForm || savingProfile) return;
    setSavingProfile(true);
    setNotice("");
    try {
      const r = await updateCustomerProfile(profileForm);
      setProfileForm(r.data);
      setEditingProfile(false);
      await load();
      setNotice("Your Ehral profile has been updated.");
    } catch (e) {
      setNotice(
        e?.response?.data?.message || "We could not update your profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const signOut = async () => {
    try {
      await contextLogout();
      nav("/login", { replace: true });
    } catch (e) {
      setNotice("We could not sign you out cleanly. Please try again.");
    }
  };

  if (loading && !data) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingBrand}>
          <Logo size={126} variant="horizontal" tone="brand" title="Ehral" />
        </div>
        <span>Preparing your customer hub…</span>
      </div>
    );
  }

  const navItems = [
    ["home", "Dashboard", "layout-dashboard"],
    ["discover", "Discover", "compass"],
    ["businesses", "My businesses", "building-store"],
    ["orders", "Orders", "shopping-bag"],
    ["receipts", "Receipts", "receipt"],
    ["messages", "Messages", "messages"],
    ["spending", "Spending", "chart-donut"],
    ["account", "Account", "user-circle"],
  ];
  const title = navItems.find((x) => x[0] === tab)?.[1] || "Dashboard";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Logo size={62} variant="horizontal" tone="sidebar" title="Ehral" />
        </div>
        <div className={styles.profileMini}>
          <div className={styles.profileAvatar}>
            {initials(`${data?.firstName || ""} ${data?.lastName || ""}`)}
          </div>
          <div>
            <strong>{data?.firstName || "Customer"}</strong>
            <small>Customer account</small>
          </div>
        </div>
        <nav>
          {navItems.map(([id, label, icon]) => (
            <button
              key={id}
              className={tab === id ? styles.navActive : ""}
              onClick={() => changeTab(id)}
            >
              <i className={`ti ti-${icon}`} />
              <span>{label}</span>
              {id === "messages" && unread > 0 && (
                <em>{unread > 9 ? "9+" : unread}</em>
              )}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <button onClick={() => changeTab("account")}>
            <i className="ti ti-settings" /> Account settings
          </button>
          <button onClick={signOut}>
            <i className="ti ti-logout-2" /> Sign out
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button
            className={styles.mobileBrand}
            onClick={() => changeTab("home")}
          >
            <Logo size={48} variant="horizontal" tone="brand" title="Ehral" />
          </button>
          <div className={styles.topTitle}>
            <span>MY EHRAL</span>
            <h1>{title}</h1>
          </div>
          <div className={styles.topActions}>
            <label className={styles.searchButton}>
              <i className="ti ti-search" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search orders…"
                aria-label="Search orders"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <i className="ti ti-x" />
                </button>
              )}
            </label>
            {/* Light/dark switch — same self-contained component as the
                employer dashboard (src/theme/ThemeToggleMenu.jsx), so
                switching themes here behaves identically everywhere. */}
            <ThemeToggleMenu />
            <button
              className={styles.avatarButton}
              onClick={() => changeTab("account")}
              aria-label="Open account"
            >
              {initials(`${data?.firstName || ""} ${data?.lastName || ""}`)}
            </button>
          </div>
        </header>

        <Toast message={notice} onClose={() => setNotice("")} />

        <div className={styles.content}>
          {tab === "home" && (
            <>
              <section className={styles.hero}>
                <div className={styles.heroCopy}>
                  <span className={styles.eyebrow}>
                    YOUR PERSONAL COMMERCE HUB
                  </span>
                  <h2>Good to see you, {data?.firstName || "there"}.</h2>
                  <p>
                    One Ehral account for your stores, orders, receipts,
                    conversations and spending history.
                  </p>
                  <div className={styles.heroActions}>
                    <button
                      onClick={() => changeTab("discover")}
                      className={styles.heroPrimary}
                    >
                      Discover businesses <i className="ti ti-arrow-up-right" />
                    </button>
                    <button
                      onClick={() => changeTab("messages")}
                      className={styles.heroSecondary}
                    >
                      <i className="ti ti-message-circle" /> Messages{" "}
                      {unread > 0 && <span>{unread}</span>}
                    </button>
                  </div>
                </div>
                <div className={styles.heroOrb}>
                  <span />
                  <span />
                  <i className="ti ti-sparkles" />
                </div>
              </section>

              <section className={styles.stats}>
                <div>
                  <span>Total spent</span>
                  <strong>{money(data?.currency, data?.totalSpent)}</strong>
                  <small>Across connected businesses</small>
                </div>
                <div>
                  <span>Orders</span>
                  <strong>{data?.totalOrders || 0}</strong>
                  <small>Purchase history</small>
                </div>
                <div>
                  <span>Businesses</span>
                  <strong>{businesses.length}</strong>
                  <small>Your Ehral network</small>
                </div>
                <div>
                  <span>Average order</span>
                  <strong>{money(data?.currency, average)}</strong>
                  <small>Based on recorded orders</small>
                </div>
              </section>

              <section
                className={styles.attentionSection}
                aria-label="Needs your attention"
              >
                <div className={styles.attentionHead}>
                  <div>
                    <span className={styles.eyebrow}>RIGHT NOW</span>
                    <h2>Needs your attention</h2>
                  </div>
                  {attentionItems.length === 0 && (
                    <span className={styles.allCaughtUp}>
                      <i className="ti ti-circle-check-filled" /> All caught up
                    </span>
                  )}
                </div>
                {attentionItems.length ? (
                  <div className={styles.attentionList}>
                    {attentionItems.map((item) => (
                      <button
                        key={item.id}
                        className={styles.attentionItem}
                        onClick={item.action}
                      >
                        <span className={styles.attentionIcon}>
                          <i className={`ti ti-${item.icon}`} />
                        </span>
                        <span className={styles.attentionCopy}>
                          <strong>{item.title}</strong>
                          <small>{item.text}</small>
                        </span>
                        <span className={styles.attentionAction}>
                          {item.actionLabel}
                          <i className="ti ti-arrow-right" />
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.attentionEmpty}>
                    Your orders, messages and receipts do not need any action
                    right now.
                  </p>
                )}
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <div>
                    <span className={styles.eyebrow}>YOUR NETWORK</span>
                    <h2>Businesses you use</h2>
                  </div>
                  <button onClick={() => changeTab("businesses")}>
                    View all <i className="ti ti-arrow-right" />
                  </button>
                </div>
                {businesses.length ? (
                  <div className={styles.businessGrid}>
                    {businesses.slice(0, 4).map((b) => (
                      <BusinessCard
                        key={b.membershipId}
                        business={b}
                        onVisit={visitBusiness}
                        onChat={openBusinessChat}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <i className="ti ti-building-store" />
                    <h3>No connected businesses yet</h3>
                    <p>
                      Connect with businesses on Ehral and they will appear here
                      as part of your customer network.
                    </p>
                  </div>
                )}
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <div>
                    <span className={styles.eyebrow}>LATEST</span>
                    <h2>Recent orders</h2>
                  </div>
                  <button onClick={() => changeTab("orders")}>See all</button>
                </div>
                <OrderList
                  orders={orders.slice(0, 5)}
                  onReceipt={setSelectedOrder}
                />
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <div>
                    <span className={styles.eyebrow}>LIVE ACTIVITY</span>
                    <h2>Recent activity</h2>
                  </div>
                </div>
                <div className={styles.activityList}>
                  {activity.length ? (
                    activity.map((a) => (
                      <button
                        key={a.id}
                        className={styles.activityRow}
                        onClick={a.action}
                      >
                        <span className={styles.activityIcon}>
                          <i className={`ti ti-${a.icon}`} />
                        </span>
                        <span className={styles.activityCopy}>
                          <strong>{a.title}</strong>
                          <small>{a.text}</small>
                        </span>
                        <span className={styles.activityDate}>
                          {date(a.date)} {time(a.date)}
                        </span>
                        <i className="ti ti-chevron-right" />
                      </button>
                    ))
                  ) : (
                    <div className={styles.emptyState}>
                      <i className="ti ti-sparkles" />
                      <h3>Your activity will appear here</h3>
                      <p>
                        Orders and business conversations will build your Ehral
                        timeline.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {tab === "discover" && (
            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <span className={styles.eyebrow}>DISCOVER ON EHRAL</span>
                <h2>Find businesses and services</h2>
                <p>
                  Search Ehral for businesses you need, explore their
                  information, and connect with the ones you choose.
                </p>
              </div>
              <div className={styles.discoveryToolbar}>
                <label className={styles.discoverySearch}>
                  <i className="ti ti-search" />
                  <input
                    value={discoveryQuery}
                    onChange={(e) => setDiscoveryQuery(e.target.value)}
                    placeholder="Search business, category, or location…"
                    aria-label="Search businesses"
                  />
                  {discoveryQuery && (
                    <button
                      type="button"
                      onClick={() => setDiscoveryQuery("")}
                      aria-label="Clear search"
                    >
                      <i className="ti ti-x" />
                    </button>
                  )}
                </label>
                <div className={styles.discoveryTypes}>
                  <button
                    className={!discoveryType ? styles.discoveryTypeActive : ""}
                    onClick={() => setDiscoveryType("")}
                  >
                    All
                  </button>
                  {businessTypes.map((type) => (
                    <button
                      key={type}
                      className={
                        discoveryType === type ? styles.discoveryTypeActive : ""
                      }
                      onClick={() => setDiscoveryType(type)}
                    >
                      {type
                        .replaceAll("_", " ")
                        .replace(/\b\w/g, (m) => m.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
              {discoveryLoading ? (
                <div className={styles.inlineLoading}>
                  <span /> Finding businesses on Ehral…
                </div>
              ) : discovery.length ? (
                <div className={styles.businessGrid}>
                  {discovery.map((b) => (
                    <DiscoveryCard
                      key={b.businessId}
                      business={b}
                      onView={(business) =>
                        nav(`/customer/business/${business.businessId}`)
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <i className="ti ti-compass-off" />
                  <h3>No matching businesses yet</h3>
                  <p>Try another business name, category, or location.</p>
                </div>
              )}
            </section>
          )}

          {tab === "businesses" && (
            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <span className={styles.eyebrow}>CONNECTED TO EHRAL</span>
                <h2>Your businesses</h2>
                <p>
                  Every business where you have an active customer relationship.
                  One account, many stores.
                </p>
              </div>
              <div className={styles.businessGrid}>
                {businesses.map((b) => (
                  <BusinessCard
                    key={b.membershipId}
                    business={b}
                    onVisit={visitBusiness}
                    onChat={openBusinessChat}
                    detailed
                  />
                ))}
              </div>
            </section>
          )}

          {tab === "orders" && (
            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <span className={styles.eyebrow}>PURCHASE HISTORY</span>
                <h2>Your orders</h2>
                <p>
                  Everything you have bought through your Ehral customer
                  account.
                </p>
              </div>
              <OrderList orders={filteredOrders} onReceipt={setSelectedOrder} />
            </section>
          )}

          {tab === "receipts" && (
            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <span className={styles.eyebrow}>YOUR PAPER TRAIL</span>
                <h2>Receipts</h2>
                <p>
                  Receipts generated from your Ehral purchases remain available
                  here, even after you leave a store.
                </p>
              </div>
              <div className={styles.receiptGrid}>
                {filteredOrders
                  .filter((o) => o.receiptAvailable)
                  .map((o) => (
                    <button
                      key={o.id}
                      className={styles.receiptCard}
                      onClick={() => setSelectedOrder(o)}
                    >
                      <div className={styles.receiptCardTop}>
                        <div className={styles.avatar}>
                          {o.businessLogo ? (
                            <img src={o.businessLogo} alt="" />
                          ) : (
                            initials(o.businessName)
                          )}
                        </div>
                        <span>{o.paymentStatus || "RECORDED"}</span>
                      </div>
                      <strong>{o.businessName}</strong>
                      <small>
                        #{o.orderNumber} · {date(o.createdAt)}
                      </small>
                      <b>{money(o.currency, o.total)}</b>
                      <em>
                        View receipt <i className="ti ti-arrow-up-right" />
                      </em>
                    </button>
                  ))}
              </div>
              {!filteredOrders.some((o) => o.receiptAvailable) && (
                <div className={styles.emptyState}>
                  <i className="ti ti-receipt-off" />
                  <h3>No receipts yet</h3>
                  <p>Your completed Ehral purchases will appear here.</p>
                </div>
              )}
            </section>
          )}

          {tab === "messages" && (
            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <span className={styles.eyebrow}>EHRAL NATIVE MESSAGING</span>
                <h2>Your conversations</h2>
                <p>
                  Talk directly with businesses you are connected to without
                  leaving Ehral.
                </p>
              </div>
              <div className={styles.messageList}>
                {messageLoading ? (
                  <div className={styles.inlineLoading}>
                    <span /> Loading conversations…
                  </div>
                ) : (
                  <ConversationList
                    conversations={messages}
                    onOpen={(c) =>
                      setActiveChat({ ...c, myIdentityId: user?.identityId })
                    }
                    large
                  />
                )}
              </div>
            </section>
          )}

          {tab === "spending" && (
            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <span className={styles.eyebrow}>YOUR MONEY TRAIL</span>
                <h2>Spending</h2>
                <p>
                  A clear view of payments completed across your Ehral
                  businesses, net of recorded refunds.
                </p>
              </div>
              <div className={styles.spendingHero}>
                <div>
                  <span>Total recorded spend</span>
                  <strong>{money(data?.currency, data?.totalSpent)}</strong>
                  <small>{completed.length} fully paid orders</small>
                </div>
                <div className={styles.spendingRing}>
                  <i className="ti ti-chart-donut" />
                </div>
              </div>
              <div className={styles.spendingList}>
                {businesses.map((b) => {
                  const share = data?.totalSpent
                    ? Math.min(
                        100,
                        (Number(b.totalSpent || 0) / Number(data.totalSpent)) *
                          100,
                      )
                    : 0;
                  return (
                    <div className={styles.spendRow} key={b.membershipId}>
                      <div className={styles.spendIdentity}>
                        <div className={styles.avatar}>
                          {b.businessLogo ? (
                            <img src={b.businessLogo} alt="" />
                          ) : (
                            initials(b.businessName)
                          )}
                        </div>
                        <div>
                          <strong>{b.businessName}</strong>
                          <small>
                            {b.ordersCount} order
                            {b.ordersCount === 1 ? "" : "s"}
                          </small>
                        </div>
                      </div>
                      <div className={styles.spendValue}>
                        <strong>{money(b.currency, b.totalSpent)}</strong>
                        <div>
                          <span style={{ width: `${share}%` }} />
                        </div>
                        <small>{share.toFixed(1)}% of total spend</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {tab === "account" && (
            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <span className={styles.eyebrow}>ACCOUNT & SECURITY</span>
                <h2>Your Ehral profile</h2>
                <p>
                  Your identity follows you across every Ehral business
                  relationship.
                </p>
              </div>
              <div className={styles.accountCard}>
                <div className={styles.accountAvatar}>
                  {initials(
                    `${profileForm?.firstName || data?.firstName || ""} ${profileForm?.lastName || data?.lastName || ""}`,
                  )}
                </div>
                <div>
                  <h3>
                    {profileForm?.firstName || data?.firstName}{" "}
                    {profileForm?.lastName || data?.lastName}
                  </h3>
                  <p>{profileForm?.email || data?.email || "No email added"}</p>
                  <p>
                    {profileForm?.phone || data?.phone}{" "}
                    <span className={styles.verifiedPill}>
                      <i className="ti ti-circle-check-filled" /> Verified
                    </span>
                  </p>
                </div>
                <div className={styles.accountActions}>
                  <button
                    onClick={() => setEditingProfile((v) => !v)}
                    className={styles.accountAction}
                  >
                    <i className="ti ti-user-edit" />{" "}
                    {editingProfile ? "Close editor" : "Edit profile"}
                  </button>
                  <button
                    onClick={() => nav("/forgot-password")}
                    className={styles.accountAction}
                  >
                    Change password <i className="ti ti-arrow-up-right" />
                  </button>
                </div>
              </div>
              {editingProfile && profileForm && (
                <div className={styles.profileEditor}>
                  <div className={styles.profileEditorGrid}>
                    {[
                      ["firstName", "First name"],
                      ["middleName", "Middle name"],
                      ["lastName", "Last name"],
                      ["email", "Email"],
                    ].map(([key, label]) => (
                      <label key={key}>
                        <span>{label}</span>
                        <input
                          type={key === "email" ? "email" : "text"}
                          value={profileForm[key] || ""}
                          onChange={(e) =>
                            setProfileForm((p) => ({
                              ...p,
                              [key]: e.target.value,
                            }))
                          }
                        />
                      </label>
                    ))}
                    <label>
                      <span>Phone</span>
                      <input value={profileForm.phone || ""} readOnly />
                      <small>
                        Your phone is your verified identity anchor and cannot
                        be changed from this form.
                      </small>
                    </label>
                    <label>
                      <span>Date of birth</span>
                      <input
                        type="date"
                        value={profileForm.dateOfBirth || ""}
                        onChange={(e) =>
                          setProfileForm((p) => ({
                            ...p,
                            dateOfBirth: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Gender</span>
                      <input
                        value={profileForm.gender || ""}
                        onChange={(e) =>
                          setProfileForm((p) => ({
                            ...p,
                            gender: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className={styles.profileEditorWide}>
                      <span>Address</span>
                      <textarea
                        value={profileForm.address || ""}
                        onChange={(e) =>
                          setProfileForm((p) => ({
                            ...p,
                            address: e.target.value,
                          }))
                        }
                        rows={2}
                      />
                    </label>
                    <label>
                      <span>Emergency contact name</span>
                      <input
                        value={profileForm.emergencyContactName || ""}
                        onChange={(e) =>
                          setProfileForm((p) => ({
                            ...p,
                            emergencyContactName: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Emergency contact phone</span>
                      <input
                        value={profileForm.emergencyContactPhone || ""}
                        onChange={(e) =>
                          setProfileForm((p) => ({
                            ...p,
                            emergencyContactPhone: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className={styles.profileEditorFooter}>
                    <span>
                      Changes apply to your Ehral identity and follow you across
                      your relationships.
                    </span>
                    <button
                      className={styles.heroPrimary}
                      onClick={saveProfile}
                      disabled={savingProfile}
                    >
                      {savingProfile ? "Saving…" : "Save profile"}
                    </button>
                  </div>
                </div>
              )}
              <div className={styles.securityGrid}>
                <div>
                  <i className="ti ti-lock" />
                  <strong>Password protected</strong>
                  <span>Your account uses your Ehral password.</span>
                </div>
                <div>
                  <i className="ti ti-device-mobile-check" />
                  <strong>Phone verified</strong>
                  <span>Your phone is your verified identity anchor.</span>
                </div>
                <div>
                  <i className="ti ti-building-store" />
                  <strong>{businesses.length} connected businesses</strong>
                  <span>One identity, many relationships.</span>
                </div>
              </div>
              <div className={styles.accountInfo}>
                <span className={styles.eyebrow}>YOUR EHRAL IDENTITY</span>
                <h3>One secure account across your commerce life.</h3>
                <p>
                  Your customer identity, orders, receipts and conversations
                  stay connected while each business keeps control of its own
                  products and operations.
                </p>
                <button onClick={signOut} className={styles.dangerAction}>
                  <i className="ti ti-logout-2" /> Sign out of Ehral
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      <MobileNavHub
        role="customer"
        activeNav={tab}
        setActiveNav={changeTab}
        navigate={nav}
        badges={{ Messages: unread }}
      />

      {selectedOrder && (
        <ReceiptView
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onDownload={downloadReceipt}
        />
      )}
      {activeChat && (
        <div className={styles.chatOverlay}>
          <MessagePanel
            conversation={activeChat}
            initialDraft={activeChat.initialDraft || ""}
            onClose={() => setActiveChat(null)}
            onSent={loadMessages}
          />
        </div>
      )}
    </div>
  );
}
