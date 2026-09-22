import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Logo from "../components/Logo";
import BrandSplash from "../components/BrandSplash";
import ThemeToggleMenu from "../theme/ThemeToggleMenu";
import {
  connectCustomerToBusinessId,
  createPublicOrder,
  getCustomerBusinessView,
  getCustomerOverview,
} from "../api/commerceApi";
import { getMyAccounts } from "../api/authApi";
import { createCustomerBusinessConversation } from "../api/messagingApi";
import { useAuth } from "../context/AuthContext";
import {
  cartKey,
  discountPercent,
  effectivePrice,
  getCategory,
  imagesOf,
  initials,
  isInStock,
  money,
  openStatus,
  openStatusLabel,
  readJson,
  stockOf,
  stockState,
  wishlistKey,
  writeJson,
} from "../utils/storeHelpers";
import styles from "./CustomerStore.module.css";

// The business's store, inside My Ehral. Same brand, same navigation model
// as the rest of the customer app (top bar, bottom tab bar on phones,
// drawers and sheets instead of page hops), but the catalogue itself is the
// hero. It talks to the authenticated customer endpoints - never the public
// /store/{slug} page - and places real orders through the same order API the
// public storefront uses, so the business sees them in its Orders exactly the
// same way.

const SORTS = [
  ["featured", "Featured"],
  ["sale", "Best offers"],
  ["price-low", "Price: low to high"],
  ["price-high", "Price: high to low"],
  ["name", "Name A–Z"],
];

function Stepper({ value, max, onMinus, onPlus, size = "md" }) {
  return (
    <div
      className={`${styles.stepper} ${size === "sm" ? styles.stepperSm : ""}`}
    >
      <button type="button" onClick={onMinus} aria-label="Decrease quantity">
        <i className="ti ti-minus" aria-hidden="true" />
      </button>
      <b aria-live="polite">{value}</b>
      <button
        type="button"
        onClick={onPlus}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        <i className="ti ti-plus" aria-hidden="true" />
      </button>
    </div>
  );
}

function ProductCard({
  product,
  qty,
  wished,
  onOpen,
  onAdd,
  onStep,
  onWish,
  index = 0,
}) {
  const image = imagesOf(product)[0];
  const stock = stockState(product);
  const percent = discountPercent(product);
  const inStock = isInStock(product);
  const limit = stockOf(product) !== null ? Math.floor(stockOf(product)) : 1000;
  return (
    <article className={styles.card} style={{ "--i": Math.min(index, 12) }}>
      <div className={styles.cardMedia}>
        <button
          type="button"
          className={styles.cardImage}
          onClick={() => onOpen(product)}
          aria-label={`View ${product.name}`}
        >
          {image ? (
            <img src={image} alt="" loading="lazy" />
          ) : (
            <span className={styles.noImage}>
              <i className="ti ti-package" aria-hidden="true" />
            </span>
          )}
        </button>
        <div className={styles.badges}>
          {percent > 0 && <span className={styles.badgeSale}>−{percent}%</span>}
          {stock.tone === "low" && (
            <span className={styles.badgeLow}>{stock.label}</span>
          )}
          {stock.tone === "empty" && (
            <span className={styles.badgeOut}>Sold out</span>
          )}
        </div>
        <button
          type="button"
          className={`${styles.heart} ${wished ? styles.heartOn : ""}`}
          onClick={() => onWish(product)}
          aria-label={wished ? "Remove from saved" : "Save for later"}
          aria-pressed={wished}
        >
          <i
            className={wished ? "ti ti-heart-filled" : "ti ti-heart"}
            aria-hidden="true"
          />
        </button>
      </div>
      <div className={styles.cardBody}>
        <span className={styles.cardCategory}>{getCategory(product)}</span>
        <button
          type="button"
          className={styles.cardName}
          onClick={() => onOpen(product)}
        >
          {product.name}
        </button>
        <div className={styles.cardFoot}>
          <div className={styles.price}>
            <strong>{money(product.currency, effectivePrice(product))}</strong>
            {percent > 0 && <del>{money(product.currency, product.price)}</del>}
          </div>
          {qty > 0 ? (
            <Stepper
              size="sm"
              value={qty}
              max={limit}
              onMinus={() => onStep(product, -1)}
              onPlus={() => onStep(product, 1)}
            />
          ) : (
            <button
              type="button"
              className={styles.addBtn}
              disabled={!inStock}
              onClick={() => onAdd(product)}
              aria-label={`Add ${product.name} to bag`}
            >
              <i className="ti ti-plus" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Rail({ kicker, title, products, cart, wishlist, handlers }) {
  if (!products.length) return null;
  return (
    <section className={styles.rail}>
      <div className={styles.railHead}>
        <div>
          <span className={styles.kicker}>{kicker}</span>
          <h2>{title}</h2>
        </div>
        <span className={styles.railCount}>{products.length}</span>
      </div>
      <div className={styles.railTrack}>
        {products.slice(0, 10).map((p, i) => (
          <div className={styles.railItem} key={p.id}>
            <ProductCard
              index={i}
              product={p}
              qty={Number(cart[p.id]) || 0}
              wished={wishlist.has(String(p.id))}
              {...handlers}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

const normalizeAccounts = (response) =>
  Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.data?.accounts)
        ? response.data.accounts
        : [];

export default function CustomerStore() {
  const { businessId } = useParams();
  const nav = useNavigate();
  const { switchContext } = useAuth();

  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [cart, setCart] = useState({});
  const [wishlist, setWishlist] = useState(() => new Set());
  const [hydratedSlug, setHydratedSlug] = useState("");

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("featured");
  const [offersOnly, setOffersOnly] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const [selected, setSelected] = useState(null);
  const [selQty, setSelQty] = useState(1);
  const [selImage, setSelImage] = useState(0);
  const galleryRef = useRef(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [toast, setToast] = useState("");
  const [formError, setFormError] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    deliveryAddress: "",
    customerNote: "",
    fulfillmentMethod: "",
  });

  const business = view?.business;
  const storefront = view?.storefront;
  const products = useMemo(() => view?.products || [], [view]);
  const slug = storefront?.slug || "";
  const currency = storefront?.currency || business?.currency || "NGN";

  // ── Load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await getCustomerBusinessView(businessId);
        if (dead) return;
        const data = r.data;
        setView(data);
        setError("");
        const s = data?.storefront?.slug;
        if (s) {
          setCart(readJson(cartKey(s), {}));
          setWishlist(new Set(readJson(wishlistKey(s), []).map(String)));
          setHydratedSlug(s);
        }
      } catch (e) {
        if (!dead)
          setError(
            e?.response?.data?.message || "This store could not be loaded.",
          );
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [businessId, reloadKey]);

  // Prefill checkout from the customer's own profile.
  useEffect(() => {
    let dead = false;
    getCustomerOverview()
      .then((r) => {
        if (dead) return;
        const d = r?.data || {};
        const name = [d.firstName, d.lastName].filter(Boolean).join(" ").trim();
        setForm((f) => ({
          ...f,
          customerName: f.customerName || name,
          customerPhone: f.customerPhone || d.phone || "",
          customerEmail: f.customerEmail || d.email || "",
        }));
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, []);

  useEffect(() => {
    if (hydratedSlug) writeJson(cartKey(hydratedSlug), cart);
  }, [cart, hydratedSlug]);
  useEffect(() => {
    if (hydratedSlug)
      writeJson(wishlistKey(hydratedSlug), Array.from(wishlist));
  }, [wishlist, hydratedSlug]);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // ── Derived catalogue ────────────────────────────────────────────────
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map(getCategory)))],
    [products],
  );
  const available = useMemo(() => products.filter(isInStock), [products]);
  const deals = useMemo(
    () =>
      available
        .filter((p) => Number(p.discount || 0) > 0)
        .sort((a, b) => Number(b.discount) - Number(a.discount)),
    [available],
  );
  const popular = useMemo(() => available.slice(0, 10), [available]);
  const savedProducts = useMemo(
    () =>
      Array.from(wishlist)
        .map((id) => products.find((p) => String(p.id) === id))
        .filter(Boolean),
    [wishlist, products],
  );

  const filtering = search.trim() !== "" || category !== "All" || offersOnly;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter((p) => {
      if (category !== "All" && getCategory(p) !== category) return false;
      if (offersOnly && !(Number(p.discount || 0) > 0)) return false;
      if (!q) return true;
      return [p.name, p.description, p.category, p.brand, p.sku]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    if (sort === "price-low")
      list = [...list].sort((a, b) => effectivePrice(a) - effectivePrice(b));
    else if (sort === "price-high")
      list = [...list].sort((a, b) => effectivePrice(b) - effectivePrice(a));
    else if (sort === "name")
      list = [...list].sort((a, b) =>
        String(a.name).localeCompare(String(b.name)),
      );
    else if (sort === "sale")
      list = [...list].sort(
        (a, b) => Number(b.discount || 0) - Number(a.discount || 0),
      );
    return list;
  }, [products, category, offersOnly, search, sort]);

  const groups = useMemo(
    () =>
      categories
        .slice(1)
        .map((name) => ({
          name,
          items: products.filter((p) => getCategory(p) === name),
        }))
        .filter((g) => g.items.length),
    [categories, products],
  );

  const cartItems = useMemo(
    () =>
      products
        .filter((p) => Number(cart[p.id]) > 0)
        .map((p) => {
          const stock = stockOf(p);
          const limit = stock !== null ? Math.floor(stock) : 1000;
          const quantity = Math.min(limit, Math.max(1, Number(cart[p.id])));
          return {
            ...p,
            quantity,
            limit,
            lineTotal: effectivePrice(p) * quantity,
            lineTax: Number(p.tax || 0) * quantity,
          };
        })
        .filter((p) => p.limit > 0),
    [products, cart],
  );
  const subtotal = cartItems.reduce((n, x) => n + x.lineTotal, 0);
  const taxTotal = cartItems.reduce((n, x) => n + x.lineTax, 0);
  const total = subtotal + taxTotal;
  const cartCount = cartItems.reduce((n, x) => n + x.quantity, 0);
  const status = useMemo(
    () => openStatus(storefront?.openingHoursJson, clock),
    [storefront, clock],
  );

  // ── Cart / wishlist ──────────────────────────────────────────────────
  const limitOf = (p) => (stockOf(p) !== null ? Math.floor(stockOf(p)) : 1000);

  const step = useCallback((product, delta) => {
    setCart((c) => {
      const current = Number(c[product.id]) || 0;
      const next = Math.min(limitOf(product), Math.max(0, current + delta));
      const copy = { ...c };
      if (next <= 0) delete copy[product.id];
      else copy[product.id] = next;
      return copy;
    });
  }, []);

  const add = useCallback((product, quantity = 1) => {
    if (!isInStock(product)) return;
    setCart((c) => {
      const current = Number(c[product.id]) || 0;
      const next = Math.min(limitOf(product), current + quantity);
      if (next === current) return c;
      return { ...c, [product.id]: next };
    });
    setToast(`${product.name} added to your bag`);
  }, []);

  const toggleWish = useCallback((product) => {
    setWishlist((current) => {
      const next = new Set(current);
      const id = String(product.id);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openProduct = useCallback((product) => {
    setSelected(product);
    setSelQty(1);
    setSelImage(0);
  }, []);

  const handlers = {
    onOpen: openProduct,
    onAdd: add,
    onStep: step,
    onWish: toggleWish,
  };

  // ── Ordering ─────────────────────────────────────────────────────────
  // Browsing and filling the bag need nothing; placing an order needs the
  // customer to be connected to THIS business and acting as that business's
  // customer (the order API is business-scoped).
  const ensureBusinessContext = async () => {
    const type = localStorage.getItem("contextType");
    const bid = localStorage.getItem("businessId");
    if (type === "CUSTOMER" && String(bid) === String(businessId)) return true;
    const accounts = normalizeAccounts(await getMyAccounts());
    const existing = accounts.find(
      (a) =>
        a?.type === "CUSTOMER" && String(a?.businessId) === String(businessId),
    );
    if (!existing?.membershipId) return false;
    await switchContext("CUSTOMER", existing.membershipId);
    return true;
  };

  const startCheckout = async () => {
    if (!cartItems.length) return;
    setFormError("");
    if (!business?.connected) {
      setBagOpen(false);
      setConnectOpen(true);
      return;
    }
    try {
      const ok = await ensureBusinessContext();
      if (!ok) {
        setBagOpen(false);
        setConnectOpen(true);
        return;
      }
      setBagOpen(false);
      setCheckoutOpen(true);
    } catch (e) {
      setToast(
        e?.response?.data?.message ||
          "We couldn't verify your customer account. Please try again.",
      );
    }
  };

  const connectAndContinue = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const r = await connectCustomerToBusinessId(business.businessId);
      await switchContext("CUSTOMER", r.data.membershipId);
      setReloadKey((k) => k + 1);
      setConnectOpen(false);
      setCheckoutOpen(true);
    } catch (e) {
      setToast(
        e?.response?.data?.message ||
          "We couldn't connect you to this business.",
      );
    } finally {
      setConnecting(false);
    }
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    if (!cartItems.length || submitting) return;
    const needsMethod =
      storefront?.pickupEnabled || storefront?.deliveryEnabled;
    if (needsMethod && !form.fulfillmentMethod) {
      setFormError("Choose how you'd like to receive your order.");
      return;
    }
    if (form.fulfillmentMethod === "DELIVERY" && !form.deliveryAddress.trim()) {
      setFormError("Enter your delivery address.");
      return;
    }
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setFormError(
        "Your name and phone number are needed so the store can reach you.",
      );
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const r = await createPublicOrder(slug, {
        ...form,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        items: cartItems.map((i) => ({
          productId: i.id,
          quantity: i.quantity,
        })),
      });
      setPlaced(r.data);
      setCart({});
      setCheckoutOpen(false);
    } catch (err) {
      setFormError(
        err?.response?.data?.message ||
          "We couldn't place your order. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const askAbout = async (product) => {
    if (!business?.connected) {
      setSelected(null);
      setConnectOpen(true);
      return;
    }
    try {
      const r = await createCustomerBusinessConversation(business.businessId);
      const text = product
        ? `Hello, I'm interested in ${product.name} (${money(product.currency, effectivePrice(product))}).`
        : `Hello, I found your store on Ehral and would like to make an enquiry.`;
      sessionStorage.setItem(`ehral:pending-chat:${r.data.id}`, text);
      nav(`/customer-dashboard?chat=${r.data.id}`);
    } catch (e) {
      setToast(
        e?.response?.data?.message ||
          "Messaging isn't available for this business right now.",
      );
    }
  };

  // ── Overlay hygiene: lock page scroll, Escape closes the top layer ───
  const anyOverlay = Boolean(
    selected || bagOpen || checkoutOpen || connectOpen || placed,
  );
  useEffect(() => {
    document.body.style.overflow = anyOverlay ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [anyOverlay]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (placed) setPlaced(null);
      else if (connectOpen) setConnectOpen(false);
      else if (checkoutOpen) setCheckoutOpen(false);
      else if (selected) setSelected(null);
      else if (bagOpen) setBagOpen(false);
      else if (searchOpen) setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placed, connectOpen, checkoutOpen, selected, bagOpen, searchOpen]);

  const goProfile = () => nav(`/customer/business/${businessId}`);
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  // ── States ───────────────────────────────────────────────────────────
  if (loading && !view) {
    return <BrandSplash message="Opening store…" />;
  }

  if (!business || !storefront) {
    return (
      <div className={styles.app}>
        <BrandSplash busy={false}>
          <i
            className={`ti ti-building-store ${styles.splashIcon}`}
            aria-hidden="true"
          />
          <h1>{business ? "Store not open yet" : "Store unavailable"}</h1>
          <p>
            {business
              ? `${business.businessName} hasn't opened its online store yet. You can still view their profile.`
              : error || "This store isn't available right now."}
          </p>
          <button
            className={styles.primary}
            onClick={() =>
              business ? goProfile() : nav("/customer-dashboard?tab=discover")
            }
          >
            {business ? "View business profile" : "Back to Discover"}
          </button>
        </BrandSplash>
      </div>
    );
  }

  const fulfilmentChips = [
    storefront.pickupEnabled && "Pickup",
    storefront.deliveryEnabled && "Delivery",
  ].filter(Boolean);
  const selGallery = selected ? imagesOf(selected) : [];
  const selStock = selected ? stockState(selected) : null;
  const selLimit = selected ? limitOf(selected) : 1;
  const selPercent = selected ? discountPercent(selected) : 0;
  const selMeter =
    selected && stockOf(selected) !== null
      ? Math.min(
          100,
          Math.max(
            6,
            (stockOf(selected) /
              Math.max(
                stockOf(selected),
                Number(selected.lowStockThreshold || 5) * 4,
              )) *
              100,
          ),
        )
      : 100;
  const stockClass = (tone) =>
    tone === "good"
      ? styles.toneGood
      : tone === "low"
        ? styles.toneLow
        : styles.toneEmpty;

  return (
    <div className={styles.app} data-search={searchOpen ? "open" : "closed"}>
      {/* ── App bar ───────────────────────────────────────────── */}
      <header className={styles.bar}>
        <button
          className={styles.barBack}
          onClick={goProfile}
          aria-label={`Back to ${business.businessName}`}
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </button>
        <button
          className={styles.barBrand}
          onClick={scrollTop}
          aria-label="Scroll to top"
        >
          <span className={styles.barLogo}>
            {business.businessLogo ? (
              <img src={business.businessLogo} alt="" />
            ) : (
              initials(business.businessName)
            )}
          </span>
          <span className={styles.barTitle}>
            <strong>{storefront.name || business.businessName}</strong>
            <small>Store · My Ehral</small>
          </span>
        </button>

        <label className={styles.barSearch}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowSaved(false);
            }}
            placeholder="Search this store"
            aria-label="Search products"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          )}
        </label>

        <div className={styles.barActions}>
          <button
            className={styles.iconBtn}
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search"
            data-mobile-only="true"
          >
            <i className="ti ti-search" aria-hidden="true" />
          </button>
          <button
            className={`${styles.iconBtn} ${showSaved ? styles.iconBtnOn : ""}`}
            onClick={() => setShowSaved((v) => !v)}
            aria-label="Saved items"
            aria-pressed={showSaved}
            data-desktop-only="true"
          >
            <i
              className={wishlist.size ? "ti ti-heart-filled" : "ti ti-heart"}
              aria-hidden="true"
            />
            {wishlist.size > 0 && <b>{wishlist.size}</b>}
          </button>
          <button
            className={styles.bagBtn}
            onClick={() => setBagOpen(true)}
            aria-label={`Open bag, ${cartCount} items`}
          >
            <i className="ti ti-shopping-bag" aria-hidden="true" />
            <span>Bag</span>
            {cartCount > 0 && <b>{cartCount}</b>}
          </button>
          <ThemeToggleMenu />
        </div>
      </header>

      {searchOpen && (
        <div className={styles.mobileSearch}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            autoFocus
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowSaved(false);
            }}
            placeholder="Search this store"
            aria-label="Search products"
          />
          <button
            onClick={() => setSearchOpen(false)}
            aria-label="Close search"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      )}

      <main className={styles.main}>
        {/* ── Masthead ─────────────────────────────────────────── */}
        <section
          className={styles.masthead}
          style={
            storefront.coverImage
              ? { "--cover": `url(${storefront.coverImage})` }
              : undefined
          }
          data-cover={storefront.coverImage ? "true" : "false"}
        >
          <div className={styles.mastheadInner}>
            <div className={styles.mastheadText}>
              <span className={styles.mastKicker}>
                {[business.businessTypeLabel, business.businessCategory]
                  .filter(Boolean)
                  .join(" · ") || "Store"}
              </span>
              <h1>{storefront.name || business.businessName}</h1>
              {storefront.description && <p>{storefront.description}</p>}
              <ul className={styles.mastFacts}>
                {status.known && (
                  <li className={status.isOpen ? styles.factOpen : ""}>
                    <span className={styles.liveDot} aria-hidden="true" />{" "}
                    {openStatusLabel(status)}
                  </li>
                )}
                {fulfilmentChips.length > 0 && (
                  <li>
                    <i className="ti ti-truck-delivery" aria-hidden="true" />{" "}
                    {fulfilmentChips.join(" · ")}
                  </li>
                )}
                <li>
                  <i className="ti ti-package" aria-hidden="true" />{" "}
                  {products.length} product{products.length === 1 ? "" : "s"}
                </li>
              </ul>
              <div className={styles.mastActions}>
                <button
                  className={styles.mastPrimary}
                  onClick={() =>
                    document
                      .getElementById("shop")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Start shopping{" "}
                  <i className="ti ti-arrow-down" aria-hidden="true" />
                </button>
                <button
                  className={styles.mastGhost}
                  onClick={() => askAbout(null)}
                >
                  <i className="ti ti-message-circle" aria-hidden="true" />{" "}
                  Message store
                </button>
                <button className={styles.mastGhost} onClick={goProfile}>
                  <i className="ti ti-info-circle" aria-hidden="true" /> About
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Sticky filters ───────────────────────────────────── */}
        <div className={styles.filters} id="shop">
          <div className={styles.chips} role="tablist" aria-label="Categories">
            {categories.map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={category === c}
                className={category === c ? styles.chipOn : ""}
                onClick={() => {
                  setCategory(c);
                  setShowSaved(false);
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <div className={styles.tools}>
            {deals.length > 0 && (
              <button
                className={`${styles.toggle} ${offersOnly ? styles.toggleOn : ""}`}
                onClick={() => setOffersOnly((v) => !v)}
                aria-pressed={offersOnly}
              >
                <i className="ti ti-discount-2" aria-hidden="true" /> Offers
              </button>
            )}
            <label className={styles.sort}>
              <i className="ti ti-arrows-sort" aria-hidden="true" />
              <span>Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort products"
              >
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* ── Catalogue ────────────────────────────────────────── */}
        <div className={styles.content}>
          {showSaved ? (
            <section>
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.kicker}>SAVED FOR LATER</span>
                  <h2>Your saved items</h2>
                </div>
                <button
                  className={styles.textBtn}
                  onClick={() => setShowSaved(false)}
                >
                  Back to store
                </button>
              </div>
              {savedProducts.length ? (
                <div className={styles.grid}>
                  {savedProducts.map((p, i) => (
                    <ProductCard
                      key={p.id}
                      index={i}
                      product={p}
                      qty={Number(cart[p.id]) || 0}
                      wished
                      {...handlers}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>
                  <i className="ti ti-heart" aria-hidden="true" />
                  <h3>Nothing saved yet</h3>
                  <p>Tap the heart on any product to keep it here for later.</p>
                  <button
                    className={styles.primary}
                    onClick={() => setShowSaved(false)}
                  >
                    Browse the store
                  </button>
                </div>
              )}
            </section>
          ) : filtering ? (
            <section>
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.kicker}>
                    {search.trim()
                      ? "SEARCH RESULTS"
                      : category !== "All"
                        ? "COLLECTION"
                        : "OFFERS"}
                  </span>
                  <h2>
                    {search.trim()
                      ? `“${search.trim()}”`
                      : category !== "All"
                        ? category
                        : "Special offers"}
                  </h2>
                </div>
                <span className={styles.resultCount}>
                  {filtered.length} item{filtered.length === 1 ? "" : "s"}
                </span>
              </div>
              {filtered.length ? (
                <div className={styles.grid}>
                  {filtered.map((p, i) => (
                    <ProductCard
                      key={p.id}
                      index={i}
                      product={p}
                      qty={Number(cart[p.id]) || 0}
                      wished={wishlist.has(String(p.id))}
                      {...handlers}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>
                  <i className="ti ti-search-off" aria-hidden="true" />
                  <h3>No products found</h3>
                  <p>Try a different search or category.</p>
                  <button
                    className={styles.primary}
                    onClick={() => {
                      setSearch("");
                      setCategory("All");
                      setOffersOnly(false);
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </section>
          ) : products.length === 0 ? (
            <div className={styles.empty}>
              <i className="ti ti-package-off" aria-hidden="true" />
              <h3>No products yet</h3>
              <p>
                {business.businessName} hasn't published any products. Check
                back soon.
              </p>
              <button className={styles.primary} onClick={() => askAbout(null)}>
                Message the store
              </button>
            </div>
          ) : (
            <>
              <Rail
                kicker="SPECIAL OFFERS"
                title="Deals you'll like"
                products={deals}
                cart={cart}
                wishlist={wishlist}
                handlers={handlers}
              />
              <Rail
                kicker="POPULAR RIGHT NOW"
                title="In stock and ready"
                products={popular}
                cart={cart}
                wishlist={wishlist}
                handlers={handlers}
              />
              {groups.map((g) => (
                <section className={styles.group} key={g.name}>
                  <div className={styles.sectionHead}>
                    <div>
                      <span className={styles.kicker}>COLLECTION</span>
                      <h2>{g.name}</h2>
                    </div>
                    <button
                      className={styles.textBtn}
                      onClick={() => setCategory(g.name)}
                    >
                      See all {g.items.length}{" "}
                      <i className="ti ti-arrow-right" aria-hidden="true" />
                    </button>
                  </div>
                  <div className={styles.grid}>
                    {g.items.slice(0, 8).map((p, i) => (
                      <ProductCard
                        key={p.id}
                        index={i}
                        product={p}
                        qty={Number(cart[p.id]) || 0}
                        wished={wishlist.has(String(p.id))}
                        {...handlers}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>

        <footer className={styles.footer}>
          <Logo size={56} variant="horizontal" tone="brand" title="Ehral" />
          <p>
            <i className="ti ti-shield-check" aria-hidden="true" /> Secure
            ordering through your Ehral account. Your orders, receipts and
            messages with {business.businessName} stay in one place.
          </p>
        </footer>
      </main>

      {/* ── Bag bar + bottom tabs (phones) ───────────────────────── */}
      {cartCount > 0 && !bagOpen && (
        <button className={styles.bagBar} onClick={() => setBagOpen(true)}>
          <span className={styles.bagBarCount}>{cartCount}</span>
          <span>View bag</span>
          <strong>{money(currency, total)}</strong>
        </button>
      )}
      <nav className={styles.tabs} aria-label="Store navigation">
        <button
          className={!showSaved && !searchOpen ? styles.tabOn : ""}
          onClick={() => {
            setShowSaved(false);
            setSearchOpen(false);
            scrollTop();
          }}
        >
          <i className="ti ti-building-store" aria-hidden="true" />
          <span>Store</span>
        </button>
        <button
          className={searchOpen ? styles.tabOn : ""}
          onClick={() => setSearchOpen((v) => !v)}
        >
          <i className="ti ti-search" aria-hidden="true" />
          <span>Search</span>
        </button>
        <button
          className={showSaved ? styles.tabOn : ""}
          onClick={() => setShowSaved((v) => !v)}
        >
          <i
            className={wishlist.size ? "ti ti-heart-filled" : "ti ti-heart"}
            aria-hidden="true"
          />
          <span>Saved</span>
          {wishlist.size > 0 && <b>{wishlist.size}</b>}
        </button>
        <button onClick={() => setBagOpen(true)}>
          <i className="ti ti-shopping-bag" aria-hidden="true" />
          <span>Bag</span>
          {cartCount > 0 && <b>{cartCount}</b>}
        </button>
      </nav>

      {toast && (
        <div className={styles.toast} role="status">
          <i className="ti ti-circle-check-filled" aria-hidden="true" /> {toast}
        </div>
      )}

      {/* ── Bag drawer ───────────────────────────────────────────── */}
      {bagOpen && (
        <div
          className={styles.overlay}
          onMouseDown={(e) => e.target === e.currentTarget && setBagOpen(false)}
        >
          <aside
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping bag"
          >
            <div className={styles.sheetGrab} aria-hidden="true" />
            <div className={styles.drawerHead}>
              <div>
                <span className={styles.kicker}>YOUR ORDER</span>
                <h2>
                  Shopping bag <small>{cartCount}</small>
                </h2>
              </div>
              <button
                className={styles.close}
                onClick={() => setBagOpen(false)}
                aria-label="Close bag"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
            {cartItems.length ? (
              <>
                <ul className={styles.bagList}>
                  {cartItems.map((i) => (
                    <li key={i.id}>
                      <span className={styles.bagThumb}>
                        {imagesOf(i)[0] ? (
                          <img src={imagesOf(i)[0]} alt="" />
                        ) : (
                          <i className="ti ti-package" aria-hidden="true" />
                        )}
                      </span>
                      <div className={styles.bagInfo}>
                        <strong>{i.name}</strong>
                        <span>{money(i.currency, effectivePrice(i))}</span>
                        <Stepper
                          size="sm"
                          value={i.quantity}
                          max={i.limit}
                          onMinus={() => step(i, -1)}
                          onPlus={() => step(i, 1)}
                        />
                      </div>
                      <b className={styles.bagLine}>
                        {money(i.currency, i.lineTotal)}
                      </b>
                    </li>
                  ))}
                </ul>
                <div className={styles.bagFoot}>
                  <div>
                    <span>Subtotal</span>
                    <strong>{money(currency, subtotal)}</strong>
                  </div>
                  {taxTotal > 0 && (
                    <div>
                      <span>Tax</span>
                      <strong>{money(currency, taxTotal)}</strong>
                    </div>
                  )}
                  <div className={styles.bagTotal}>
                    <span>Total</span>
                    <strong>{money(currency, total)}</strong>
                  </div>
                  <button className={styles.primary} onClick={startCheckout}>
                    Checkout{" "}
                    <i className="ti ti-arrow-right" aria-hidden="true" />
                  </button>
                  <button
                    className={styles.textBtn}
                    onClick={() => setBagOpen(false)}
                  >
                    Continue shopping
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.empty}>
                <i className="ti ti-shopping-bag" aria-hidden="true" />
                <h3>Your bag is empty</h3>
                <p>Add something you like and it will wait for you here.</p>
                <button
                  className={styles.primary}
                  onClick={() => setBagOpen(false)}
                >
                  Browse the store
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ── Product sheet ────────────────────────────────────────── */}
      {selected && (
        <div
          className={styles.overlay}
          onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <section
            className={styles.product}
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
          >
            <div className={styles.sheetGrab} aria-hidden="true" />
            <button
              className={styles.productClose}
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
            <div className={styles.gallery}>
              <div
                className={styles.galleryMain}
                ref={galleryRef}
                onScroll={(e) => {
                  if (!selGallery.length) return;
                  const width = e.currentTarget.clientWidth || 1;
                  const next = Math.round(e.currentTarget.scrollLeft / width);
                  setSelImage(
                    Math.max(0, Math.min(next, selGallery.length - 1)),
                  );
                }}
                aria-label={`${selected.name} images`}
              >
                {selGallery.length ? (
                  <div className={styles.galleryTrack}>
                    {selGallery.map((src, i) => (
                      <div className={styles.gallerySlide} key={src + i}>
                        <img
                          src={src}
                          alt={`${selected.name} image ${i + 1}`}
                          draggable="false"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className={styles.noImage}>
                    <i className="ti ti-package" aria-hidden="true" />
                  </span>
                )}
                {selPercent > 0 && (
                  <span className={styles.badgeSale}>−{selPercent}%</span>
                )}
              </div>
              {selGallery.length > 1 && (
                <div className={styles.thumbs}>
                  {selGallery.map((src, i) => (
                    <button
                      key={src + i}
                      className={i === selImage ? styles.thumbOn : ""}
                      onClick={() => {
                        setSelImage(i);
                        galleryRef.current?.scrollTo({
                          left: i * (galleryRef.current?.clientWidth || 0),
                          behavior: "smooth",
                        });
                      }}
                      aria-label={`Image ${i + 1}`}
                    >
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.productInfo}>
              <span className={styles.kicker}>{getCategory(selected)}</span>
              <h2>{selected.name}</h2>
              {selected.brand && (
                <span className={styles.brandLine}>by {selected.brand}</span>
              )}
              <div className={styles.productPrice}>
                <strong>
                  {money(selected.currency, effectivePrice(selected))}
                </strong>
                {selPercent > 0 && (
                  <del>{money(selected.currency, selected.price)}</del>
                )}
              </div>
              <div
                className={`${styles.stockLine} ${stockClass(selStock.tone)}`}
              >
                <span className={styles.stockMeter} aria-hidden="true">
                  <i
                    style={{
                      width: `${selStock.tone === "empty" ? 4 : selMeter}%`,
                    }}
                  />
                </span>
                <span>{selStock.label}</span>
              </div>
              {selected.description && (
                <p className={styles.productDesc}>{selected.description}</p>
              )}
              <div className={styles.productActions}>
                <Stepper
                  value={selQty}
                  max={selLimit}
                  onMinus={() => setSelQty((q) => Math.max(1, q - 1))}
                  onPlus={() => setSelQty((q) => Math.min(selLimit, q + 1))}
                />
                <button
                  className={styles.primary}
                  disabled={!isInStock(selected)}
                  onClick={() => {
                    add(selected, selQty);
                    setSelected(null);
                  }}
                >
                  {isInStock(selected)
                    ? `Add to bag · ${money(selected.currency, effectivePrice(selected) * selQty)}`
                    : "Sold out"}
                </button>
              </div>
              <div className={styles.productLinks}>
                <button onClick={() => toggleWish(selected)}>
                  <i
                    className={
                      wishlist.has(String(selected.id))
                        ? "ti ti-heart-filled"
                        : "ti ti-heart"
                    }
                    aria-hidden="true"
                  />
                  {wishlist.has(String(selected.id))
                    ? "Saved"
                    : "Save for later"}
                </button>
                <button onClick={() => askAbout(selected)}>
                  <i className="ti ti-message-circle" aria-hidden="true" /> Ask
                  about this
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── Connect sheet ────────────────────────────────────────── */}
      {connectOpen && (
        <div
          className={styles.overlay}
          onMouseDown={(e) =>
            e.target === e.currentTarget && setConnectOpen(false)
          }
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Connect to continue"
          >
            <div className={styles.sheetGrab} aria-hidden="true" />
            <div className={styles.dialogLogo}>
              {business.businessLogo ? (
                <img src={business.businessLogo} alt="" />
              ) : (
                initials(business.businessName)
              )}
            </div>
            <span className={styles.kicker}>ONE QUICK STEP</span>
            <h2>Connect with {business.businessName}</h2>
            <p>
              Connecting links this business to your Ehral account so your
              order, receipt and messages all live in one place. It takes a
              second and your bag stays exactly as it is.
            </p>
            <button
              className={styles.primary}
              onClick={connectAndContinue}
              disabled={connecting}
            >
              {connecting ? "Connecting…" : "Connect and continue"}{" "}
              <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
            <button
              className={styles.textBtn}
              onClick={() => setConnectOpen(false)}
            >
              Not now
            </button>
          </section>
        </div>
      )}

      {/* ── Checkout ─────────────────────────────────────────────── */}
      {checkoutOpen && (
        <div
          className={styles.overlay}
          onMouseDown={(e) =>
            e.target === e.currentTarget && setCheckoutOpen(false)
          }
        >
          <form
            className={styles.checkout}
            onSubmit={placeOrder}
            role="dialog"
            aria-modal="true"
            aria-label="Checkout"
          >
            <div className={styles.sheetGrab} aria-hidden="true" />
            <div className={styles.drawerHead}>
              <div>
                <span className={styles.kicker}>CHECKOUT</span>
                <h2>Complete your order</h2>
              </div>
              <button
                type="button"
                className={styles.close}
                onClick={() => setCheckoutOpen(false)}
                aria-label="Close checkout"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            <div className={styles.summary}>
              {cartItems.map((i) => (
                <div key={i.id}>
                  <span>
                    {i.name} <em>× {i.quantity}</em>
                  </span>
                  <b>{money(i.currency, i.lineTotal)}</b>
                </div>
              ))}
              <div className={styles.summaryTotal}>
                <span>Total</span>
                <strong>{money(currency, total)}</strong>
              </div>
            </div>

            <fieldset className={styles.fields}>
              <legend>Your details</legend>
              <label>
                Full name
                <input
                  value={form.customerName}
                  onChange={(e) =>
                    setForm({ ...form, customerName: e.target.value })
                  }
                  autoComplete="name"
                  required
                />
              </label>
              <div className={styles.twoCol}>
                <label>
                  Phone
                  <input
                    value={form.customerPhone}
                    onChange={(e) =>
                      setForm({ ...form, customerPhone: e.target.value })
                    }
                    autoComplete="tel"
                    inputMode="tel"
                    required
                  />
                </label>
                <label>
                  Email <span>(optional)</span>
                  <input
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) =>
                      setForm({ ...form, customerEmail: e.target.value })
                    }
                    autoComplete="email"
                  />
                </label>
              </div>
            </fieldset>

            {(storefront.pickupEnabled || storefront.deliveryEnabled) && (
              <fieldset className={styles.fields}>
                <legend>How would you like it?</legend>
                <div className={styles.methods}>
                  {storefront.pickupEnabled && (
                    <button
                      type="button"
                      className={
                        form.fulfillmentMethod === "PICKUP"
                          ? styles.methodOn
                          : ""
                      }
                      onClick={() =>
                        setForm({ ...form, fulfillmentMethod: "PICKUP" })
                      }
                      aria-pressed={form.fulfillmentMethod === "PICKUP"}
                    >
                      <i className="ti ti-building-store" aria-hidden="true" />
                      <strong>Pickup</strong>
                      <small>Collect from the store</small>
                    </button>
                  )}
                  {storefront.deliveryEnabled && (
                    <button
                      type="button"
                      className={
                        form.fulfillmentMethod === "DELIVERY"
                          ? styles.methodOn
                          : ""
                      }
                      onClick={() =>
                        setForm({ ...form, fulfillmentMethod: "DELIVERY" })
                      }
                      aria-pressed={form.fulfillmentMethod === "DELIVERY"}
                    >
                      <i className="ti ti-truck-delivery" aria-hidden="true" />
                      <strong>Delivery</strong>
                      <small>To your address</small>
                    </button>
                  )}
                </div>
                {form.fulfillmentMethod === "DELIVERY" && (
                  <label>
                    Delivery address
                    <textarea
                      rows={2}
                      value={form.deliveryAddress}
                      onChange={(e) =>
                        setForm({ ...form, deliveryAddress: e.target.value })
                      }
                    />
                  </label>
                )}
              </fieldset>
            )}

            <label className={styles.noteField}>
              Note to the store <span>(optional)</span>
              <textarea
                rows={2}
                value={form.customerNote}
                onChange={(e) =>
                  setForm({ ...form, customerNote: e.target.value })
                }
              />
            </label>

            {formError && (
              <div className={styles.formError} role="alert">
                <i className="ti ti-alert-circle" aria-hidden="true" />{" "}
                {formError}
              </div>
            )}

            <button
              className={styles.primary}
              disabled={submitting || !cartItems.length}
            >
              {submitting
                ? "Placing order…"
                : `Place order · ${money(currency, total)}`}
              <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
            <p className={styles.fine}>
              <i className="ti ti-lock" aria-hidden="true" /> You'll pay{" "}
              {business.businessName} directly - the store confirms payment and
              your receipt appears in My Ehral.
            </p>
          </form>
        </div>
      )}

      {/* ── Order placed ─────────────────────────────────────────── */}
      {placed && (
        <div className={styles.overlay}>
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Order confirmed"
          >
            <div className={styles.sheetGrab} aria-hidden="true" />
            <div className={styles.successMark}>
              <i className="ti ti-check" aria-hidden="true" />
            </div>
            <span className={styles.kicker}>ORDER CONFIRMED</span>
            <h2>Thank you!</h2>
            <p>
              Your order <b>#{placed.orderNumber}</b> with{" "}
              {business.businessName} is in. Your receipt appears in My Ehral
              once it's fully paid.
            </p>
            <div className={styles.successTotal}>
              <span>Total</span>
              <strong>
                {money(placed.currency || currency, placed.total)}
              </strong>
            </div>
            <button
              className={styles.primary}
              onClick={() => nav("/customer-dashboard?tab=orders")}
            >
              View my orders{" "}
              <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
            <button className={styles.textBtn} onClick={() => askAbout(null)}>
              Message the store
            </button>
            <button className={styles.textBtn} onClick={() => setPlaced(null)}>
              Continue shopping
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
