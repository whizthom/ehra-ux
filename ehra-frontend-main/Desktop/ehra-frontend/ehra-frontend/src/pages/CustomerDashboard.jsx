import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../components/Logo";
import CustomerShell from "../components/CustomerShell";
import { CUSTOMER_NAV_ITEMS } from "../utils/customerNav";
import {
  getCustomerOverview,
  getCustomerReceiptPdf,
  discoverCustomerBusinesses,
  getCustomerBusinessTypes,
  getCustomerProfile,
  updateCustomerProfile,
  uploadCustomerProfilePicture,
  getMySalesApprovals,
  approveSaleApproval,
  declineSaleApproval,
  getMyPosReceipts,
} from "../api/commerceApi";
import { createCustomerBusinessConversation } from "../api/messagingApi";
import {
  payForOrderOnline,
  verifyOrderPayment,
  initializeOrderBankTransfer,
  initializeOrderUssd,
  initializeOrderBank,
  listOrderPayWithBankBanks,
} from "../api/orderPaymentApi";
import { useAuth } from "../context/AuthContext";
import useMessagingConnection from "../hooks/useMessagingConnection";
import { subscribeToUserQueue } from "../services/messagingSocket";
import useBusinessConnection from "../hooks/useBusinessConnection";
import useConversations from "../hooks/useConversations";
import useCustomerInboxBadge from "../hooks/useCustomerInboxBadge";
import MessagingHub from "../components/messaging/MessagingHub";
import NotificationToastStack from "../components/notifications/NotificationToastStack";
import BusinessCard from "../components/BusinessCard";
import BrandSplash from "../components/BrandSplash";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import DisconnectConfirmModal from "../components/DisconnectConfirmModal";
import PremiumReceipt from "../components/PremiumReceipt";
import styles from "./CustomerDashboard.module.css";
import NotificationCenter, { NotificationsPageView } from "../components/notifications/NotificationCenter";
import { getCustomerNotifications, getCustomerUnreadCount, markAllCustomerRead } from "../api/notificationApi";

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
// 1.2K / 3.4M style labels for the little numbers above the spending bars.
const compactMoney = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
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

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const greetingFor = (d = new Date()) => {
  const h = d.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

// Everything the Spending page shows, derived from the orders the overview
// already returns - no extra request. Only fully PAID orders count, and the
// month chart only sums orders in the account's main currency (adding naira
// to dollars would be meaningless); anything in another currency is reported
// in a footnote instead.
function buildSpending(orders, businesses, data, now = new Date()) {
  const currency = data?.currency;
  const paid = orders.filter(
    (o) => String(o.paymentStatus || "").toUpperCase() === "PAID",
  );
  const main = paid.filter(
    (o) => !o.currency || !currency || o.currency === currency,
  );
  const amountOf = (o) => Number(o.amountPaid) || Number(o.total) || 0;

  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTHS[d.getMonth()],
      year: d.getFullYear(),
      value: 0,
      count: 0,
      current: i === 0,
    });
  }
  main.forEach((o) => {
    const d = new Date(o.createdAt);
    if (Number.isNaN(d.getTime())) return;
    const bucket = months.find(
      (m) => m.key === `${d.getFullYear()}-${d.getMonth()}`,
    );
    if (bucket) {
      bucket.value += amountOf(o);
      bucket.count += 1;
    }
  });
  const max = Math.max(0, ...months.map((m) => m.value));
  const cur = months[months.length - 1].value;
  const prev = months[months.length - 2].value;

  const total = Number(data?.totalSpent || 0);
  const ranked = businesses
    .filter((b) => Number(b.totalSpent || 0) > 0)
    .map((b) => ({
      ...b,
      spent: Number(b.totalSpent || 0),
      share: total > 0 ? (Number(b.totalSpent || 0) / total) * 100 : 0,
    }))
    .sort((a, b) => b.spent - a.spent);

  return {
    months,
    max,
    cur,
    prev,
    delta: prev > 0 ? ((cur - prev) / prev) * 100 : null,
    largest: main.reduce((n, o) => Math.max(n, amountOf(o)), 0),
    paidCount: paid.length,
    foreignCount: paid.length - main.length,
    recent: [...paid]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6),
    ranked,
    top: ranked.slice(0, 5),
    restShare: ranked.slice(5).reduce((n, b) => n + b.share, 0),
    restCount: Math.max(0, ranked.length - 5),
  };
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className={styles.toast} role="status">
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
  // Same reasoning as OrderList: a negative id means this was approved and
  // paid at the counter, so treat it as settled even though its premium
  // PDF isn't downloadable through this modal's "Download PDF" action
  // (that's what the Receipts tab is for).
  const isPosSale = Number(order.id) < 0;
  const isRefunded = String(order.status || "").toUpperCase() === "REFUNDED";
  const settled = receiptReady || (isPosSale && !isRefunded);
  const paidAmount = Number(order.amountPaid || 0);
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
            <Logo
              className={styles.ehralReceiptLogo}
              size={52}
              variant="horizontal"
              tone="brand"
              title="Ehral"
            />
            <span className={styles.receiptSecure}>
              <i className="ti ti-shield-check" /> Secure record
            </span>
          </div>
          <div className={styles.receiptTitleBlock}>
            <div>
              <span className={styles.receiptKicker}>
                {settled ? "OFFICIAL PURCHASE RECEIPT" : "ORDER CONFIRMATION"}
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
                {settled
                  ? receiptReady
                    ? `Issued ${date(order.receiptIssuedAt || order.createdAt)}`
                    : "Paid at the counter"
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
                {settled
                  ? `${money(order.currency, paidAmount)} paid`
                  : `${money(order.currency, paidAmount)} received`}
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
              <span>{settled ? "Amount paid" : "Amount received"}</span>
              <b>{money(order.currency, paidAmount)}</b>
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
                : settled
                  ? "Full receipt available in your Receipts tab"
                  : "Receipt issued after full payment"}
            </span>
          </div>
          <div className={styles.receiptActions}>
            <button className={styles.receiptCloseButton} onClick={onClose}>
              <i className="ti ti-x" /> Close
            </button>
            {receiptReady ? (
              <button
                className={styles.receiptDownloadButton}
                onClick={() => onDownload(order)}
              >
                <i className="ti ti-file-download" /> Download premium PDF
              </button>
            ) : settled ? (
              <span className={styles.receiptPending}>
                <i className="ti ti-circle-check" /> Paid — full receipt in your
                Receipts tab
              </span>
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

// A business the customer is already connected to (home strip + "Your
// businesses"). Same card as Discover - only the content differs.
function ConnectedBusinessCard({ business, onVisit, onChat, detailed }) {
  const storeDown = business.storefrontActive === false;
  const orders = Number(business.ordersCount || 0);
  return (
    <BusinessCard
      linked
      name={business.businessName}
      logo={business.businessLogo}
      subtitle={
        business.businessTypeLabel || business.businessType || "Ehral business"
      }
      badge={{ label: "Connected", icon: "ti-circle-check-filled" }}
      stats={[
        { label: orders === 1 ? "Order" : "Orders", value: orders },
        {
          label: "Spent",
          value: money(business.currency, business.totalSpent),
        },
      ]}
      facts={
        detailed
          ? [
              storeDown && {
                icon: "ti-info-circle",
                label: "Store unavailable",
              },
              {
                icon: "ti-shopping-bag-check",
                label: "Ehral makes shopping easier for you",
              },
            ].filter(Boolean)
          : undefined
      }
      actions={[
        {
          key: "view",
          label: "View business",
          icon: "ti-arrow-up-right",
          variant: "primary",
          disabled: !business.businessId,
          onClick: () => onVisit(business),
        },
        {
          key: "chat",
          label: "Message",
          icon: "ti-message-circle",
          variant: "soft",
          onClick: () => onChat(business),
        },
      ]}
    />
  );
}

function OrderList({ orders, onReceipt, onPay }) {
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
      {orders.map((o) => {
        // Sales approved and paid at the counter carry a negative id (see
        // saleToOrderDto's doc comment on the backend) and are only ever
        // recorded here once the business has confirmed payment. Their
        // premium PDF lives behind the Receipts tab's own endpoint, not
        // this row's "download" mechanism - receiptAvailable is false for
        // them for that reason alone, not because payment is outstanding.
        const isPosSale = Number(o.id) < 0;
        const isRefunded = String(o.status || "").toUpperCase() === "REFUNDED";
        const settled = o.receiptAvailable || (isPosSale && !isRefunded);
        return (
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
            <div className={styles.orderActions}>
              {!settled &&
                String(o.paymentStatus || "UNPAID").toUpperCase() !== "PAID" &&
                String(o.status || "").toUpperCase() !== "CANCELLED" && (
                  <button
                    className={styles.payOrderButton}
                    onClick={() => onPay(o)}
                  >
                    <i className="ti ti-credit-card" /> Complete payment
                  </button>
                )}
              <button
                className={styles.receiptButton}
                onClick={() => onReceipt(o)}
                disabled={!settled}
              >
                <i className="ti ti-receipt" />{" "}
                {o.receiptAvailable
                  ? "Receipt"
                  : settled
                    ? "Paid"
                    : "Payment pending"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// A business on the Discover tab. One tap on the first button flips the link:
// Connect <-> Disconnect.
function DiscoveryCard({ business, phase, onView, onToggle }) {
  const connected = Boolean(business.connected);
  const name = business.businessName || "this business";
  return (
    <BusinessCard
      linked={connected}
      name={business.businessName}
      logo={business.businessLogo}
      subtitle={[
        business.businessTypeLabel || business.businessType || "Ehral business",
        business.businessCategory,
      ]
        .filter(Boolean)
        .join(" · ")}
      badge={
        connected
          ? { label: "Connected", icon: "ti-circle-check-filled" }
          : undefined
      }
      description={business.description}
      facts={[
        business.address && { icon: "ti-map-pin", label: business.address },
        business.storefrontActive && {
          icon: "ti-building-store",
          label: "Store available",
          accent: true,
        },
      ].filter(Boolean)}
      actions={[
        {
          key: "toggle",
          variant: connected ? "outline" : "primary",
          icon: connected ? "ti-user-minus" : "ti-user-plus",
          busy: Boolean(phase),
          ariaLabel: connected
            ? `Disconnect from ${name}`
            : `Connect to ${name}`,
          label:
            phase === "connecting"
              ? "Connecting…"
              : phase === "disconnecting"
                ? "Disconnecting…"
                : connected
                  ? "Disconnect"
                  : "Connect",
          onClick: () => onToggle(business),
        },
        {
          key: "view",
          variant: "soft",
          icon: "ti-arrow-up-right",
          label: "View business",
          onClick: () => onView(business),
        },
      ]}
    />
  );
}

export default function CustomerDashboard() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout: contextLogout } = useAuth();
  useMessagingConnection();
  const { connect, disconnect, phaseOf } = useBusinessConnection();
  const [tab, setTab] = useState("home");
  const [data, setData] = useState(null);
  // The customer's chats with businesses now run on the same messaging
  // engine as everything else (MessagingHub, mode="customer"). This page only
  // keeps the light-weight pieces it needs itself: the conversation summaries
  // (for the home "needs attention" / activity cards) and the unread badge.
  const { conversations: messages, refresh: loadMessages } =
    useConversations("CUSTOMER");
  const inbox = useCustomerInboxBadge({ includeAnnouncements: true });
  const [messagesThreadOpen, setMessagesThreadOpen] = useState(false);
  const [messagesDeepLink, setMessagesDeepLink] = useState(null);
  const [activeMessageConversationId, setActiveMessageConversationId] =
    useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentBanks, setPaymentBanks] = useState([]);
  const [selectedPaymentBank, setSelectedPaymentBank] = useState("");
  const [paymentAccountNumber, setPaymentAccountNumber] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [directPayment, setDirectPayment] = useState(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  // The "Sign out of Ehral" button on the Account page asks first, using the
  // same confirmation dialog as the sidebar and mobile menu.
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Disconnecting from a business asks first, using the same confirmation
  // dialog design as "Sign out of Ehral". Holds the business pending
  // confirmation (or null when the dialog is closed).
  const [confirmDisconnect, setConfirmDisconnect] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [discovery, setDiscovery] = useState([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryType, setDiscoveryType] = useState("");
  const [businessTypes, setBusinessTypes] = useState([]);
  const [profileForm, setProfileForm] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [approvals, setApprovals] = useState([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  // Set when a "New approval slip" bell notification is tapped, so the
  // Approvals tab can scroll to and outline that exact slip once it renders.
  // Cleared a few seconds after landing so the outline doesn't linger forever.
  const [approvalHighlightId, setApprovalHighlightId] = useState(null);
  const [decisionBusy, setDecisionBusy] = useState(null);
  const [decisionError, setDecisionError] = useState("");
  const [decliningApproval, setDecliningApproval] = useState(null);
  const [posReceipts, setPosReceipts] = useState([]);
  const [selectedPosReceipt, setSelectedPosReceipt] = useState(null);

  const loadApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      const r = await getMySalesApprovals();
      setApprovals(r.data || []);
    } catch (e) {
      setNotice(
        e?.response?.data?.message || "We could not load your approval slips.",
      );
    } finally {
      setApprovalsLoading(false);
    }
  }, []);

  const loadPosReceipts = useCallback(async () => {
    try {
      const r = await getMyPosReceipts();
      setPosReceipts(r.data || []);
    } catch {
      // non-fatal — receipts tab already shows order receipts
    }
  }, []);

  const decideApproval = async (id, approve, paymentMethod, reason) => {
    setDecisionBusy(id);
    setDecisionError("");
    try {
      if (approve) await approveSaleApproval(id, paymentMethod);
      else await declineSaleApproval(id, reason);
      await loadApprovals();
      setDecliningApproval(null);
    } catch (e) {
      setDecisionError(
        e?.response?.data?.message ||
          "We could not record your decision. Please try again.",
      );
    } finally {
      setDecisionBusy(null);
    }
  };

  const pendingApprovalsCount = approvals.filter(
    (a) => a.status === "PENDING_CUSTOMER_APPROVAL",
  ).length;

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
    loadApprovals();
    getCustomerBusinessTypes()
      .then(({ data: types }) => setBusinessTypes(types || []))
      .catch(() => {});
  }, [load, loadApprovals]);

  // Live updates over the same WebSocket connection chat messages use
  // (kept alive by useMessagingConnection() above): a new approval slip
  // lands the instant a business sends it, and the finished receipt +
  // updated spending/order history land the instant the business confirms
  // payment - no manual refresh needed on either end.
  useEffect(() => {
    return subscribeToUserQueue((event) => {
      if (!event?.type) return;
      if (event.type === "SALE_APPROVAL_CREATED") {
        loadApprovals();
      } else if (event.type === "SALE_COMPLETED") {
        loadApprovals();
        loadPosReceipts();
        load();
      }
    });
  }, [loadApprovals, loadPosReceipts, load]);

  // Applies a one-time "open on this tab" instruction from the URL (used by
  // every `/customer-dashboard?tab=...` link across the app - My Accounts,
  // "Back to Discover", etc). This must consume and clear the `tab` param
  // once applied, not just read it, and here's why:
  //
  // `changeTab` (the sidebar / bottom-nav tab switcher, below) only ever
  // calls `setTab(id)` - it never touches the URL. So the very first time a
  // customer arrives via one of those `?tab=...` links and then switches
  // tabs in-app, the URL keeps showing the OLD tab forever; local state and
  // the URL just drift apart from that point on.
  //
  // That drift used to be harmless because this effect only re-ran when
  // `searchParams` itself changed. But it also depended on `loadDiscovery`,
  // a useCallback that gets a NEW identity on every keystroke in the
  // Discover search box and every business-type filter tap (its deps are
  // `[discoveryQuery, discoveryType]`). Each of those keystrokes/taps was
  // therefore re-running this effect, re-reading the STALE `tab` value
  // still sitting in the URL, and forcing `setTab(requestedTab)` all over
  // again - which is exactly what made searching or filtering on Discover
  // suddenly snap the customer back to whatever tab they'd originally been
  // linked in on (Messages, most commonly, since that's the tab most links
  // into the dashboard point at).
  //
  // FIX: clear `tab` out of the URL the moment it's been applied, the same
  // way the `chat` deep-link effect just below already does. Once cleared,
  // `requestedTab` is null on every later run of this effect - regardless
  // of what keeps re-triggering it - so there's nothing stale left to
  // reapply.
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
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("tab");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, loadDiscovery, setSearchParams]);

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

  // /customer-dashboard?chat=<conversationId> - sent here by the storefront
  // ("Message the store" / "Ask about this product"), which may also have
  // stashed a first message to pre-fill. Opens that chat in the Messages tab;
  // the hub reloads its list itself if the thread is brand new.
  useEffect(() => {
    const conversationId = searchParams.get("chat");
    if (!conversationId) return;
    const draft =
      sessionStorage.getItem(`ehral:pending-chat:${conversationId}`) || "";
    sessionStorage.removeItem(`ehral:pending-chat:${conversationId}`);
    setMessagesDeepLink({
      conversationId: Number(conversationId),
      draft: draft || undefined,
    });
    setTab("messages");
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const businesses = useMemo(() => data?.businesses || [], [data]);
  const orders = useMemo(() => data?.orders || [], [data]);
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
  // Receipts tab shows both storefront-order receipts and in-store POS
  // receipts in one feed. They come from two different endpoints/shapes,
  // so merge them into a single tagged list and sort by date - otherwise
  // one source always renders above the other regardless of recency.
  const receiptFeed = useMemo(() => {
    const onlineReceipts = filteredOrders
      .filter((o) => o.receiptAvailable)
      .map((o) => ({ type: "order", createdAt: o.createdAt, data: o }));
    const posReceiptRows = posReceipts.map((r) => ({
      type: "pos",
      createdAt: r.createdAt,
      data: r,
    }));
    return [...onlineReceipts, ...posReceiptRows].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [filteredOrders, posReceipts]);
  const completed = orders.filter(
    (o) => String(o.paymentStatus || "").toUpperCase() === "PAID",
  );
  const average = completed.length
    ? Number(data?.totalSpent || 0) / completed.length
    : 0;
  // Unread chats + unread business announcements, one badge for the Messages tab.
  const unread = inbox.total;
  const spending = useMemo(
    () => buildSpending(orders, businesses, data),
    [orders, businesses, data],
  );
  const inProgressCount = orders.filter((o) =>
    [
      "PENDING",
      "PROCESSING",
      "CONFIRMED",
      "READY",
      "READY_FOR_PICKUP",
      "OUT_FOR_DELIVERY",
    ].includes(String(o.status || "").toUpperCase()),
  ).length;

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
        action: () => {
          setMessagesDeepLink({ conversationId: m.id });
          setTab("messages");
        },
      };
    });
    return [...orderActivity, ...messageActivity]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 6);
  }, [orders, messages]);

  const changeTab = (id) => {
    setTab(id);
    // (There used to be a `setMobileMoreOpen(false)` here, but that state was
    // never declared - it threw a ReferenceError on EVERY tab change, so the
    // two refreshes below never ran. The mobile "More" sheet manages its own
    // open state in MobileNavHub.)
    if (id === "messages") loadMessages();
    if (id === "discover") loadDiscovery();
    if (id === "approvals") loadApprovals();
    if (id === "receipts") loadPosReceipts();
  };

  // Tapping a "New approval slip" bell notification jumps straight to the
  // Approvals tab and outlines the exact slip it was about, instead of just
  // dropping the customer on the tab to hunt for it themselves.
  // Tapping a "Payment received" bell notification opens that exact POS
  // receipt directly, once it's loaded - see the effect below.
  const [pendingReceiptId, setPendingReceiptId] = useState(null);
  const handleNotificationClick = (n) => {
    if (n?.type === "CUSTOMER_SALE_APPROVAL_RECEIVED" && n?.referenceId) {
      setApprovalHighlightId(n.referenceId);
      changeTab("approvals");
    } else if (n?.type === "CUSTOMER_PAYMENT_RECEIVED") {
      if (n?.referenceId) setPendingReceiptId(n.referenceId);
      changeTab("receipts");
    }
  };

  // Scrolls to and briefly outlines the slip once it's actually in the DOM
  // (approvals may still be loading when the tab first switches in).
  useEffect(() => {
    if (tab !== "approvals" || !approvalHighlightId) return;
    const el = document.getElementById(`approval-${approvalHighlightId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setApprovalHighlightId(null), 4000);
    return () => clearTimeout(timer);
  }, [tab, approvalHighlightId, approvals]);

  // Opens the exact receipt a "Payment received" notification was about,
  // once posReceipts has actually loaded (it may still be in flight when
  // the tab first switches in). A notification from an online order
  // payment (rather than a POS sale) carries no referenceId, so there's
  // nothing to open automatically for those - the customer still lands on
  // the receipts tab either way.
  useEffect(() => {
    if (tab !== "receipts" || !pendingReceiptId || !posReceipts.length) return;
    const match = posReceipts.find((r) => r.saleId === pendingReceiptId);
    if (match) setSelectedPosReceipt(match);
    setPendingReceiptId(null);
  }, [tab, pendingReceiptId, posReceipts]);

  const visitBusiness = (business) => {
    // Remember which tab this was opened from, so the profile's back arrow can
    // return to exactly here.
    if (business?.businessId)
      nav(`/customer/business/${business.businessId}`, {
        state: { fromTab: tab },
      });
    else setNotice("This business could not be opened.");
  };

  // One tap flips the link: Connect <-> Disconnect. The card is updated at
  // once, and the overview is refreshed so "Your businesses", orders and the
  // home cards stay in step with it.
  const toggleConnection = async (business) => {
    const id = business?.businessId;
    if (!id || phaseOf(id)) return;
    const leaving = Boolean(business.connected);
    try {
      if (leaving) await disconnect(id);
      else await connect(id);
      setDiscovery((rows) =>
        rows.map((b) =>
          b.businessId === id ? { ...b, connected: !leaving } : b,
        ),
      );
      setNotice(
        leaving
          ? `You've disconnected from ${business.businessName}.`
          : `You're now connected to ${business.businessName}.`,
      );
      load();
    } catch (e) {
      setNotice(
        e?.response?.data?.message ||
          (leaving
            ? "We couldn't disconnect you from this business. Please try again."
            : "We couldn't connect you to this business. Please try again."),
      );
    }
  };

  // Connecting happens right away, but disconnecting asks first - this is
  // the entry point the Discover cards call. It only opens the confirmation
  // dialog for the "leaving" direction; connecting still goes straight
  // through to toggleConnection above.
  const requestToggleConnection = (business) => {
    const id = business?.businessId;
    if (!id || phaseOf(id)) return;
    if (business.connected) setConfirmDisconnect(business);
    else toggleConnection(business);
  };

  const confirmDisconnectBusiness = async () => {
    if (!confirmDisconnect) return;
    setDisconnecting(true);
    try {
      await toggleConnection(confirmDisconnect);
    } finally {
      setDisconnecting(false);
      setConfirmDisconnect(null);
    }
  };

  const openBusinessChat = async (business) => {
    try {
      const r = await createCustomerBusinessConversation(business.businessId);
      setMessagesDeepLink({ conversationId: r.data.id });
      setTab("messages");
    } catch (e) {
      setNotice(
        e?.response?.data?.message ||
          "Messaging is temporarily unavailable for this business.",
      );
    }
  };

  const openPendingPayment = async (order) => {
    if (!order?.id) return;
    setPaymentOrder(order);
    setPaymentError("");
    setDirectPayment(null);
    setPaymentAccountNumber("");
    try {
      const banks = await listOrderPayWithBankBanks();
      const list = Array.isArray(banks) ? banks : [];
      setPaymentBanks(list);
      setSelectedPaymentBank((current) => current || list[0]?.code || "");
    } catch {
      setPaymentBanks([]);
    }
  };

  const completePendingPayment = async () => {
    if (!paymentOrder?.id || paymentBusy) return;
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const result = await payForOrderOnline(paymentOrder.id);
      if (String(result?.status || "").toUpperCase() === "SUCCESS") {
        setPaymentOrder(null);
        setDirectPayment(null);
        await load();
      }
    } catch (e) {
      setPaymentError(
        e?.response?.data?.message ||
          e?.message ||
          "Payment could not be completed. Please try again.",
      );
    } finally {
      setPaymentBusy(false);
    }
  };

  const startPendingDirectPayment = async (method) => {
    if (!paymentOrder?.id || paymentBusy) return;
    setPaymentBusy(true);
    setPaymentError("");
    try {
      let result;
      if (method === "transfer") {
        result = await initializeOrderBankTransfer(paymentOrder.id);
      } else if (method === "ussd") {
        result = await initializeOrderUssd(paymentOrder.id);
      } else {
        if (!selectedPaymentBank || !paymentAccountNumber.trim()) {
          throw new Error(
            "Select your bank and enter your bank account number.",
          );
        }
        result = await initializeOrderBank(
          paymentOrder.id,
          selectedPaymentBank,
          paymentAccountNumber.trim(),
          paymentOrder.customerPhone || undefined,
        );
      }
      setDirectPayment({ method, ...result });
    } catch (e) {
      setPaymentError(
        e?.response?.data?.message ||
          e?.message ||
          "We could not start this payment method. Please try again.",
      );
    } finally {
      setPaymentBusy(false);
    }
  };

  const checkPendingDirectPayment = async () => {
    if (!paymentOrder?.id || !directPayment?.reference || paymentBusy) return;
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const result = await verifyOrderPayment(
        paymentOrder.id,
        directPayment.reference,
      );
      if (String(result?.status || "").toUpperCase() === "SUCCESS") {
        setPaymentOrder(null);
        setDirectPayment(null);
        await load();
      } else {
        setPaymentError(
          result?.message ||
            "Payment has not been confirmed yet. If you have completed the payment, try checking again shortly.",
        );
      }
    } catch (e) {
      setPaymentError(
        e?.response?.data?.message ||
          e?.message ||
          "We could not verify the payment yet.",
      );
    } finally {
      setPaymentBusy(false);
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

  const handleProfileImageChange = (url) => {
    if (!url) return;
    setData((current) =>
      current ? { ...current, profileImage: url } : current,
    );
    setProfileForm((current) =>
      current
        ? { ...current, profileImage: url, profilePictureUrl: url }
        : current,
    );
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
    return <BrandSplash message="Preparing your customer hub…" />;
  }

  const navItems = CUSTOMER_NAV_ITEMS;
  const title = tab === "notifications" ? "Notifications" : (navItems.find((x) => x[0] === tab)?.[1] || "Dashboard");

  return (
    <>
      <CustomerShell
        tab={tab}
        title={title}
        onNavigate={changeTab}
        firstName={data?.firstName}
        lastName={data?.lastName}
        profileImage={
          data?.profileImage ||
          profileForm?.profileImage ||
          profileForm?.profilePictureUrl
        }
        onProfileImageChange={handleProfileImageChange}
        unread={unread}
        approvalsCount={pendingApprovalsCount}
        onSignOut={signOut}
        banner={<Toast message={notice} onClose={() => setNotice("")} />}
        contentClassName={tab === "messages" ? styles.contentMessages : ""}
        notificationControl={
          <NotificationCenter
            mode="customer"
            fetchNotifications={getCustomerNotifications}
            fetchUnreadCount={getCustomerUnreadCount}
            markAllRead={markAllCustomerRead}
            onViewAll={() => changeTab("notifications")}
            onNotificationClick={handleNotificationClick}
            enabled={tab !== "notifications"}
          />
        }
        topActionsBefore={
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
        }
      >
        {tab === "notifications" && (
          <NotificationsPageView
            mode="customer"
            fetchNotifications={getCustomerNotifications}
            fetchUnreadCount={getCustomerUnreadCount}
            markAllRead={markAllCustomerRead}
            onNotificationClick={handleNotificationClick}
          />
        )}
        {tab === "home" && (
          <>
            <section
              className={styles.ghHero}
              aria-label="Your personal commerce hub"
            >
              <div className={styles.ghCopy}>
                <h2>
                  {greetingFor()}, <em>{data?.firstName || "there"}</em>.
                </h2>
                <p>
                  One Ehral account for your stores, orders, receipts,
                  conversations and spending history.
                </p>
                <div className={styles.ghActions}>
                  <button
                    onClick={() => changeTab("discover")}
                    className={styles.ghPrimary}
                  >
                    Discover businesses{" "}
                    <i className="ti ti-arrow-up-right" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => changeTab("messages")}
                    className={styles.ghGlassBtn}
                  >
                    <i className="ti ti-message-circle" aria-hidden="true" />{" "}
                    Messages
                    {unread > 0 && (
                      <span className={styles.ghBadge}>{unread}</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Live numbers - desktop/tablet only; on phones the stats row and
                    "Needs your attention" just below already say the same. */}
              <div className={styles.ghChips}>
                <button
                  className={styles.ghChip}
                  onClick={() => changeTab("businesses")}
                  aria-label={`${businesses.length} connected businesses`}
                >
                  <span className={styles.ghFaces}>
                    {businesses.slice(0, 3).map((b) => (
                      <span
                        key={b.membershipId}
                        className={styles.ghFace}
                        title={b.businessName}
                      >
                        {b.businessLogo ? (
                          <img src={b.businessLogo} alt="" />
                        ) : (
                          initials(b.businessName)
                        )}
                      </span>
                    ))}
                    {businesses.length === 0 && (
                      <span className={styles.ghFace}>
                        <i className="ti ti-plus" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <strong>
                    {businesses.length} business
                    {businesses.length === 1 ? "" : "es"}
                  </strong>
                </button>
                <button
                  className={styles.ghChip}
                  onClick={() => changeTab("orders")}
                >
                  <i className="ti ti-package" aria-hidden="true" />
                  <b>{inProgressCount}</b>
                  <span>in progress</span>
                </button>
                <button
                  className={styles.ghChip}
                  onClick={() => changeTab("messages")}
                >
                  <i className="ti ti-message-2" aria-hidden="true" />
                  <b>{unread}</b>
                  <span>unread</span>
                </button>
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

            <section className={`${styles.section} ${styles.flatSection}`}>
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
                    <ConnectedBusinessCard
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
          <section className={`${styles.section} ${styles.businessPage}`}>
            <div className={styles.sectionIntro}>
              <span className={styles.eyebrow}>DISCOVER ON EHRAL</span>
              <h2>Find businesses and services</h2>
              <p>
                Search Ehral for businesses you need, explore their information,
                and connect with the ones you choose.
              </p>
            </div>
            <div className={styles.discoveryToolbar}>
              <div className={styles.discoverySearchRow}>
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
              </div>

              <div className={styles.discoveryFilterSection}>
                <div className={styles.discoveryFilterHeading}>
                  <span>Business type</span>
                  <small>Filter by the kind of business</small>
                </div>
                <div
                  className={styles.discoveryTypes}
                  role="group"
                  aria-label="Business type filters"
                >
                  <button
                    type="button"
                    className={!discoveryType ? styles.discoveryTypeActive : ""}
                    onClick={() => setDiscoveryType("")}
                  >
                    All
                  </button>
                  {businessTypes.map((type) => (
                    <button
                      type="button"
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
                    phase={phaseOf(b.businessId)}
                    onToggle={requestToggleConnection}
                    onView={(business) =>
                      nav(`/customer/business/${business.businessId}`, {
                        state: { fromTab: tab },
                      })
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
          <section className={`${styles.section} ${styles.businessPage}`}>
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
                <ConnectedBusinessCard
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

        {tab === "approvals" && (
          <section className={`${styles.section} ${styles.approvalsPage}`}>
            <div className={styles.sectionIntro}>
              <span className={styles.eyebrow}>REVIEW BEFORE YOU PAY</span>
              <h2>Approval slips</h2>
              <p>
                When a business builds your cart at the counter, it lands here
                first — nothing is charged until you approve it and pick how
                you'll pay.
              </p>
            </div>
            {decisionError && (
              <div
                className={styles.emptyState}
                style={{
                  borderColor: "#e2a199",
                  color: "#a33b32",
                  marginBottom: 16,
                }}
              >
                <p style={{ margin: 0 }}>{decisionError}</p>
              </div>
            )}
            {approvalsLoading && !approvals.length ? (
              <div className={styles.emptyState}>
                <i className="ti ti-loader-2" />
                <p>Loading your approval slips…</p>
              </div>
            ) : !approvals.length ? (
              <div className={styles.emptyState}>
                <i className="ti ti-clipboard-check" />
                <h3>Nothing waiting on you</h3>
                <p>
                  Carts a business sends you from the counter will show up here
                  for your approval.
                </p>
              </div>
            ) : (
              <div className={styles.approvalList}>
                {approvals.map((a) => {
                  const pending = a.status === "PENDING_CUSTOMER_APPROVAL";
                  const declining = decliningApproval === a.id;
                  const statusClass =
                    a.status === "PENDING_CUSTOMER_APPROVAL"
                      ? styles.approvalStatusPending
                      : a.status === "AWAITING_BUSINESS_CONFIRMATION"
                        ? styles.approvalStatusWaiting
                        : a.status === "CUSTOMER_DECLINED"
                          ? styles.approvalStatusDeclined
                          : styles.approvalStatusDefault;
                  return (
                    <div
                      key={a.id}
                      id={`approval-${a.id}`}
                      className={`${styles.approvalCard} ${approvalHighlightId === a.id ? styles.approvalCardHighlighted : ""}`}
                    >
                      <div className={styles.approvalHead}>
                        <div className={styles.approvalWho}>
                          <div
                            className={`${styles.avatar} ${styles.approvalAvatar}`}
                          >
                            {a.businessLogo ? (
                              <img src={a.businessLogo} alt="" />
                            ) : (
                              initials(a.businessName)
                            )}
                          </div>
                          <div className={styles.approvalMeta}>
                            <strong>{a.businessName}</strong>
                            <small>
                              {a.slipNumber} · {date(a.createdAt)} ·{" "}
                              {a.itemCount} item(s)
                            </small>
                          </div>
                        </div>
                        <span
                          className={`${styles.approvalStatus} ${statusClass}`}
                        >
                          {{
                            PENDING_CUSTOMER_APPROVAL: "Needs your review",
                            AWAITING_BUSINESS_CONFIRMATION:
                              "Waiting on business",
                            CUSTOMER_DECLINED: "Declined",
                            CANCELLED: "Withdrawn",
                            COMPLETED: "Completed",
                          }[a.status] || a.status}
                        </span>
                      </div>

                      <div className={styles.approvalItems}>
                        {(a.items || []).map((it, idx) => (
                          <div key={idx} className={styles.approvalItemRow}>
                            <span>
                              {it.productName} × {it.quantity}
                            </span>
                            <span>{money(a.currency, it.lineTotal)}</span>
                          </div>
                        ))}
                      </div>

                      {(Number(a.discount) > 0 ||
                        Number(a.couponDiscount) > 0 ||
                        Number(a.tax) > 0) && (
                        <div className={styles.approvalTotals}>
                          {Number(a.discount) > 0 && (
                            <div className={styles.approvalTotalRow}>
                              <span>Discount</span>
                              <span>−{money(a.currency, a.discount)}</span>
                            </div>
                          )}
                          {Number(a.couponDiscount) > 0 && (
                            <div className={styles.approvalTotalRow}>
                              <span>
                                Coupon {a.couponCode ? `· ${a.couponCode}` : ""}
                              </span>
                              <span>
                                −{money(a.currency, a.couponDiscount)}
                              </span>
                            </div>
                          )}
                          {Number(a.tax) > 0 && (
                            <div className={styles.approvalTotalRow}>
                              <span>Tax</span>
                              <span>{money(a.currency, a.tax)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className={styles.approvalGrandTotal}>
                        <span>Total</span>
                        <strong>{money(a.currency, a.total)}</strong>
                      </div>

                      {pending && !declining && (
                        <div className={styles.approvalActions}>
                          <button
                            disabled={decisionBusy === a.id}
                            onClick={() => decideApproval(a.id, true, "CASH")}
                            className={styles.approvalBtnCash}
                          >
                            Approve · Pay cash
                          </button>
                          <button
                            disabled={decisionBusy === a.id}
                            onClick={() =>
                              decideApproval(a.id, true, "EHRAL_PAY")
                            }
                            className={styles.approvalBtnPay}
                          >
                            Approve · Ehral Pay
                          </button>
                          <button
                            disabled={decisionBusy === a.id}
                            onClick={() => setDecliningApproval(a.id)}
                            className={styles.approvalBtnDecline}
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {pending && declining && (
                        <div className={styles.approvalDeclineBox}>
                          <textarea
                            id={`decline-reason-${a.id}`}
                            placeholder="Optional — let the business know why"
                            className={styles.approvalDeclineTextarea}
                          />
                          <div className={styles.approvalDeclineActions}>
                            <button
                              disabled={decisionBusy === a.id}
                              onClick={() =>
                                decideApproval(
                                  a.id,
                                  false,
                                  null,
                                  document.getElementById(
                                    `decline-reason-${a.id}`,
                                  )?.value || "",
                                )
                              }
                              className={styles.approvalBtnConfirmDecline}
                            >
                              Confirm decline
                            </button>
                            <button
                              onClick={() => setDecliningApproval(null)}
                              className={styles.approvalBtnBack}
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      )}

                      {a.status === "AWAITING_BUSINESS_CONFIRMATION" && (
                        <p className={styles.approvalNote}>
                          You chose to pay with{" "}
                          {a.paymentMethodChosen === "EHRAL_PAY"
                            ? "Ehral Pay"
                            : "cash"}
                          . Your premium receipt will land on your dashboard the
                          moment {a.businessName} confirms they've received it.
                        </p>
                      )}
                      {a.status === "CUSTOMER_DECLINED" && a.declineReason && (
                        <p className={styles.approvalNote}>
                          Your note: “{a.declineReason}”
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "orders" && (
          <section className={`${styles.section} ${styles.orderPage}`}>
            <div className={styles.sectionIntro}>
              <span className={styles.eyebrow}>PURCHASE HISTORY</span>
              <h2>Your orders</h2>
              <p>
                Everything you have bought through your Ehral customer account.
              </p>
            </div>
            <OrderList
              orders={filteredOrders}
              onReceipt={setSelectedOrder}
              onPay={openPendingPayment}
            />
          </section>
        )}

        {tab === "receipts" && (
          <section className={`${styles.section} ${styles.receiptPage}`}>
            <div className={styles.sectionIntro}>
              <span className={styles.eyebrow}>YOUR PAPER TRAIL</span>
              <h2>Receipts</h2>
              <p>
                Receipts generated from your Ehral purchases remain available
                here, even after you leave a store.
              </p>
            </div>
            <div className={styles.receiptGrid}>
              {receiptFeed.map((entry) =>
                entry.type === "order" ? (
                  <button
                    key={`order-${entry.data.id}`}
                    className={styles.receiptCard}
                    onClick={() => setSelectedOrder(entry.data)}
                  >
                    <div className={styles.receiptCardTop}>
                      <div className={styles.avatar}>
                        {entry.data.businessLogo ? (
                          <img src={entry.data.businessLogo} alt="" />
                        ) : (
                          initials(entry.data.businessName)
                        )}
                      </div>
                      <span>{entry.data.paymentStatus || "RECORDED"}</span>
                    </div>
                    <strong>{entry.data.businessName}</strong>
                    <small>
                      #{entry.data.orderNumber} · {date(entry.data.createdAt)}
                    </small>
                    <b>{money(entry.data.currency, entry.data.total)}</b>
                    <em>
                      View receipt <i className="ti ti-arrow-up-right" />
                    </em>
                  </button>
                ) : (
                  <button
                    key={`pos-${entry.data.saleId}`}
                    className={styles.receiptCard}
                    onClick={() => setSelectedPosReceipt(entry.data)}
                  >
                    <div className={styles.receiptCardTop}>
                      <div className={styles.avatar}>
                        {entry.data.businessLogo ? (
                          <img src={entry.data.businessLogo} alt="" />
                        ) : (
                          initials(entry.data.businessName)
                        )}
                      </div>
                      <span>IN-STORE</span>
                    </div>
                    <strong>{entry.data.businessName}</strong>
                    <small>
                      #{entry.data.saleNumber} · {date(entry.data.createdAt)}
                    </small>
                    <b>{money(entry.data.currency, entry.data.total)}</b>
                    <em>
                      View receipt <i className="ti ti-arrow-up-right" />
                    </em>
                  </button>
                ),
              )}
            </div>
            {!receiptFeed.length && (
              <div className={styles.emptyState}>
                <i className="ti ti-receipt-off" />
                <h3>No receipts yet</h3>
                <p>Your completed Ehral purchases will appear here.</p>
              </div>
            )}
          </section>
        )}

        {tab === "messages" && (
          <div
            className={`${styles.msHost} ${messagesThreadOpen ? styles.msHostThread : ""}`}
          >
            <MessagingHub
              mode="customer"
              flat
              businesses={businesses}
              onThreadOpenChange={setMessagesThreadOpen}
              deepLink={messagesDeepLink}
              onDeepLinkConsumed={() => setMessagesDeepLink(null)}
              onActiveConversationChange={setActiveMessageConversationId}
              onBadgeChange={inbox.refresh}
            />
          </div>
        )}

        {tab === "spending" && (
          <section className={styles.spWrap} aria-label="Spending">
            <header className={styles.spHead}>
              <span className={styles.eyebrow}>YOUR MONEY TRAIL</span>
              <h2>Spending</h2>
              <p>
                Payments completed across your Ehral businesses, net of recorded
                refunds.
              </p>
            </header>

            <div className={styles.spFigure}>
              <span className={styles.spFigureLabel}>Total recorded spend</span>
              <strong className={styles.spBig}>
                {money(data?.currency, data?.totalSpent)}
              </strong>
              <div className={styles.spFigureMeta}>
                <span>
                  {spending.paidCount} fully paid order
                  {spending.paidCount === 1 ? "" : "s"}
                </span>
                {spending.delta !== null && (
                  <span
                    className={`${styles.spDelta} ${spending.delta >= 0 ? styles.spUp : styles.spDown}`}
                  >
                    <i
                      className={`ti ${spending.delta >= 0 ? "ti-trending-up" : "ti-trending-down"}`}
                      aria-hidden="true"
                    />
                    {Math.abs(spending.delta).toFixed(0)}% vs last month
                  </span>
                )}
              </div>
            </div>

            {spending.paidCount === 0 ? (
              <div className={styles.spEmpty}>
                <i className="ti ti-chart-donut-3" aria-hidden="true" />
                <h3>Nothing to chart yet</h3>
                <p>
                  Once you complete a payment with a business, your spending
                  trail appears here.
                </p>
                <button
                  className={styles.ghPrimary}
                  onClick={() => changeTab("discover")}
                >
                  Discover businesses{" "}
                  <i className="ti ti-arrow-up-right" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <div className={styles.spKpis}>
                  <div>
                    <span>This month</span>
                    <strong>{money(data?.currency, spending.cur)}</strong>
                  </div>
                  <div>
                    <span>Average order</span>
                    <strong>{money(data?.currency, average)}</strong>
                  </div>
                  <div>
                    <span>Largest order</span>
                    <strong>{money(data?.currency, spending.largest)}</strong>
                  </div>
                  <div>
                    <span>Businesses paid</span>
                    <strong>{spending.ranked.length}</strong>
                  </div>
                </div>

                <section
                  className={styles.spBlock}
                  aria-label="Payments by month"
                >
                  <div className={styles.spBlockHead}>
                    <h3>Last 6 months</h3>
                    <span>Payments by month</span>
                  </div>
                  <div
                    className={styles.spChart}
                    role="img"
                    aria-label="Bar chart of payments over the last six months"
                  >
                    {spending.months.map((m) => {
                      const pct =
                        spending.max > 0
                          ? Math.max(
                              m.value > 0 ? 4 : 0,
                              (m.value / spending.max) * 100,
                            )
                          : 0;
                      const top = m.value > 0 && m.value === spending.max;
                      return (
                        <div
                          key={m.key}
                          className={`${styles.spCol} ${m.current ? styles.spColNow : ""} ${top ? styles.spColTop : ""}`}
                          title={`${m.label} ${m.year}: ${money(data?.currency, m.value)} · ${m.count} order${m.count === 1 ? "" : "s"}`}
                        >
                          <span className={styles.spColValue}>
                            {m.value > 0 ? compactMoney(m.value) : ""}
                          </span>
                          <span className={styles.spBarTrack}>
                            <i style={{ height: `${pct}%` }} />
                          </span>
                          <span className={styles.spColLabel}>{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  {spending.foreignCount > 0 && (
                    <p className={styles.spNote}>
                      {spending.foreignCount} payment
                      {spending.foreignCount === 1 ? "" : "s"} in another
                      currency
                      {spending.foreignCount === 1 ? " is" : " are"} not
                      included in the chart.
                    </p>
                  )}
                </section>

                <section
                  className={styles.spBlock}
                  aria-label="Spending by business"
                >
                  <div className={styles.spBlockHead}>
                    <h3>Where it went</h3>
                    <span>Share of total spend</span>
                  </div>
                  <div
                    className={styles.spSplit}
                    role="img"
                    aria-label="Spending split by business"
                  >
                    {spending.top.map((b, i) => (
                      <span
                        key={b.membershipId}
                        style={{
                          width: `${b.share}%`,
                          background: `var(--sp-c${i})`,
                        }}
                      />
                    ))}
                    {spending.restShare > 0 && (
                      <span
                        style={{
                          width: `${spending.restShare}%`,
                          background: "var(--sp-c5)",
                        }}
                      />
                    )}
                  </div>
                  <ul className={styles.spRows}>
                    {spending.top.map((b, i) => (
                      <li key={b.membershipId}>
                        <span
                          className={styles.spSwatch}
                          style={{ background: `var(--sp-c${i})` }}
                          aria-hidden="true"
                        />
                        <span className={styles.spAvatar}>
                          {b.businessLogo ? (
                            <img src={b.businessLogo} alt="" />
                          ) : (
                            initials(b.businessName)
                          )}
                        </span>
                        <span className={styles.spWho}>
                          <strong>{b.businessName}</strong>
                          <small>
                            {b.ordersCount} order
                            {b.ordersCount === 1 ? "" : "s"}
                          </small>
                        </span>
                        <span className={styles.spHow}>
                          <strong>{money(b.currency, b.spent)}</strong>
                          <small>{b.share.toFixed(1)}%</small>
                        </span>
                      </li>
                    ))}
                    {spending.restCount > 0 && (
                      <li>
                        <span
                          className={styles.spSwatch}
                          style={{ background: "var(--sp-c5)" }}
                          aria-hidden="true"
                        />
                        <span className={styles.spAvatar}>
                          <i className="ti ti-dots" aria-hidden="true" />
                        </span>
                        <span className={styles.spWho}>
                          <strong>
                            {spending.restCount} other business
                            {spending.restCount === 1 ? "" : "es"}
                          </strong>
                        </span>
                        <span className={styles.spHow}>
                          <small>{spending.restShare.toFixed(1)}%</small>
                        </span>
                      </li>
                    )}
                  </ul>
                </section>

                <section
                  className={styles.spBlock}
                  aria-label="Recent payments"
                >
                  <div className={styles.spBlockHead}>
                    <h3>Recent payments</h3>
                    <button
                      className={styles.spLink}
                      onClick={() => changeTab("orders")}
                    >
                      All orders{" "}
                      <i className="ti ti-arrow-right" aria-hidden="true" />
                    </button>
                  </div>
                  <ul className={styles.spRecent}>
                    {spending.recent.map((o) => (
                      <li key={o.id}>
                        <button onClick={() => setSelectedOrder(o)}>
                          <span className={styles.spRecentIcon}>
                            <i className="ti ti-receipt-2" aria-hidden="true" />
                          </span>
                          <span className={styles.spWho}>
                            <strong>{o.businessName}</strong>
                            <small>
                              #{o.orderNumber} · {date(o.createdAt)}
                            </small>
                          </span>
                          <span className={styles.spHow}>
                            <strong>
                              {money(o.currency, o.amountPaid || o.total)}
                            </strong>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </section>
        )}

        {tab === "account" && (
          <section className={styles.acWrap} aria-label="Account">
            {/* Identity header - sits straight on the page background. */}
            <header className={styles.acHero}>
              <div className={styles.acAvatarWrap}>
                <span className={styles.acAvatarRing} aria-hidden="true" />
                <button
                  type="button"
                  className={styles.acAvatar}
                  onClick={() =>
                    document
                      .getElementById("customer-account-photo-input")
                      ?.click()
                  }
                  aria-label="Upload profile picture"
                  title="Upload profile picture"
                >
                  {profileForm?.profileImage ||
                  profileForm?.profilePictureUrl ||
                  data?.profileImage ? (
                    <img
                      src={
                        profileForm?.profileImage ||
                        profileForm?.profilePictureUrl ||
                        data?.profileImage
                      }
                      alt=""
                    />
                  ) : (
                    initials(
                      `${profileForm?.firstName || data?.firstName || ""} ${profileForm?.lastName || data?.lastName || ""}`,
                    )
                  )}
                  <span className={styles.acAvatarCamera}>
                    <i className="ti ti-camera" />
                  </span>
                </button>
                <input
                  id="customer-account-photo-input"
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      const { data: result } =
                        await uploadCustomerProfilePicture(file);
                      handleProfileImageChange(result?.url);
                    } catch (err) {
                      setNotice(
                        err?.response?.data?.message ||
                          "We could not upload your profile picture.",
                      );
                    }
                  }}
                />
              </div>
              <div className={styles.acWho}>
                <span className={styles.eyebrow}>ACCOUNT &amp; SECURITY</span>
                <h2>
                  {profileForm?.firstName || data?.firstName}{" "}
                  {profileForm?.lastName || data?.lastName}
                </h2>
                <ul className={styles.acMeta}>
                  <li>
                    <i className="ti ti-mail" aria-hidden="true" />
                    <span>
                      {profileForm?.email || data?.email || "No email added"}
                    </span>
                  </li>
                  <li>
                    <i className="ti ti-phone" aria-hidden="true" />
                    <span>{profileForm?.phone || data?.phone}</span>
                    <em className={styles.acVerified}>
                      <i
                        className="ti ti-circle-check-filled"
                        aria-hidden="true"
                      />{" "}
                      Verified
                    </em>
                  </li>
                </ul>
              </div>
              <div className={styles.acActions}>
                <button
                  onClick={() => setEditingProfile((v) => !v)}
                  className={styles.acPrimary}
                >
                  <i
                    className={editingProfile ? "ti ti-x" : "ti ti-user-edit"}
                    aria-hidden="true"
                  />
                  {editingProfile ? "Close editor" : "Edit profile"}
                </button>
                <button
                  onClick={() => nav("/customer-dashboard?tab=spending")}
                  className={styles.acGhost}
                >
                  <i className="ti ti-chart-donut" aria-hidden="true" /> View
                  spending
                </button>
              </div>
            </header>

            {editingProfile && profileForm && (
              <div className={styles.acEditor}>
                <div className={styles.acEditorHead}>
                  <h3>Edit your details</h3>
                  <p>
                    Changes apply to your Ehral identity and follow you across
                    your relationships.
                  </p>
                </div>
                <div className={styles.acPhotoField}>
                  <div>
                    <span className={styles.acFieldLabel}>Profile picture</span>
                    <small>
                      Use a clear photo. It will appear wherever your customer
                      profile is shown.
                    </small>
                  </div>
                  <button
                    type="button"
                    className={styles.acPhotoButton}
                    onClick={() =>
                      document
                        .getElementById("customer-account-photo-input")
                        ?.click()
                    }
                  >
                    <i className="ti ti-camera" aria-hidden="true" />
                    Change picture
                  </button>
                </div>
                <div className={styles.acFields}>
                  {[
                    ["firstName", "First name"],
                    ["middleName", "Middle name"],
                    ["lastName", "Last name"],
                    ["email", "Email"],
                  ].map(([key, label]) => (
                    <label key={key} className={styles.acField}>
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
                  <label className={styles.acField}>
                    <span>Phone</span>
                    <input value={profileForm.phone || ""} readOnly />
                    <small>
                      Your phone is your verified identity anchor and can't be
                      changed here.
                    </small>
                  </label>
                  <label className={styles.acField}>
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
                  <label className={styles.acField}>
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
                  <label className={`${styles.acField} ${styles.acFieldWide}`}>
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
                </div>
                <div className={styles.acEditorFoot}>
                  <button
                    className={styles.acGhost}
                    onClick={() => setEditingProfile(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.acPrimary}
                    onClick={saveProfile}
                    disabled={savingProfile}
                  >
                    {savingProfile ? "Saving…" : "Save profile"}
                  </button>
                </div>
              </div>
            )}

            {/* At a glance - big numbers, no boxes */}
            <div className={styles.acGlance}>
              <div>
                <strong>{businesses.length}</strong>
                <span>
                  Connected business{businesses.length === 1 ? "" : "es"}
                </span>
              </div>
              <div>
                <strong>{data?.totalOrders || 0}</strong>
                <span>
                  Order{(data?.totalOrders || 0) === 1 ? "" : "s"} placed
                </span>
              </div>
              <div>
                <strong>{money(data?.currency, data?.totalSpent)}</strong>
                <span>Recorded spend</span>
              </div>
            </div>

            <div className={styles.acColumns}>
              <section
                className={styles.acSection}
                aria-labelledby="ac-security"
              >
                <h3 id="ac-security">Security &amp; privacy</h3>
                <ul className={styles.acList}>
                  <li>
                    <span className={styles.acIcon}>
                      <i className="ti ti-lock" aria-hidden="true" />
                    </span>
                    <span>
                      <strong>Password protected</strong>
                      <small>
                        Your account is secured with your Ehral password.
                      </small>
                    </span>
                    <i
                      className={`ti ti-circle-check-filled ${styles.acTick}`}
                      aria-hidden="true"
                    />
                  </li>
                  <li>
                    <span className={styles.acIcon}>
                      <i
                        className="ti ti-device-mobile-check"
                        aria-hidden="true"
                      />
                    </span>
                    <span>
                      <strong>Phone verified</strong>
                      <small>
                        Your phone is your verified identity anchor.
                      </small>
                    </span>
                    <i
                      className={`ti ti-circle-check-filled ${styles.acTick}`}
                      aria-hidden="true"
                    />
                  </li>
                  <li>
                    <span className={styles.acIcon}>
                      <i className="ti ti-building-store" aria-hidden="true" />
                    </span>
                    <span>
                      <strong>
                        {businesses.length} connected business
                        {businesses.length === 1 ? "" : "es"}
                      </strong>
                      <small>
                        One identity, many relationships - each business only
                        sees what you share.
                      </small>
                    </span>
                  </li>
                </ul>
              </section>

              <section
                className={styles.acSection}
                aria-labelledby="ac-identity"
              >
                <h3 id="ac-identity">Your Ehral identity</h3>
                <p className={styles.acStatement}>
                  One secure account across your commerce life.
                </p>
                <p className={styles.acCopy}>
                  Your customer identity, orders, receipts and conversations
                  stay connected while each business keeps control of its own
                  products and operations.
                </p>
                <button
                  onClick={() => setConfirmSignOut(true)}
                  className={styles.acSignOut}
                >
                  <i className="ti ti-logout-2" aria-hidden="true" /> Sign out
                  of Ehral
                </button>
              </section>
            </div>
          </section>
        )}
      </CustomerShell>

      <LogoutConfirmModal
        open={confirmSignOut}
        loading={signingOut}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={async () => {
          setSigningOut(true);
          try {
            await signOut();
          } finally {
            setSigningOut(false);
            setConfirmSignOut(false);
          }
        }}
      />

      <DisconnectConfirmModal
        open={Boolean(confirmDisconnect)}
        businessName={confirmDisconnect?.businessName}
        loading={disconnecting}
        onCancel={() => !disconnecting && setConfirmDisconnect(null)}
        onConfirm={confirmDisconnectBusiness}
      />

      {paymentOrder && (
        <div
          className={`${styles.overlay} ${styles.paymentRecoveryOverlay}`}
          role="dialog"
          aria-modal="true"
          aria-label="Complete order payment"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !paymentBusy)
              setPaymentOrder(null);
          }}
        >
          <section className={styles.paymentRecoveryModal}>
            <button
              type="button"
              className={styles.paymentRecoveryClose}
              onClick={() => !paymentBusy && setPaymentOrder(null)}
              aria-label="Close payment"
              title="Close"
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
            <div className={styles.paymentRecoveryHead}>
              <span className={styles.eyebrow}>PAYMENT REQUIRED</span>
              <h2>Complete your order</h2>
              <p>
                Order #{paymentOrder.orderNumber} at {paymentOrder.businessName}{" "}
                is still pending payment. Complete payment to confirm the order
                with the business.
              </p>
              <strong>
                {money(paymentOrder.currency, paymentOrder.total)}
              </strong>
            </div>

            {directPayment ? (
              <div className={styles.directPaymentRecovery}>
                <h3>
                  {directPayment.method === "transfer"
                    ? "Bank transfer"
                    : directPayment.method === "ussd"
                      ? "USSD payment"
                      : "Pay with bank"}
                </h3>
                {directPayment.displayText && (
                  <p>{directPayment.displayText}</p>
                )}
                {directPayment.accountName && (
                  <p>
                    <b>Account:</b> {directPayment.accountName}
                  </p>
                )}
                {directPayment.accountNumber && (
                  <p>
                    <b>Account number:</b> {directPayment.accountNumber}
                  </p>
                )}
                {directPayment.bankName && (
                  <p>
                    <b>Bank:</b> {directPayment.bankName}
                  </p>
                )}
                {directPayment.ussdCode && (
                  <div className={styles.recoveryCode}>
                    {directPayment.ussdCode}
                  </div>
                )}
                <div className={styles.paymentRecoveryActions}>
                  <button
                    className={styles.payOrderButton}
                    disabled={paymentBusy}
                    onClick={checkPendingDirectPayment}
                  >
                    {paymentBusy ? "Checking…" : "I have paid · Check payment"}
                  </button>
                  <button
                    className={styles.secondaryPaymentAction}
                    disabled={paymentBusy}
                    onClick={() => setDirectPayment(null)}
                  >
                    Choose another method
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.paymentRecoveryOptions}>
                  <button
                    disabled={paymentBusy}
                    onClick={completePendingPayment}
                  >
                    <i className="ti ti-credit-card" />
                    <span>
                      <b>Card</b>
                      <small>Pay securely with Paystack</small>
                    </span>
                  </button>
                  <button
                    disabled={paymentBusy}
                    onClick={() => startPendingDirectPayment("transfer")}
                  >
                    <i className="ti ti-building-bank" />
                    <span>
                      <b>Bank transfer</b>
                      <small>Get payment account details</small>
                    </span>
                  </button>
                  <button
                    disabled={paymentBusy}
                    onClick={() => startPendingDirectPayment("ussd")}
                  >
                    <i className="ti ti-device-mobile" />
                    <span>
                      <b>USSD</b>
                      <small>Pay using your bank USSD code</small>
                    </span>
                  </button>
                  <div className={styles.payWithBankRecovery}>
                    <div>
                      <i className="ti ti-building-bank" />
                      <span>
                        <b>Pay with bank</b>
                        <small>Authorize from your bank account</small>
                      </span>
                    </div>
                    <select
                      value={selectedPaymentBank}
                      onChange={(e) => setSelectedPaymentBank(e.target.value)}
                    >
                      <option value="">Select bank</option>
                      {paymentBanks.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={paymentAccountNumber}
                      onChange={(e) => setPaymentAccountNumber(e.target.value)}
                      placeholder="Bank account number"
                      inputMode="numeric"
                    />
                    <button
                      disabled={paymentBusy}
                      onClick={() => startPendingDirectPayment("bank")}
                    >
                      {paymentBusy ? "Starting…" : "Continue"}
                    </button>
                  </div>
                </div>
                {paymentError && (
                  <div className={styles.paymentRecoveryError}>
                    {paymentError}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {selectedOrder && (
        <ReceiptView
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onDownload={downloadReceipt}
        />
      )}
      {selectedPosReceipt && (
        <PremiumReceipt
          receipt={{
            businessName: selectedPosReceipt.businessName,
            businessLogo: selectedPosReceipt.businessLogo,
            businessAddress: selectedPosReceipt.businessAddress,
            businessPhone: selectedPosReceipt.businessPhone,
            saleNumber: selectedPosReceipt.saleNumber,
            slipNumber: selectedPosReceipt.slipNumber,
            currency: selectedPosReceipt.currency,
            customerName: selectedPosReceipt.customerName,
            items: selectedPosReceipt.items,
            subtotal: selectedPosReceipt.subtotal,
            discount: selectedPosReceipt.discount,
            tax: selectedPosReceipt.tax,
            couponCode: selectedPosReceipt.couponCode,
            couponDiscount: selectedPosReceipt.couponDiscount,
            total: selectedPosReceipt.total,
            amountPaid: selectedPosReceipt.amountPaid,
            paymentMethod: selectedPosReceipt.paymentMethod,
            paymentStatus: selectedPosReceipt.paymentStatus,
            createdAt: selectedPosReceipt.createdAt,
          }}
          onClose={() => setSelectedPosReceipt(null)}
        />
      )}
      <NotificationToastStack
        channel="CUSTOMER"
        activeConversationId={
          tab === "messages" ? activeMessageConversationId : null
        }
        onNavigate={(conversationId, messageId) => {
          setMessagesDeepLink({ conversationId, messageId });
          setTab("messages");
        }}
      />
    </>
  );
}