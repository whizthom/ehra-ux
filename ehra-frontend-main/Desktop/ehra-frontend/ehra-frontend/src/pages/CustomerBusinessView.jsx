import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Logo from "../components/Logo";
import { connectCustomerToBusinessId, getCustomerBusinessView } from "../api/commerceApi";
import { useAuth } from "../context/AuthContext";
import styles from "./CustomerDashboard.module.css";

const money = (currency, value) =>
  `${currency || "NGN"} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const initials = (name = "Ehral") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

export default function CustomerBusinessView() {
  const { businessId } = useParams();
  const nav = useNavigate();
  const { user, switchContext } = useAuth();
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getCustomerBusinessView(businessId);
      setView(r.data);
    } catch (e) {
      setNotice(e?.response?.data?.message || "This business could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    if (!view?.business || working) return;
    setWorking(true);
    setNotice("");
    try {
      const r = await connectCustomerToBusinessId(view.business.businessId);
      await switchContext("CUSTOMER", r.data.membershipId);
      await load();
      setNotice("You are now connected to this business on Ehral.");
    } catch (e) {
      setNotice(e?.response?.data?.message || "We could not connect you to this business.");
    } finally {
      setWorking(false);
    }
  };

  const business = view?.business;
  const storefront = view?.storefront;
  const products = view?.products || [];

  if (loading && !view) {
    return <div className={styles.loadingScreen}><div className={styles.loadingBrand}><Logo size={126} variant="horizontal" tone="brand" title="Ehral" /></div><span>Opening business…</span></div>;
  }

  if (!business) {
    return <div className={styles.loadingScreen}><Logo size={126} variant="horizontal" tone="brand" title="Ehral" /><strong>Business unavailable</strong><button className={styles.heroPrimary} onClick={() => nav("/customer-dashboard?tab=discover")}>Back to Discover</button></div>;
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><Logo size={116} variant="horizontal" tone="brand" title="Ehral" /><span>Customer</span></div>
        <div className={styles.profileMini}>
          <div className={styles.profileAvatar}>{initials("My Ehral")}</div>
          <div><strong>My Ehral</strong><small>Customer</small></div>
        </div>
        <nav>
          {[
            ["/customer-dashboard", "Dashboard", "layout-dashboard"],
            ["/customer-dashboard?tab=discover", "Discover", "compass"],
            ["/customer-dashboard?tab=businesses", "My businesses", "building-store"],
            ["/customer-dashboard?tab=orders", "Orders", "shopping-bag"],
            ["/customer-dashboard?tab=receipts", "Receipts", "receipt"],
            ["/customer-dashboard?tab=messages", "Messages", "messages"],
            ["/customer-dashboard?tab=spending", "Spending", "chart-donut"],
            ["/customer-dashboard?tab=account", "Account", "user-circle"],
          ].map(([path, label, icon]) => (
            <button key={path} onClick={() => nav(path)}><i className={`ti ti-${icon}`} /><span>{label}</span></button>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <button onClick={() => nav("/my-accounts")}><i className="ti ti-switch-horizontal" /> My Accounts</button>
          <button onClick={() => nav("/customer-dashboard?tab=account")}><i className="ti ti-settings" /> Account settings</button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button className={styles.mobileBrand} onClick={() => nav("/customer-dashboard")}><Logo size={96} variant="horizontal" tone="brand" title="Ehral" /></button>
          <div className={styles.topTitle}><span>MY EHRAL</span><h1>{business.businessName}</h1></div>
          <div className={styles.topActions}><button className={styles.avatarButton} onClick={() => nav("/my-accounts")} aria-label="Open My Accounts"><i className="ti ti-switch-horizontal" /></button></div>
        </header>

        {notice && <div className={styles.toast} role="status"><span className={styles.toastIcon}><i className="ti ti-sparkles" /></span><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notification"><i className="ti ti-x" /></button></div>}

        <div className={styles.content}>
          <section className={styles.businessViewHero}>
            <div className={styles.businessViewIdentity}>
              <div className={styles.businessViewLogo}>{business.businessLogo ? <img src={business.businessLogo} alt="" /> : initials(business.businessName)}</div>
              <div><span className={styles.eyebrow}>{business.businessTypeLabel || business.businessType || "EHRAL BUSINESS"}</span><h2>{business.businessName}</h2><p>{business.businessCategory || "Registered on Ehral"}</p></div>
            </div>
            <div className={styles.businessViewActions}>
              {business.connected ? <span className={styles.connectedBadge}><i className="ti ti-circle-check-filled" /> Connected customer</span> : <button className={styles.heroPrimary} onClick={connect} disabled={working}>{working ? "Connecting…" : "Connect with this business"} <i className="ti ti-user-plus" /></button>}
            </div>
          </section>

          <section className={styles.businessViewGrid}>
            <div className={styles.section}>
              <div className={styles.sectionIntro}><span className={styles.eyebrow}>BUSINESS</span><h2>About this business</h2><p>{business.description || "This business has registered on Ehral and is available to discover through your customer account."}</p></div>
              <div className={styles.businessInfoGrid}>
                {business.address && <div><i className="ti ti-map-pin" /><span>Location</span><strong>{business.address}</strong></div>}
                {business.phone && <div><i className="ti ti-phone" /><span>Phone</span><strong>{business.phone}</strong></div>}
                <div><i className="ti ti-category" /><span>Category</span><strong>{business.businessCategory || business.businessTypeLabel || "Ehral business"}</strong></div>
                <div><i className="ti ti-circle-check" /><span>Relationship</span><strong>{business.connected ? "You are connected" : "Not connected yet"}</strong></div>
              </div>
            </div>

            {storefront ? (
              <div className={styles.section}>
                <div className={styles.sectionHead}><div><span className={styles.eyebrow}>IN EHRAL</span><h2>{storefront.name || "Store"}</h2></div><span className={styles.connectedBadge}><i className="ti ti-building-store" /> Authenticated view</span></div>
                {storefront.coverImage && <div className={styles.businessViewCover}><img src={storefront.coverImage} alt="" /></div>}
                <p className={styles.businessViewNote}>You are viewing this business inside My Ehral. The public storefront remains separate from this authenticated experience.</p>
                {products.length ? <div className={styles.productGrid}>{products.map((product) => <article className={styles.discoveryProduct} key={product.id}><div className={styles.discoveryProductImage}>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <i className="ti ti-package" />}</div><div><strong>{product.name}</strong><small>{product.category || product.brand || "Product"}</small><b>{money(product.currency || storefront.currency, product.price)}</b></div></article>)}</div> : <div className={styles.emptyState}><i className="ti ti-package-off" /><h3>No products published yet</h3><p>This business is registered on Ehral, but its catalog is not currently available.</p></div>}
              </div>
            ) : (
              <div className={styles.section}><div className={styles.sectionIntro}><span className={styles.eyebrow}>EHRAL BUSINESS</span><h2>Business profile</h2><p>This business does not currently publish a Retail storefront. You can still keep the business relationship inside Ehral.</p></div></div>
            )}
          </section>

          <div className={styles.businessViewFooter}><button className={styles.secondaryAction} onClick={() => nav("/customer-dashboard?tab=discover")}><i className="ti ti-arrow-left" /> Back to Discover</button>{business.connected && <button className={styles.heroSecondary} onClick={() => nav("/customer-dashboard?tab=messages")}><i className="ti ti-message-circle" /> Message business</button>}</div>
        </div>
      </main>

      <nav className={styles.mobileNav} aria-label="Customer navigation">
        {[
          ["/customer-dashboard", "Dashboard", "layout-dashboard"],
          ["/customer-dashboard?tab=discover", "Discover", "compass"],
          ["/customer-dashboard?tab=businesses", "Businesses", "building-store"],
          ["/customer-dashboard?tab=orders", "Orders", "shopping-bag"],
          ["/customer-dashboard?tab=messages", "Messages", "messages"],
        ].map(([path, label, icon]) => <button key={path} onClick={() => nav(path)}><i className={`ti ti-${icon}`} /><span>{label}</span></button>)}
        <button onClick={() => nav("/my-accounts")}><i className="ti ti-switch-horizontal" /><span>Accounts</span></button>
      </nav>
    </div>
  );
}
