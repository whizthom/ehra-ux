import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dashboard,
  Products,
  Inventory,
  InventoryHistory,
  Orders,
  Customers,
  POS,
  Expenses,
  Suppliers,
  Reports,
  Store,
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
import s from "./RetailWorkspace.module.css";
import Logo from "../components/Logo";
import MessagingHub from "../components/messaging/MessagingHub";
import NotificationToastStack from "../components/notifications/NotificationToastStack";
import useMessagingConnection from "../hooks/useMessagingConnection";
import useCustomerInboxBadge from "../hooks/useCustomerInboxBadge";

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
};

export default function RetailWorkspace() {
  const nav = useNavigate();
  // The live WebSocket connection (presence, real-time messages, badges) is
  // opened once at the top of the page, exactly like the generic dashboards
  // do - see useMessagingConnection's own doc.
  useMessagingConnection();
  const [tab, setTab] = useState("Dashboard");
  const [inventoryHistory, setInventoryHistory] = useState(false);
  const [business, setBusiness] = useState(null),
    [type, setType] = useState(null),
    [context, setContext] = useState(null),
    [businessCurrency, setBusinessCurrency] = useState("NGN");
  const [data, setData] = useState({
    products: [],
    orders: [],
    customers: [],
    expenses: [],
    suppliers: [],
    movements: [],
    sales: [],
    purchases: [],
  });
  const [report, setReport] = useState(null),
    [store, setStore] = useState(null),
    [loading, setLoading] = useState(true),
    [modal, setModal] = useState(null),
    [editing, setEditing] = useState(null),
    [query, setQuery] = useState(""),
    [mobileMore, setMobileMore] = useState(false);
  // Customer messaging: hub thread state (mobile full-screen), a deep link
  // from a toast, and which conversation is open (to mute its toast).
  const [messagesThreadOpen, setMessagesThreadOpen] = useState(false);
  const [messagesDeepLink, setMessagesDeepLink] = useState(null);
  const [activeMessageConversationId, setActiveMessageConversationId] = useState(null);
  const canMessage = Boolean(context && (context.owner || context.canMessages));
  const inbox = useCustomerInboxBadge({ enabled: canMessage });
  const money = (n) =>
    `${businessCurrency} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const allowed = useMemo(() => {
    const a = new Set(["Dashboard"]);
    if (!context) return a;
    NAV.forEach(([name, , p]) => {
      if (!p || context.owner || context[PERM[p]]) a.add(name);
    });
    return a;
  }, [context]);
  const goBack = () => nav(context?.owner ? "/dashboard" : "/my-dashboard");
  const load = async () => {
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
    const results = await Promise.allSettled(jobs.map(([, p]) => p));
    const next = { ...data };
    results.forEach((r, i) => {
      const [k] = jobs[i];
      if (r.status === "fulfilled") {
        if (k === "store") {
          setStore(r.value.data);
          if (r.value.data?.currency)
            setBusinessCurrency(r.value.data.currency);
        } else next[k] = r.value.data || [];
      }
    });
    setData(next);
  };
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { data: c } = await getRetailContext();
        if (dead) return;
        setContext(c);
        setType({ businessType: c.businessType, businessName: c.businessName });
        setBusiness({ id: c.businessId, name: c.businessName });
        if (c.owner) {
          const [t, b] = await Promise.all([
            getBusinessType(),
            getMyBusinessProfile(),
          ]);
          if (!dead) {
            setType(t.data);
            setBusiness(b.data);
            setBusinessCurrency(
              b.data?.currency || c.businessCurrency || "NGN",
            );
          }
        }
      } catch (e) {
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
    if (context?.owner || context?.canWorkspace)
      load(); /* permission-aware load */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);
  useEffect(() => {
    if (!allowed.has(tab)) setTab("Dashboard");
  }, [allowed, tab]);
  const active = data.products.filter((p) => p.status === "ACTIVE");
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
  if (loading)
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
        <div className={s.businessSwitch}>
          <span>BUSINESS</span>
          <strong>{business?.name || "Your business"}</strong>
          <em>
            Retail <i>Locked</i>
          </em>
        </div>
        <nav>
          {NAV.filter(([n]) => allowed.has(n)).map(([n, i]) => (
            <button
              key={n}
              className={tab === n ? s.navActive : ""}
              onClick={() => {
                setInventoryHistory(false);
                setTab(n);
              }}
            >
              <b>{i}</b>
              {n}
              {n === "Messages" && inbox.total > 0 && (
                <em className={s.navBadge}>{inbox.total > 99 ? "99+" : inbox.total}</em>
              )}
            </button>
          ))}
        </nav>
      </aside>
      <main className={s.main}>
        <header className={s.header}>
          <div className={s.headerTop}>
            <div className={s.headerIdentity}>
              <Logo size={24} variant="horizontal" tone="default" title="Ehral" />
              <span className={s.kicker}>Retail Workspace</span>
              <h1>{tab}</h1>
            </div>
            <div className={s.headerActions}>
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
        <div className={`${s.content} ${tab === "Messages" ? s.contentMessages : ""}`}>
          {tab === "Messages" && canMessage && (
            <div className={`${s.messagesHost} ${messagesThreadOpen ? s.messagesHostThread : ""}`}>
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
          {tab === "Customers" && (
            <Customers
              items={filtered(data.customers, ["firstName", "lastName", "phone", "email"])}
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
            />
          )}{" "}
          {tab === "Sales / POS" && (
            <POS
              products={active}
              sales={data.sales}
              onDone={async (d) => {
                const r = await createSale(d);
                setModal(null);
                runLoad();
                return r;
              }}
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
          onClose={() => setModal(null)}
          onSave={async (d) => {
            editing
              ? await updateProduct(editing.id, d)
              : await createProduct(d);
            setModal(null);
            runLoad();
          }}
        />
      )}
      {modal === "expense" && (
        <ExpenseModal
          item={editing}
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
          activeConversationId={tab === "Messages" ? activeMessageConversationId : null}
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
            {inbox.total > 0 && <span className={s.mobileNavDot} aria-label="Unread customer messages" />}
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
            <div className={s.mobileMoreGrid}>
              {NAV.filter(
                ([name]) =>
                  !["Dashboard", "Products", "Sales / POS", "Orders"].includes(
                    name,
                  ) && allowed.has(name),
              ).map(([name, icon]) => (
                <button
                  key={name}
                  type="button"
                  className={
                    tab === name ? s.mobileMoreItemActive : s.mobileMoreItem
                  }
                  onClick={() => {
                    setInventoryHistory(false);
                    setTab(name);
                    setMobileMore(false);
                  }}
                >
                  <span>
                    <b>{icon}</b>
                  </span>
                  <strong>{name}</strong>
                  {name === "Messages" && inbox.total > 0 && (
                    <em className={s.navBadgeInline}>{inbox.total > 99 ? "99+" : inbox.total}</em>
                  )}
                  <i className="ti ti-chevron-right" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}