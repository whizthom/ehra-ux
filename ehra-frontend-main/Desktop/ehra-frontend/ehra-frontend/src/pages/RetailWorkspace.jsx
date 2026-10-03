import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dashboard,
  Products,
  Inventory,
  InventoryHistory,
  Orders,
  Customers,
  CustomerDetail,
  POS,
  Expenses,
  Suppliers,
  Reports,
  Store,
  OnlinePayments,
  Settings,
  ProductModal,
  ExpenseModal,
  PurchaseModal,
  CustomerModal,
  SupplierModal,
} from "./retail/RetailSections";
import InviteCustomerModal from "../components/InviteCustomerModal";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  activateProduct,
  getOrders,
  getCustomers,
  getStorefront,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../api/commerceApi";
import {
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  getSuppliers,
  deleteSupplier,
  updateSupplier,
  addSupplier,
  getMovements,
  adjustStock,
  getSales,
  createSale,
  getPurchases,
  createPurchase,
  refundSale,
  reversePurchase,
  getRetailContext,
} from "../api/retailApi";
import { getBusinessType, getMyBusinessProfile } from "../api/businessApi";
import { getCreditsDashboard } from "../api/creditsApi";
import s from "./RetailWorkspace.module.css";
import Logo from "../components/Logo";
import MessagingHub from "../components/messaging/MessagingHub";
import NotificationToastStack from "../components/notifications/NotificationToastStack";
import useMessagingConnection from "../hooks/useMessagingConnection";
import useCustomerInboxBadge from "../hooks/useCustomerInboxBadge";
import EhralCredits from "./EhralCredits";
import NotificationCenter, {
  NotificationsPageView,
} from "../components/notifications/NotificationCenter";
import {
  getRetailNotifications,
  getRetailUnreadCount,
  markAllRetailRead,
} from "../api/notificationApi";
import useCacheWrite from "../hooks/useCacheWrite";
import { hasCached, seedFromCache, putCache, invalidateCache } from "../utils/viewCache";

const today = () => new Date().toISOString().slice(0, 10);
const NAV = [
  ["Dashboard", "⌂", null],
  ["Store", "◈", "settings"],
  ["Products", "▦", "inventory"],
  ["Inventory", "□", "inventory"],
  ["Orders", "↗", "orders"],
  ["Customers", "♙", "customers"],
  // Business <-> Customer messaging for this business type: the owner
  // always, an employee only when the owner has ticked "Customer messages"
  // for them in Settings -> Retail staff permissions.
  ["Messages", "✉", "messages"],
  ["Sales / POS", "₦", "sales"],
  ["Expenses", "≡", "finance"],
  ["Suppliers", "⇄", "finance"],
  ["Reports", "▥", "finance"],
  ["Payments", "$", "finance"],
  ["Ehral Credits", "◉", "credits"],
  ["Settings", "⚙", "settings"],
];
const PERM = {
  settings: "canSettings",
  inventory: "canInventory",
  orders: "canOrders",
  customers: "canCustomers",
  sales: "canSales",
  finance: "canFinance",
  messages: "canMessages",
  credits: "canCredits",
};

// Mobile "More" sheet - split sensibly across operations (same idea as
// MobileNavHub's grouped "More" for the employer/customer dashboards)
// instead of one flat, undifferentiated grid. Ehral Credits is placed
// first in "Money" so it stays easy to find and reach, not buried a few
// taps deep.
const MOBILE_MORE_GROUPS = [
  {
    title: "Money",
    items: [
      { name: "Ehral Credits", icon: "ti-wallet" },
      { name: "Payments", icon: "ti-credit-card" },
      { name: "Expenses", icon: "ti-receipt-2" },
      { name: "Reports", icon: "ti-chart-bar" },
    ],
  },
  {
    title: "Catalog & Stock",
    items: [
      { name: "Inventory", icon: "ti-box" },
      { name: "Suppliers", icon: "ti-truck-delivery" },
      { name: "Store", icon: "ti-building-store" },
    ],
  },
  {
    title: "Customers",
    items: [
      { name: "Customers", icon: "ti-users-group" },
      { name: "Messages", icon: "ti-message-circle" },
    ],
  },
  {
    title: "Account",
    items: [{ name: "Settings", icon: "ti-settings" }],
  },
];
const MOBILE_MORE_DESCRIPTIONS = {
  "Ehral Credits": "Balance, top-ups and usage.",
  Payments: "Online payments and payouts.",
  Expenses: "Track business expenses.",
  Reports: "Sales and performance reports.",
  Inventory: "Stock levels and adjustments.",
  Suppliers: "Suppliers and purchases.",
  Store: "Storefront and business details.",
  Customers: "Customer relationships.",
  Messages: "Chat with your customers.",
  Settings: "Business and staff settings.",
};

const EMPTY_RETAIL_DATA = {
  products: [],
  orders: [],
  customers: [],
  expenses: [],
  suppliers: [],
  movements: [],
  sales: [],
  purchases: [],
};

// The context type saved by the login/switch flow (api/authApi.js). Only
// used as a hint to start owner lookups early, never to authorise anything.
function readSessionContextType() {
  try {
    return localStorage.getItem("contextType");
  } catch {
    return null;
  }
}

// Returns `prev` when `next` is deeply identical, so React state (and any
// effect keyed on it) is left untouched by a re-fetch that changed nothing.
function keepIfSame(prev, next) {
  try {
    return prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
  } catch {
    return next;
  }
}

export default function RetailWorkspace() {
  const nav = useNavigate();
  // The live WebSocket connection (presence, real-time messages, badges) is
  // opened once at the top of the page, exactly like the generic dashboards
  // do - see useMessagingConnection's own doc.
  useMessagingConnection();
  const [tab, setTab] = useState("Dashboard");
  const [inventoryHistory, setInventoryHistory] = useState(false);
  const [viewingCustomerId, setViewingCustomerId] = useState(null);
  // Entering the workspace used to start from nothing every time: a full
  // page loader while the context (and, for owners, the business profile)
  // loaded, then zeroed dashboard cards while the data loaded. These are now
  // seeded from the in-memory view cache (utils/viewCache.js) so a return
  // visit opens immediately; everything is still re-fetched on every visit
  // and replaces the cached copy. An access-denied result is never cached,
  // and the server still authorises every request.
  const [business, setBusiness] = useState(() => seedFromCache("retail:business", null)),
    [type, setType] = useState(() => seedFromCache("retail:type", null)),
    [context, setContext] = useState(() => seedFromCache("retail:context", null)),
    [businessCurrency, setBusinessCurrency] = useState(() =>
      seedFromCache("retail:currency", "NGN"),
    );
  const [data, setData] = useState(() => seedFromCache("retail:data", EMPTY_RETAIL_DATA));
  useCacheWrite("retail:data", data);
  // Available Ehral Credits balance - loaded alongside the rest of the
  // workspace data so it can ride along as a chip on the dashboard's hero
  // panel and as a live balance in the mobile "More" sheet, instead of
  // only being visible once the person is already on the Ehral Credits
  // tab.
  const [credits, setCredits] = useState(null);
  const [report, setReport] = useState(null),
    [store, setStore] = useState(null),
    [loading, setLoading] = useState(() => !hasCached("retail:context")),
    // False until the workspace data has loaded at least once in a session
    // that has nothing cached. Without this the dashboard painted zeros
    // (sales, products, orders) for a moment before the real numbers.
    [dataReady, setDataReady] = useState(() => hasCached("retail:data")),
    [modal, setModal] = useState(null),
    [editing, setEditing] = useState(null),
    [query, setQuery] = useState(""),
    [mobileMore, setMobileMore] = useState(false);
  // Customer messaging: hub thread state (mobile full-screen), a deep link
  // from a toast, and which conversation is open (to mute its toast).
  const [messagesThreadOpen, setMessagesThreadOpen] = useState(false);
  const [messagesDeepLink, setMessagesDeepLink] = useState(null);
  const [activeMessageConversationId, setActiveMessageConversationId] =
    useState(null);
  // Set when an "Approval slip accepted/declined" bell notification is
  // tapped, so the POS tab's Approval slips table can scroll to and outline
  // that exact row once it renders.
  const [approvalHighlightId, setApprovalHighlightId] = useState(null);
  const handleNotificationClick = (n) => {
    if (
      (n?.type === "RETAIL_SALE_APPROVAL_ACCEPTED" ||
        n?.type === "RETAIL_SALE_APPROVAL_DECLINED") &&
      n?.referenceId
    ) {
      setApprovalHighlightId(n.referenceId);
      setTab("Sales / POS");
    }
  };
  const canMessage = Boolean(context && (context.owner || context.canMessages));
  const inbox = useCustomerInboxBadge({ enabled: canMessage });
  const money = (n) =>
    `${businessCurrency} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const allowed = useMemo(() => {
    const a = new Set(["Dashboard", "Notifications"]);
    if (!context) return a;
    NAV.forEach(([name, , p]) => {
      if (!p || context.owner || context[PERM[p]]) a.add(name);
    });
    return a;
  }, [context]);
  const goBack = () => nav(context?.owner ? "/dashboard" : "/my-dashboard");
  const load = async () => {
    try {
    const jobs = [
      ["products", getProducts(true)],
      ["orders", getOrders()],
      ["customers", getCustomers()],
    ];
    if (context?.owner || context.canFinance)
      jobs.push(
        ["expenses", getExpenses()],
        ["suppliers", getSuppliers()],
        ["purchases", getPurchases()],
      );
    if (context?.owner || context.canInventory)
      jobs.push(["movements", getMovements()]);
    if (context?.owner || context.canSales) jobs.push(["sales", getSales()]);
    if (context?.owner || context.canSettings)
      jobs.push(["store", getStorefront()]);
    if (context?.owner || context.canCredits)
      jobs.push(["credits", getCreditsDashboard()]);
    const results = await Promise.allSettled(jobs.map(([, p]) => p));
    const next = { ...data };
    results.forEach((r, i) => {
      const [k] = jobs[i];
      if (r.status === "fulfilled") {
        if (k === "store") {
          setStore(r.value.data);
          if (r.value.data?.currency)
            setBusinessCurrency(r.value.data.currency);
        } else if (k === "credits") {
          // getCreditsDashboard() already unwraps the axios response
          // (see api/creditsApi.js), so r.value here is the credits data
          // itself, not {data: ...} like the other jobs above.
          setCredits(r.value);
        } else next[k] = r.value.data || [];
      }
    });
    setData(next);
    } finally {
      setDataReady(true);
    }
  };
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        // The owner-only lookups (business type + profile) do not depend on
        // the context response, and the employer dashboard already calls
        // them for every employer session. For an employer session start
        // them now, in parallel, instead of waiting a whole round trip for
        // the context first. If they fail, awaiting this same promise below
        // rethrows exactly as the sequential version did.
        let ownerLookups = null;
        if (readSessionContextType() === "EMPLOYER") {
          ownerLookups = Promise.all([getBusinessType(), getMyBusinessProfile()]);
          ownerLookups.catch(() => {}); // avoid an unhandled rejection if never awaited
        }
        const { data: c } = await getRetailContext();
        if (dead) return;
        // Keep the SAME object when nothing changed. The data load below is
        // keyed on `context`, so swapping in an identical copy of a seeded
        // context would load the whole workspace twice.
        setContext((prev) => keepIfSame(prev, c));
        putCache("retail:context", c);
        const basicType = { businessType: c.businessType, businessName: c.businessName };
        const basicBusiness = { id: c.businessId, name: c.businessName };
        if (!hasCached("retail:type")) setType(basicType);
        if (!hasCached("retail:business")) setBusiness(basicBusiness);
        if (c.owner) {
          const [t, b] = await (ownerLookups ||
            Promise.all([getBusinessType(), getMyBusinessProfile()]));
          if (!dead) {
            const currency = b.data?.currency || c.businessCurrency || "NGN";
            setType((prev) => keepIfSame(prev, t.data));
            setBusiness((prev) => keepIfSame(prev, b.data));
            setBusinessCurrency(currency);
            putCache("retail:type", t.data);
            putCache("retail:business", b.data);
            putCache("retail:currency", currency);
          }
        } else {
          putCache("retail:type", basicType);
          putCache("retail:business", basicBusiness);
        }
      } catch (e) {
        // Access lost (or the request failed): drop everything cached for
        // this workspace so a stale copy can never be shown again.
        invalidateCache("retail:");
        if (!dead)
          setContext({
            denied: true,
            message:
              e?.response?.data?.message ||
              "You do not have access to this Retail Workspace.",
          });
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);
  useEffect(() => {
    if (!context) return;
    if (context.owner || context.canWorkspace)
      load(); /* permission-aware load; releases the loader when it finishes */
    else setDataReady(true); // denied / no workspace access: nothing to load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);
  useEffect(() => {
    if (!allowed.has(tab)) setTab("Dashboard");
  }, [allowed, tab]);
  const active = data.products.filter((p) => p.status === "ACTIVE");
  const archivedProducts = data.products.filter((p) => p.status !== "ACTIVE");
  const productCategories = useMemo(
    () => [
      ...new Set(
        data.products.map((p) => (p.category || "").trim()).filter(Boolean),
      ),
    ],
    [data.products],
  );
  const expenseCategories = useMemo(
    () => [
      ...new Set(
        data.expenses.map((x) => (x.category || "").trim()).filter(Boolean),
      ),
    ],
    [data.expenses],
  );
  const low = active.filter(
    (p) =>
      p.trackInventory &&
      Number(p.stockQuantity) <= Number(p.lowStockThreshold || 5),
  );
  const pending = data.orders.filter((o) =>
    ["PENDING", "CONFIRMED", "PROCESSING"].includes(o.status),
  );
  const todaySales = data.sales
    .filter((x) => String(x.createdAt || "").slice(0, 10) === today())
    .reduce((n, x) => n + Number(x.total || 0), 0);
  const monthSales = data.sales
    .filter(
      (x) => String(x.createdAt || "").slice(0, 7) === today().slice(0, 7),
    )
    .reduce((n, x) => n + Number(x.total || 0), 0);
  const filtered = (arr, fields) =>
    arr.filter((x) =>
      fields.some((k) =>
        String(x[k] || "")
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    );
  const runLoad = () => load();
  if (loading || (context && !dataReady))
    return (
      <div className={s.loading}>
        <div className={s.spinner} />
        <span>Preparing your retail workspace</span>
      </div>
    );
  if (context?.denied || (!context?.owner && !context?.canWorkspace))
    return (
      <div className={s.loading}>
        <h2>Retail Workspace access is not enabled for you</h2>
        <p>
          {context?.message ||
            "Your employer has not granted Retail Workspace access."}
        </p>
        <button className={s.primary} onClick={goBack}>
          Back to Ehral
        </button>
      </div>
    );
  if (type?.businessType !== "RETAIL")
    return (
      <div className={s.loading}>
        <h2>Retail Workspace is not enabled</h2>
        <button className={s.primary} onClick={() => nav("/business-setup")}>
          Set up your business
        </button>
      </div>
    );
  return (
    <div className={s.app}>
      <aside className={s.sidebar}>
        <div className={s.logo}>
          <Logo size={42} variant="horizontal" tone="sidebar" title="Ehral" />
          <div className={s.logoLabel}>
            <span>Retail Workspace</span>
          </div>
        </div>
        <nav>
          {NAV.filter(([n]) => allowed.has(n)).map(([n, i]) => (
            <button
              key={n}
              className={tab === n ? s.navActive : ""}
              onClick={() => {
                setInventoryHistory(false);
                setViewingCustomerId(null);
                setTab(n);
              }}
            >
              <b>{i}</b>
              {n}
              {n === "Messages" && inbox.total > 0 && (
                <em className={s.navBadge}>
                  {inbox.total > 99 ? "99+" : inbox.total}
                </em>
              )}
            </button>
          ))}
        </nav>
      </aside>
      <main className={s.main}>
        <header className={s.header}>
          <div className={s.headerTop}>
            <div className={s.headerIdentity}>
              <Logo
                size={24}
                variant="horizontal"
                tone="default"
                title="Ehral"
              />
              <span className={s.kicker}>Retail Workspace</span>
              <h1>{tab}</h1>
            </div>
            <div className={s.headerActions}>
              <NotificationCenter
                mode="retail"
                fetchNotifications={getRetailNotifications}
                fetchUnreadCount={getRetailUnreadCount}
                markAllRead={markAllRetailRead}
                onViewAll={() => setTab("Notifications")}
                onNotificationClick={handleNotificationClick}
                enabled={tab !== "Notifications"}
              />
              <div className={s.avatar}>
                {(business?.name || "B").slice(0, 1).toUpperCase()}
              </div>
            </div>
          </div>
          <p className={s.headerMeta}>
            {business?.name} <span>•</span>{" "}
            {context.owner
              ? "Business owner access."
              : `${context.role || "Employee"} access granted by your employer.`}
          </p>
        </header>
        <div
          className={`${s.content} ${tab === "Messages" ? s.contentMessages : ""}`}
        >
          {tab === "Messages" && canMessage && (
            <div
              className={`${s.messagesHost} ${messagesThreadOpen ? s.messagesHostThread : ""}`}
            >
              <MessagingHub
                mode="business"
                onThreadOpenChange={setMessagesThreadOpen}
                deepLink={messagesDeepLink}
                onDeepLinkConsumed={() => setMessagesDeepLink(null)}
                onActiveConversationChange={setActiveMessageConversationId}
                onBadgeChange={inbox.refresh}
              />
            </div>
          )}
          {tab === "Notifications" && (
            <NotificationsPageView
              mode="retail"
              fetchNotifications={getRetailNotifications}
              fetchUnreadCount={getRetailUnreadCount}
              markAllRead={markAllRetailRead}
              onNotificationClick={handleNotificationClick}
            />
          )}
          {tab === "Dashboard" && (
            <Dashboard
              todaySales={todaySales}
              monthSales={monthSales}
              active={active}
              low={low}
              pending={pending}
              data={data}
              setTab={setTab}
              money={money}
              allowedTabs={allowed}
              credits={credits}
            />
          )}{" "}
          {tab === "Store" && (
            <Store
              store={store}
              setStore={setStore}
              business={business}
              owner={context.owner}
              onCurrencyChange={(c) => {
                setBusinessCurrency(c);
                setBusiness((prev) => (prev ? { ...prev, currency: c } : prev));
              }}
              money={money}
            />
          )}{" "}
          {tab === "Products" && (
            <Products
              items={filtered(active, ["name", "sku", "category", "brand"])}
              archivedItems={filtered(archivedProducts, [
                "name",
                "sku",
                "category",
                "brand",
              ])}
              query={query}
              setQuery={setQuery}
              onAdd={() => {
                setEditing(null);
                setModal("product");
              }}
              onEdit={(p) => {
                setEditing(p);
                setModal("product");
              }}
              onDelete={async (p) => {
                await deleteProduct(p.id);
                runLoad();
              }}
              onRestore={async (p) => {
                try {
                  await restoreProduct(p.id);
                  runLoad();
                } catch (e) {
                  alert(
                    e?.response?.data?.message ||
                      "Couldn't restore this product. Please try again.",
                  );
                }
              }}
              onActivate={async (p) => {
                try {
                  await activateProduct(p.id);
                  runLoad();
                } catch (e) {
                  alert(
                    e?.response?.data?.message ||
                      "Couldn't activate this product. Please try again.",
                  );
                }
              }}
              money={money}
            />
          )}{" "}
          {tab === "Inventory" &&
            (inventoryHistory ? (
              <InventoryHistory
                products={active}
                onBack={() => setInventoryHistory(false)}
              />
            ) : (
              <Inventory
                data={data}
                products={active}
                onAdjust={async (p, t, q, n) => {
                  await adjustStock(p.id, t, q, n);
                  runLoad();
                }}
                money={money}
                onViewHistory={() => setInventoryHistory(true)}
              />
            ))}{" "}
          {tab === "Orders" && (
            <Orders
              items={data.orders}
              query={query}
              setQuery={setQuery}
              money={money}
              canFinance={context.owner || context.canFinance}
            />
          )}{" "}
          {tab === "Customers" &&
            (viewingCustomerId ? (
              <CustomerDetail
                membershipId={viewingCustomerId}
                money={money}
                businessCurrency={businessCurrency}
                canFinance={context.owner || context.canFinance}
                onBack={() => setViewingCustomerId(null)}
              />
            ) : (
              <Customers
                items={filtered(data.customers, [
                  "firstName",
                  "lastName",
                  "phone",
                  "email",
                ])}
                query={query}
                setQuery={setQuery}
                onAdd={() => {
                  setEditing(null);
                  setModal("customer");
                }}
                onInvite={() => setModal("inviteCustomer")}
                onEdit={(x) => {
                  setEditing(x);
                  setModal("customer");
                }}
                onDelete={async (id) => {
                  await deleteCustomer(id);
                  runLoad();
                }}
                onView={(c) => setViewingCustomerId(c.membershipId)}
              />
            ))}{" "}
          {tab === "Sales / POS" && (
            <POS
              products={active}
              sales={data.sales}
              customers={data.customers}
              business={business}
              onDone={async (d) => {
                const r = await createSale(d);
                setModal(null);
                runLoad();
                return r;
              }}
              onApprovalsChanged={runLoad}
              highlightApprovalId={approvalHighlightId}
              onHighlightConsumed={() => setApprovalHighlightId(null)}
              canFinance={context.owner || context.canFinance}
              onRefund={async (id) => {
                if (confirm("Refund this sale and restore its inventory?")) {
                  await refundSale(id);
                  runLoad();
                }
              }}
              money={money}
            />
          )}{" "}
          {tab === "Expenses" && (
            <Expenses
              items={data.expenses}
              query={query}
              setQuery={setQuery}
              onAdd={() => {
                setEditing(null);
                setModal("expense");
              }}
              onEdit={(x) => {
                setEditing(x);
                setModal("expense");
              }}
              onDelete={async (id) => {
                await deleteExpense(id);
                runLoad();
              }}
              money={money}
            />
          )}{" "}
          {tab === "Suppliers" && (
            <Suppliers
              items={data.suppliers}
              purchases={data.purchases}
              onAdd={() => {
                setEditing(null);
                setModal("supplier");
              }}
              onEdit={(x) => {
                setEditing(x);
                setModal("supplier");
              }}
              onPurchase={() => setModal("purchase")}
              onDelete={async (id) => {
                await deleteSupplier(id);
                runLoad();
              }}
              money={money}
              canFinance={context.owner || context.canFinance}
              onReversePurchase={async (id) => {
                if (
                  confirm(
                    "Reverse this purchase? This will restore the recorded stock quantity and mark the purchase reversed.",
                  )
                ) {
                  try {
                    await reversePurchase(id);
                    runLoad();
                  } catch (e) {
                    alert(
                      e?.response?.data?.message ||
                        "This purchase cannot be reversed because subsequent inventory activity exists or the purchase is not eligible for reversal.",
                    );
                  }
                }
              }}
            />
          )}{" "}
          {tab === "Reports" && (
            <Reports report={report} setReport={setReport} money={money} />
          )}{" "}
          {tab === "Payments" && (
            <OnlinePayments owner={context.owner} money={money} />
          )}{" "}
          {tab === "Ehral Credits" && context.owner && (
            <EhralCredits onBack={() => setTab("Dashboard")} />
          )}{" "}
          {tab === "Settings" && (
            <Settings
              type={type}
              business={business}
              owner={context.owner}
              onBack={goBack}
            />
          )}
        </div>
      </main>
      {modal === "product" && (
        <ProductModal
          item={editing}
          currency={businessCurrency}
          canFinance={context.owner || context.canFinance}
          categories={productCategories}
          onClose={() => setModal(null)}
          onSave={async (d) => {
            // This used to have no try/catch at all: any failure (a
            // validation error, an insufficient-Ehral-Credits charge, or
            // anything else) threw silently — the modal stayed open, the
            // Save button just looked like it did nothing, with no
            // indication of why.
            try {
              const saved = editing
                ? (await updateProduct(editing.id, d))?.data
                : (await createProduct(d))?.data;
              setModal(null);
              runLoad();
              // A brand-new product that couldn't be charged for
              // PRODUCT_ACTIVATION still saves — it's just not visible to
              // customers yet. Tell the person why, since nothing else
              // will (no error was thrown for this case).
              if (!editing && saved && saved.creditActive === false) {
                alert(
                  (saved.activationBlockedReason ||
                    "Insufficient Ehral Credits.") +
                    "\n\nThe product was saved, but it won't show up on your storefront until it's activated. Top up your Ehral Credits, then hit Activate on it from the catalog.",
                );
              }
            } catch (e) {
              alert(
                e?.response?.data?.message ||
                  "Couldn't save this product. Please check the details and try again.",
              );
            }
          }}
        />
      )}
      {modal === "expense" && (
        <ExpenseModal
          item={editing}
          categories={expenseCategories}
          onClose={() => setModal(null)}
          onSave={async (d) => {
            editing ? await updateExpense(editing.id, d) : await addExpense(d);
            setModal(null);
            runLoad();
          }}
        />
      )}
      {modal === "purchase" && (
        <PurchaseModal
          products={active}
          suppliers={data.suppliers}
          onClose={() => setModal(null)}
          onSave={async (d) => {
            await createPurchase(d);
            setModal(null);
            runLoad();
          }}
        />
      )}
      {modal === "customer" && (
        <CustomerModal
          item={editing}
          onClose={() => setModal(null)}
          onSave={async (d) => {
            editing
              ? await updateCustomer(editing.id, d)
              : await createCustomer(d);
            setModal(null);
            runLoad();
          }}
        />
      )}
      {modal === "supplier" && (
        <SupplierModal
          item={editing}
          onClose={() => setModal(null)}
          onSave={async (d) => {
            editing
              ? await updateSupplier(editing.id, d)
              : await addSupplier(d);
            setModal(null);
            runLoad();
          }}
        />
      )}
      {modal === "inviteCustomer" && (
        <InviteCustomerModal
          open
          onClose={() => setModal(null)}
          companyName={business?.name}
        />
      )}
      {canMessage && (
        <NotificationToastStack
          channel="CUSTOMER"
          activeConversationId={
            tab === "Messages" ? activeMessageConversationId : null
          }
          onNavigate={(conversationId, messageId) => {
            setInventoryHistory(false);
            setMobileMore(false);
            setTab("Messages");
            setMessagesDeepLink({ conversationId, messageId });
          }}
        />
      )}
      <nav className={s.mobileNav} aria-label="Retail mobile navigation">
        <button
          type="button"
          className={
            tab === "Dashboard" && !mobileMore
              ? s.mobileNavItemActive
              : s.mobileNavItem
          }
          onClick={() => {
            setInventoryHistory(false);
            setMobileMore(false);
            setTab("Dashboard");
          }}
        >
          <span className={s.mobileNavIcon}>
            <i className="ti ti-home" aria-hidden="true" />
          </span>
          <span>Home</span>
        </button>
        <button
          type="button"
          className={
            tab === "Products" && !mobileMore
              ? s.mobileNavItemActive
              : s.mobileNavItem
          }
          onClick={() => {
            setInventoryHistory(false);
            setMobileMore(false);
            setTab("Products");
          }}
        >
          <span className={s.mobileNavIcon}>
            <i className="ti ti-package" aria-hidden="true" />
          </span>
          <span>Products</span>
        </button>
        <button
          type="button"
          className={
            tab === "Sales / POS" && !mobileMore
              ? s.mobileNavItemActive
              : s.mobileNavItem
          }
          onClick={() => {
            setInventoryHistory(false);
            setMobileMore(false);
            setTab("Sales / POS");
          }}
        >
          <span className={s.mobileNavIcon}>
            <i className="ti ti-shopping-cart" aria-hidden="true" />
          </span>
          <span>POS</span>
        </button>
        <button
          type="button"
          className={
            tab === "Orders" && !mobileMore
              ? s.mobileNavItemActive
              : s.mobileNavItem
          }
          onClick={() => {
            setInventoryHistory(false);
            setMobileMore(false);
            setTab("Orders");
          }}
        >
          <span className={s.mobileNavIcon}>
            <i className="ti ti-clipboard-list" aria-hidden="true" />
          </span>
          <span>Orders</span>
        </button>
        <button
          type="button"
          className={mobileMore ? s.mobileNavItemActive : s.mobileNavItem}
          onClick={() => setMobileMore((v) => !v)}
        >
          <span className={s.mobileNavIcon}>
            <i className="ti ti-dots" aria-hidden="true" />
            {inbox.total > 0 && (
              <span
                className={s.mobileNavDot}
                aria-label="Unread customer messages"
              />
            )}
          </span>
          <span>More</span>
        </button>
      </nav>
      {mobileMore && (
        <>
          <button
            className={s.mobileMoreScrim}
            aria-label="Close menu"
            onClick={() => setMobileMore(false)}
          />
          <section
            className={s.mobileMoreSheet}
            aria-label="More retail options"
          >
            <div className={s.mobileMoreHandle} />
            <div className={s.mobileMoreHeader}>
              <div>
                <span>RETAIL WORKSPACE</span>
                <h2>More</h2>
                <p>Everything else for running your business.</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMore(false)}
                aria-label="Close"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
            <div className={s.mobileMoreGroups}>
              {MOBILE_MORE_GROUPS.map((group) => {
                const items = group.items.filter(({ name }) =>
                  allowed.has(name),
                );
                if (!items.length) return null;
                return (
                  <section key={group.title} className={s.mobileMoreGroup}>
                    <h3>{group.title}</h3>
                    <div className={s.mobileMoreItemList}>
                      {items.map(({ name, icon }) => (
                        <button
                          key={name}
                          type="button"
                          className={
                            tab === name
                              ? s.mobileMoreItemRowActive
                              : s.mobileMoreItemRow
                          }
                          onClick={() => {
                            setInventoryHistory(false);
                            setViewingCustomerId(null);
                            setTab(name);
                            setMobileMore(false);
                          }}
                        >
                          <span className={s.mobileMoreIconBox}>
                            <i className={`ti ${icon}`} aria-hidden="true" />
                          </span>
                          <span className={s.mobileMoreItemCopy}>
                            <strong>{name}</strong>
                            <small>
                              {name === "Ehral Credits" && credits
                                ? `Balance: ${money(credits.availableCredits)}`
                                : MOBILE_MORE_DESCRIPTIONS[name]}
                            </small>
                          </span>
                          {name === "Messages" && inbox.total > 0 && (
                            <em className={s.navBadgeInline}>
                              {inbox.total > 99 ? "99+" : inbox.total}
                            </em>
                          )}
                          <i
                            className="ti ti-chevron-right"
                            aria-hidden="true"
                          />
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
