import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Logo from "../components/Logo";
import BrandSplash from "../components/BrandSplash";
import ThemeToggleMenu from "../theme/ThemeToggleMenu";
import {
  connectCustomerToBusinessId,
  getCustomerBusinessView,
} from "../api/commerceApi";
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
  readJson,
  stockOf,
  stockState,
  wishlistKey,
  writeJson,
} from "../utils/storeHelpers";
import { ProductCard, Stepper } from "./CustomerStore";
import storeStyles from "./CustomerStore.module.css";
import styles from "./CustomerStoreProduct.module.css";

// The dedicated, full-page view of a single product - reached from the
// "View full page" glow button in the product sheet on CustomerStore. Same
// data, cart and wishlist as the store (same localStorage keys, so the bag
// stays in sync whichever page it was built on), just given the room to
// breathe: a proper gallery with a lightbox, the full description with
// nothing truncated, a specs list, and easy hops to other products and
// categories in the same store without a trip back through the catalogue.

const stockClass = (tone) =>
  tone === "good"
    ? storeStyles.toneGood
    : tone === "low"
      ? storeStyles.toneLow
      : storeStyles.toneEmpty;

export default function CustomerStoreProduct() {
  const { businessId, productId } = useParams();
  const nav = useNavigate();
  const { switchContext } = useAuth();

  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cart, setCart] = useState({});
  const [wishlist, setWishlist] = useState(() => new Set());
  const [hydratedSlug, setHydratedSlug] = useState("");

  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const galleryRef = useRef(null);

  const [connectOpen, setConnectOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [toast, setToast] = useState("");

  // ── Load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    setLoading(true);
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
            e?.response?.data?.message || "This product could not be loaded.",
          );
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [businessId]);

  useEffect(() => {
    if (hydratedSlug) writeJson(cartKey(hydratedSlug), cart);
  }, [cart, hydratedSlug]);
  useEffect(() => {
    if (hydratedSlug)
      writeJson(wishlistKey(hydratedSlug), Array.from(wishlist));
  }, [wishlist, hydratedSlug]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Landing on a different product (via a related-item tap) starts fresh.
  useEffect(() => {
    setQty(1);
    setActiveImage(0);
    setLightbox(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [productId]);

  const business = view?.business;
  const storefront = view?.storefront;
  const products = useMemo(() => view?.products || [], [view]);
  const product = useMemo(
    () => products.find((p) => String(p.id) === String(productId)),
    [products, productId],
  );
  // Hoisted above the early returns below (rather than sitting alongside the
  // other derived product fields) because the keyboard-nav effect closes
  // over it and effects can't come after a conditional return.
  const gallery = useMemo(() => (product ? imagesOf(product) : []), [product]);

  const limitOf = useCallback(
    (p) => (stockOf(p) !== null ? Math.floor(stockOf(p)) : 1000),
    [],
  );

  // ── Cart / wishlist (shared behaviour with the store & related cards) ─
  const add = useCallback(
    (p, quantity = 1) => {
      if (!isInStock(p)) return;
      setCart((c) => {
        const current = Number(c[p.id]) || 0;
        const next = Math.min(limitOf(p), current + quantity);
        if (next === current) return c;
        return { ...c, [p.id]: next };
      });
      setToast(`${p.name} added to your bag`);
    },
    [limitOf],
  );

  const step = useCallback(
    (p, delta) => {
      setCart((c) => {
        const current = Number(c[p.id]) || 0;
        const next = Math.min(limitOf(p), Math.max(0, current + delta));
        const copy = { ...c };
        if (next <= 0) delete copy[p.id];
        else copy[p.id] = next;
        return copy;
      });
    },
    [limitOf],
  );

  const toggleWish = useCallback((p) => {
    setWishlist((current) => {
      const next = new Set(current);
      const id = String(p.id);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openProduct = useCallback(
    (p) => nav(`/customer/business/${businessId}/store/product/${p.id}`),
    [businessId, nav],
  );

  const handlers = {
    onOpen: openProduct,
    onAdd: add,
    onStep: step,
    onWish: toggleWish,
  };

  const cartCount = useMemo(
    () => Object.values(cart).reduce((n, x) => n + (Number(x) || 0), 0),
    [cart],
  );

  // ── Messaging / connect (same flow as the store's "Ask about this") ──
  const messageAbout = async (p) => {
    const r = await createCustomerBusinessConversation(business.businessId);
    const text = `Hello, I'm interested in ${p.name} (${money(p.currency, effectivePrice(p))}).`;
    sessionStorage.setItem(`ehral:pending-chat:${r.data.id}`, text);
    nav(`/customer-dashboard?chat=${r.data.id}`);
  };

  const askAbout = async () => {
    if (!product) return;
    if (!business?.connected) {
      setConnectOpen(true);
      return;
    }
    try {
      await messageAbout(product);
    } catch (e) {
      setToast(
        e?.response?.data?.message ||
          "Messaging isn't available for this business right now.",
      );
    }
  };

  const connectAndContinue = async () => {
    if (connecting || !product) return;
    setConnecting(true);
    try {
      const r = await connectCustomerToBusinessId(business.businessId);
      await switchContext("CUSTOMER", r.data.membershipId);
      setView((v) =>
        v ? { ...v, business: { ...v.business, connected: true } } : v,
      );
      setConnectOpen(false);
      await messageAbout(product);
    } catch (e) {
      setToast(
        e?.response?.data?.message ||
          "We couldn't connect you to this business.",
      );
    } finally {
      setConnecting(false);
    }
  };

  const share = async () => {
    if (!product) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, url });
      } catch {
        /* the share sheet was dismissed - nothing to do */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied to clipboard");
    } catch {
      setToast(url);
    }
  };

  // ── Escape closes the lightbox / connect sheet ───────────────────────
  useEffect(() => {
    document.body.style.overflow = lightbox || connectOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightbox, connectOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (lightbox) setLightbox(false);
        else if (connectOpen) setConnectOpen(false);
      }
      if (lightbox && gallery.length > 1) {
        if (e.key === "ArrowRight")
          setActiveImage((i) => (i + 1) % gallery.length);
        if (e.key === "ArrowLeft")
          setActiveImage((i) => (i - 1 + gallery.length) % gallery.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, connectOpen, product]);

  const goStore = () => nav(`/customer/business/${businessId}/store`);
  const goStoreCategory = (c) =>
    nav(
      `/customer/business/${businessId}/store?category=${encodeURIComponent(c)}`,
    );

  // ── States ───────────────────────────────────────────────────────────
  if (loading && !view) {
    return <BrandSplash message="Opening product…" />;
  }

  if (!business || !storefront) {
    return (
      <div className={storeStyles.app}>
        <BrandSplash busy={false}>
          <i
            className={`ti ti-building-store ${storeStyles.splashIcon}`}
            aria-hidden="true"
          />
          <h1>Store unavailable</h1>
          <p>{error || "This store isn't available right now."}</p>
          <button
            className={storeStyles.primary}
            onClick={() => nav("/customer-dashboard?tab=discover")}
          >
            Back to Discover
          </button>
        </BrandSplash>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={storeStyles.app}>
        <BrandSplash busy={false}>
          <i
            className={`ti ti-package-off ${storeStyles.splashIcon}`}
            aria-hidden="true"
          />
          <h1>Product not found</h1>
          <p>
            This item may have been removed, sold out permanently, or the link
            is off. It's still worth a look around {business.businessName}'s
            store.
          </p>
          <button className={storeStyles.primary} onClick={goStore}>
            Back to the store
          </button>
        </BrandSplash>
      </div>
    );
  }

  const stock = stockState(product);
  const limit = limitOf(product);
  const percent = discountPercent(product);
  const meter =
    stockOf(product) !== null
      ? Math.min(
          100,
          Math.max(
            6,
            (stockOf(product) /
              Math.max(
                stockOf(product),
                Number(product.lowStockThreshold || 5) * 4,
              )) *
              100,
          ),
        )
      : 100;
  const category = getCategory(product);
  const categories = Array.from(new Set(products.map(getCategory)));
  const fulfilmentChips = [
    storefront.pickupEnabled && "Pickup",
    storefront.deliveryEnabled && "Delivery",
  ].filter(Boolean);
  const wished = wishlist.has(String(product.id));

  const related = products
    .filter(
      (p) => p.id !== product.id && getCategory(p) === category && isInStock(p),
    )
    .slice(0, 10);
  const more = (() => {
    const excluded = new Set([product.id, ...related.map((p) => p.id)]);
    return products.filter((p) => !excluded.has(p.id)).slice(0, 10);
  })();

  return (
    <div className={`${storeStyles.app} ${styles.page}`}>
      {/* ── App bar ─────────────────────────────────────────────── */}
      <header className={storeStyles.bar}>
        <button
          className={storeStyles.barBack}
          onClick={goStore}
          aria-label={`Back to ${business.businessName}'s store`}
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </button>
        <button
          className={storeStyles.barBrand}
          onClick={goStore}
          aria-label="Back to the store"
        >
          <span className={storeStyles.barLogo}>
            {business.businessLogo ? (
              <img src={business.businessLogo} alt="" />
            ) : (
              initials(business.businessName)
            )}
          </span>
          <span className={storeStyles.barTitle}>
            <strong>{storefront.name || business.businessName}</strong>
            <small>Product details</small>
          </span>
        </button>
        <div className={storeStyles.barActions}>
          <button
            className={storeStyles.iconBtn}
            onClick={share}
            aria-label="Share this product"
          >
            <i className="ti ti-share-3" aria-hidden="true" />
          </button>
          <button
            className={`${storeStyles.iconBtn} ${wished ? storeStyles.iconBtnOn : ""}`}
            onClick={() => toggleWish(product)}
            aria-label={wished ? "Remove from saved" : "Save for later"}
            aria-pressed={wished}
          >
            <i
              className={wished ? "ti ti-heart-filled" : "ti ti-heart"}
              aria-hidden="true"
            />
          </button>
          <button
            className={storeStyles.bagBtn}
            onClick={() => nav(`/customer/business/${businessId}/store?bag=1`)}
            aria-label={`Open bag, ${cartCount} items`}
          >
            <i className="ti ti-shopping-bag" aria-hidden="true" />
            <span>Bag</span>
            {cartCount > 0 && <b>{cartCount}</b>}
          </button>
          <ThemeToggleMenu />
        </div>
      </header>

      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <button onClick={goStore}>Store</button>
        <i className="ti ti-chevron-right" aria-hidden="true" />
        <button onClick={() => goStoreCategory(category)}>{category}</button>
        <i className="ti ti-chevron-right" aria-hidden="true" />
        <span aria-current="page">{product.name}</span>
      </nav>

      <main className={styles.main}>
        {/* ── Hero: gallery + info ─────────────────────────────── */}
        <section className={styles.hero}>
          <div className={styles.galleryCol}>
            <div
              className={styles.galleryMain}
              ref={galleryRef}
              onScroll={(e) => {
                if (!gallery.length) return;
                const width = e.currentTarget.clientWidth || 1;
                const next = Math.round(e.currentTarget.scrollLeft / width);
                setActiveImage(Math.max(0, Math.min(next, gallery.length - 1)));
              }}
              aria-label={`${product.name} images`}
            >
              {gallery.length ? (
                <div className={styles.galleryTrack}>
                  {gallery.map((src, i) => (
                    <button
                      type="button"
                      className={styles.gallerySlide}
                      key={src + i}
                      onClick={() => setLightbox(true)}
                      aria-label="View full-size image"
                    >
                      <img
                        src={src}
                        alt={`${product.name} image ${i + 1}`}
                        draggable="false"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <span className={styles.noImage}>
                  <i className="ti ti-package" aria-hidden="true" />
                </span>
              )}
              {percent > 0 && (
                <span className={styles.badgeSale}>−{percent}%</span>
              )}
              {gallery.length > 0 && (
                <button
                  type="button"
                  className={styles.zoomBtn}
                  onClick={() => setLightbox(true)}
                  aria-label="Open full-size gallery"
                >
                  <i className="ti ti-zoom-in" aria-hidden="true" />
                </button>
              )}
              {gallery.length > 1 && (
                <span className={styles.galleryCount}>
                  {activeImage + 1} / {gallery.length}
                </span>
              )}
            </div>
            {gallery.length > 1 && (
              <div className={styles.thumbs}>
                {gallery.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    className={i === activeImage ? styles.thumbOn : ""}
                    onClick={() => {
                      setActiveImage(i);
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

          <div className={styles.info}>
            <span className={storeStyles.kicker}>{category}</span>
            <h1>{product.name}</h1>
            {product.brand && (
              <span className={styles.brandLine}>by {product.brand}</span>
            )}

            <div className={styles.priceRow}>
              <strong>
                {money(product.currency, effectivePrice(product))}
              </strong>
              {percent > 0 && (
                <del>{money(product.currency, product.price)}</del>
              )}
              {percent > 0 && (
                <span className={styles.saveTag}>Save {percent}%</span>
              )}
            </div>

            <div
              className={`${storeStyles.stockLine} ${stockClass(stock.tone)}`}
            >
              <span className={storeStyles.stockMeter} aria-hidden="true">
                <i
                  style={{ width: `${stock.tone === "empty" ? 4 : meter}%` }}
                />
              </span>
              <span>{stock.label}</span>
            </div>

            {product.description && (
              <p className={styles.desc}>{product.description}</p>
            )}

            <div className={styles.actions}>
              <Stepper
                value={qty}
                max={limit}
                onMinus={() => setQty((q) => Math.max(1, q - 1))}
                onPlus={() => setQty((q) => Math.min(limit, q + 1))}
              />
              <button
                className={storeStyles.primary}
                disabled={!isInStock(product)}
                onClick={() => add(product, qty)}
              >
                {isInStock(product)
                  ? `Add to bag · ${money(product.currency, effectivePrice(product) * qty)}`
                  : "Sold out"}
              </button>
            </div>

            <div className={storeStyles.productLinks}>
              <button onClick={() => toggleWish(product)}>
                <i
                  className={wished ? "ti ti-heart-filled" : "ti ti-heart"}
                  aria-hidden="true"
                />
                {wished ? "Saved" : "Save for later"}
              </button>
              <button onClick={askAbout}>
                <i className="ti ti-message-circle" aria-hidden="true" /> Ask
                about this
              </button>
              <button onClick={share}>
                <i className="ti ti-share-3" aria-hidden="true" /> Share
              </button>
            </div>

            <dl className={styles.specs}>
              {product.sku && (
                <>
                  <dt>SKU</dt>
                  <dd>{product.sku}</dd>
                </>
              )}
              <dt>Category</dt>
              <dd>{category}</dd>
              {product.brand && (
                <>
                  <dt>Brand</dt>
                  <dd>{product.brand}</dd>
                </>
              )}
              <dt>Availability</dt>
              <dd>{stock.label}</dd>
              {fulfilmentChips.length > 0 && (
                <>
                  <dt>Fulfilment</dt>
                  <dd>{fulfilmentChips.join(" · ")}</dd>
                </>
              )}
            </dl>

            <button className={styles.storeCard} onClick={goStore}>
              <span className={styles.storeCardLogo}>
                {business.businessLogo ? (
                  <img src={business.businessLogo} alt="" />
                ) : (
                  initials(business.businessName)
                )}
              </span>
              <span className={styles.storeCardText}>
                <strong>{business.businessName}</strong>
                <small>{products.length} products · Visit the store</small>
              </span>
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* ── Browse categories ────────────────────────────────── */}
        {categories.length > 1 && (
          <section className={styles.chipsSection}>
            <div className={storeStyles.sectionHead}>
              <div>
                <span className={storeStyles.kicker}>BROWSE</span>
                <h2>Shop by category</h2>
              </div>
            </div>
            <div className={storeStyles.chips}>
              {categories.map((c) => (
                <button
                  key={c}
                  className={c === category ? storeStyles.chipOn : ""}
                  onClick={() => goStoreCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Related products ─────────────────────────────────── */}
        {related.length > 0 && (
          <section className={storeStyles.rail}>
            <div className={storeStyles.railHead}>
              <div>
                <span className={storeStyles.kicker}>
                  MORE IN {category.toUpperCase()}
                </span>
                <h2>You might also like</h2>
              </div>
              <span className={storeStyles.railCount}>{related.length}</span>
            </div>
            <div className={storeStyles.railTrack}>
              {related.map((p, i) => (
                <div className={storeStyles.railItem} key={p.id}>
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
        )}

        {/* ── More from this store ─────────────────────────────── */}
        {more.length > 0 && (
          <section className={storeStyles.rail}>
            <div className={storeStyles.railHead}>
              <div>
                <span className={storeStyles.kicker}>KEEP BROWSING</span>
                <h2>More from {business.businessName}</h2>
              </div>
              <span className={storeStyles.railCount}>{more.length}</span>
            </div>
            <div className={storeStyles.railTrack}>
              {more.map((p, i) => (
                <div className={storeStyles.railItem} key={p.id}>
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
        )}

        <footer className={storeStyles.footer}>
          <Logo size={56} variant="horizontal" tone="brand" title="Ehral" />
          <p>
            <i className="ti ti-shield-check" aria-hidden="true" /> Secure
            ordering through your Ehral account. Your orders, receipts and
            messages with {business.businessName} stay in one place.
          </p>
        </footer>
      </main>

      {toast && (
        <div className={storeStyles.toast} role="status">
          <i className="ti ti-circle-check-filled" aria-hidden="true" /> {toast}
        </div>
      )}

      {/* ── Lightbox ──────────────────────────────────────────── */}
      {lightbox && gallery.length > 0 && (
        <div
          className={styles.lightbox}
          onMouseDown={(e) =>
            e.target === e.currentTarget && setLightbox(false)
          }
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} full-size image`}
        >
          <button
            className={styles.lightboxClose}
            onClick={() => setLightbox(false)}
            aria-label="Close"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
          <img src={gallery[activeImage]} alt={product.name} />
          {gallery.length > 1 && (
            <>
              <button
                className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
                onClick={() =>
                  setActiveImage(
                    (i) => (i - 1 + gallery.length) % gallery.length,
                  )
                }
                aria-label="Previous image"
              >
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </button>
              <button
                className={`${styles.lightboxNav} ${styles.lightboxNext}`}
                onClick={() => setActiveImage((i) => (i + 1) % gallery.length)}
                aria-label="Next image"
              >
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </button>
              <span className={styles.lightboxCount}>
                {activeImage + 1} / {gallery.length}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Connect sheet ─────────────────────────────────────── */}
      {connectOpen && (
        <div
          className={storeStyles.overlay}
          onMouseDown={(e) =>
            e.target === e.currentTarget && setConnectOpen(false)
          }
        >
          <section
            className={storeStyles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Connect to continue"
          >
            <div className={storeStyles.sheetGrab} aria-hidden="true" />
            <div className={storeStyles.dialogLogo}>
              {business.businessLogo ? (
                <img src={business.businessLogo} alt="" />
              ) : (
                initials(business.businessName)
              )}
            </div>
            <span className={storeStyles.kicker}>ONE QUICK STEP</span>
            <h2>Connect with {business.businessName}</h2>
            <p>
              Connecting links this business to your Ehral account so your
              messages live in one place. It takes a second.
            </p>
            <button
              className={storeStyles.primary}
              onClick={connectAndContinue}
              disabled={connecting}
            >
              {connecting ? "Connecting…" : "Connect and continue"}{" "}
              <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
            <button
              className={storeStyles.textBtn}
              onClick={() => setConnectOpen(false)}
            >
              Not now
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
