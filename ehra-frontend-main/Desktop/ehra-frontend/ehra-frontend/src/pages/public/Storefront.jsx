import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  createPublicOrder,
  getPublicProducts,
  getPublicStorefront,
} from "../../api/commerceApi";
import { buildWhatsAppLink } from "../../api/whatsappApi";
import {
  sendOtp,
  verifyOtp,
  registerCustomerWithPhone,
} from "../../api/phoneAuthApi";
import { getMyAccounts, switchContext } from "../../api/authApi";
import { useAuth } from "../../context/AuthContext";
import styles from "./Storefront.module.css";

export default function Storefront() {
  const { slug } = useParams();
  const { refreshSession } = useAuth();
  const pendingActionRef = useRef(null);
  const [store, setStore] = useState(null),
    [products, setProducts] = useState([]),
    [cart, setCart] = useState({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [checkout, setCheckout] = useState(false),
    [cartOpen, setCartOpen] = useState(false),
    [form, setForm] = useState({
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      deliveryAddress: "",
      customerNote: "",
      fulfillmentMethod: "",
    }),
    [placed, setPlaced] = useState(null),
    [submitting, setSubmitting] = useState(false),
    [selectedProduct, setSelectedProduct] = useState(null),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("All"),
    [customerGate, setCustomerGate] = useState({
      open: false,
      step: "form",
      pending: null,
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      pinId: "",
      otp: "",
      message: "",
    });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([getPublicStorefront(slug), getPublicProducts(slug)])
      .then(([s, p]) => {
        if (!active) return;
        setStore(s.data);
        setProducts(p.data || []);
      })
      .catch((e) => {
        if (active)
          setError(e?.response?.data?.message || "Storefront not found.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const effectivePrice = (p) =>
    Math.max(0, Number(p.price || 0) - Number(p.discount || 0));
  const imagesOf = (p) => {
    try {
      const a = p?.imagesJson ? JSON.parse(p.imagesJson) : [];
      return Array.isArray(a) && a.length
        ? a.filter(Boolean)
        : p?.imageUrl
          ? [p.imageUrl]
          : [];
    } catch {
      return p?.imageUrl ? [p.imageUrl] : [];
    }
  };
  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          products.map((p) => p.category || p.productCategory).filter(Boolean),
        ),
      ),
    ],
    [products],
  );
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory =
        category === "All" || (p.category || p.productCategory) === category;
      const matchesSearch =
        !q ||
        [p.name, p.description, p.category, p.productCategory]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);
  const cartItems = useMemo(
    () =>
      products
        .filter((p) => cart[p.id])
        .map((p) => ({
          ...p,
          quantity: cart[p.id],
          lineTotal: effectivePrice(p) * cart[p.id],
          lineTax: Number(p.tax || 0) * cart[p.id],
        })),
    [products, cart],
  );
  const subtotal = cartItems.reduce((n, x) => n + Number(x.lineTotal || 0), 0),
    taxTotal = cartItems.reduce((n, x) => n + Number(x.lineTax || 0), 0),
    total = subtotal + taxTotal,
    cartCount = cartItems.reduce((n, x) => n + x.quantity, 0);
  const featured =
    products.find((p) => p.available && imagesOf(p).length) ||
    products.find((p) => p.available) ||
    products[0];
  const add = (p) =>
    setCart((c) => ({ ...c, [p.id]: Math.min((c[p.id] || 0) + 1, 1000) }));
  const remove = (p) =>
    setCart((c) => {
      const n = { ...c };
      if ((n[p.id] || 0) <= 1) delete n[p.id];
      else n[p.id]--;
      return n;
    });
  const requireCustomer = useCallback(
    async (action) => {
      if (!store?.businessId || typeof action !== "function") return;
      const type = localStorage.getItem("contextType"),
        bid = localStorage.getItem("businessId");
      if (type === "CUSTOMER" && String(bid) === String(store.businessId)) {
        action();
        return;
      }
      try {
        if (localStorage.getItem("accessToken")) {
          const accounts = await getMyAccounts();
          const existing = (
            Array.isArray(accounts) ? accounts : accounts?.data || []
          ).find(
            (a) =>
              a.type === "CUSTOMER" &&
              String(a.businessId) === String(store.businessId),
          );
          if (existing) {
            await switchContext("CUSTOMER", existing.membershipId);
            await refreshSession?.();
            action();
            return;
          }
        }
      } catch {}
      pendingActionRef.current = action;
      setCustomerGate((g) => ({
        ...g,
        open: true,
        pending: null,
        step: "form",
        message: "",
      }));
    },
    [store?.businessId, refreshSession],
  );
  const chat = (p) => {
    if (!store?.whatsappNumber) return;
    requireCustomer(() => {
      const msg = `Hello, I am interested in:\n\nProduct: ${p.name}\nPrice: ${p.currency} ${Number(p.price).toLocaleString()}`;
      window.location.href = buildWhatsAppLink(store.whatsappNumber, msg);
    });
  };
  const openCheckout = () =>
    requireCustomer(() => {
      setCartOpen(false);
      setCheckout(true);
    });
  const submit = async (e) => {
    e.preventDefault();
    if (!cartItems.length) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await createPublicOrder(slug, {
        ...form,
        items: cartItems.map((i) => ({
          productId: i.id,
          quantity: i.quantity,
        })),
      });
      setPlaced(r.data);
      setCart({});
      setCheckout(false);
      setCartOpen(false);
    } catch (e) {
      setError(e?.response?.data?.message || "Could not place your order.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className={styles.center}>
        <div className={styles.loader}>
          <span></span>
          <span></span>
          <span></span>
          <p>Loading store</p>
        </div>
      </div>
    );
  if (error && !store)
    return (
      <div className={styles.center}>
        <div className={styles.notFound}>
          <i className="ti ti-store-off" />
          <h2>Store unavailable</h2>
          <p>{error}</p>
        </div>
      </div>
    );

  return (
    <div className={styles.page}>
      <header className={styles.navbar}>
        <a
          href="#top"
          className={styles.brandMark}
          aria-label={`${store.name} home`}
        >
          {store.businessLogo ? (
            <img src={store.businessLogo} alt="" />
          ) : (
            <span className={styles.logoFallback}>
              {String(store.name || "S")
                .charAt(0)
                .toUpperCase()}
            </span>
          )}
          <span>{store.name}</span>
        </a>
        <div className={styles.searchBox}>
          <i className="ti ti-search" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
          />
          <kbd>⌘ K</kbd>
        </div>
        <div className={styles.navActions}>
          {store.whatsappNumber && (
            <button
              className={styles.iconAction}
              onClick={() =>
                requireCustomer(
                  () =>
                    (window.location.href = buildWhatsAppLink(
                      store.whatsappNumber,
                      "Hello, I found your store on Ehral and would like to make an enquiry.",
                    )),
                )
              }
            >
              <i className="ti ti-brand-whatsapp" />
              <span>Chat</span>
            </button>
          )}
          <button
            className={styles.cartAction}
            onClick={() => setCartOpen(true)}
          >
            <i className="ti ti-shopping-bag" />
            <span>Cart</span>
            {cartCount > 0 && <b>{cartCount}</b>}
          </button>
        </div>
      </header>

      <main id="top">
        <section
          className={styles.hero}
          style={
            store.coverImage
              ? {
                  backgroundImage: `linear-gradient(100deg,rgba(9,12,20,.88) 0%,rgba(9,12,20,.66) 48%,rgba(9,12,20,.28) 100%),url(${store.coverImage})`,
                }
              : {}
          }
        >
          <div className={styles.heroContent}>
            <div className={styles.heroEyebrow}>
              <span className={styles.liveDot}></span>
              {store.businessType || "Store"}
              {store.businessCategory && (
                <>
                  <span>•</span>
                  {store.businessCategory}
                </>
              )}
            </div>
            <h1>{store.name}</h1>
            <p>{store.description || "Discover products selected for you."}</p>
            <div className={styles.heroActions}>
              <a href="#products" className={styles.primaryCta}>
                Shop now <i className="ti ti-arrow-right" />
              </a>
              {store.whatsappNumber && (
                <button
                  className={styles.secondaryCta}
                  onClick={() =>
                    requireCustomer(
                      () =>
                        (window.location.href = buildWhatsAppLink(
                          store.whatsappNumber,
                          "Hello, I found your store on Ehral and would like to make an enquiry.",
                        )),
                    )
                  }
                >
                  <i className="ti ti-brand-whatsapp" /> Chat with us
                </button>
              )}
            </div>
          </div>
          {featured && (
            <button
              className={styles.featuredFloat}
              onClick={() => setSelectedProduct(featured)}
            >
              <span>Featured</span>
              <div className={styles.featuredInner}>
                {imagesOf(featured)[0] ? (
                  <img src={imagesOf(featured)[0]} alt="" />
                ) : (
                  <div className={styles.imagePlaceholder}>
                    <i className="ti ti-package" />
                  </div>
                )}
                <div>
                  <small>{featured.category || "Popular choice"}</small>
                  <strong>{featured.name}</strong>
                  <b>
                    {featured.currency}{" "}
                    {effectivePrice(featured).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </b>
                </div>
                <i className="ti ti-chevron-right" />
              </div>
            </button>
          )}
        </section>

        <section className={styles.trustBar}>
          <div>
            <i className="ti ti-shield-check" />
            <span>
              <b>Shop with confidence</b>
              <small>Secure ordering</small>
            </span>
          </div>
          <div>
            <i className="ti ti-truck-delivery" />
            <span>
              <b>Flexible fulfilment</b>
              <small>Pickup or delivery</small>
            </span>
          </div>
          <div>
            <i className="ti ti-message-circle" />
            <span>
              <b>Need help?</b>
              <small>Chat with the store</small>
            </span>
          </div>
        </section>

        <section className={styles.catalog} id="products">
          <div className={styles.catalogHead}>
            <div>
              <span className={styles.sectionKicker}>THE COLLECTION</span>
              <h2>Shop all products</h2>
              <p>
                {filteredProducts.length}{" "}
                {filteredProducts.length === 1 ? "product" : "products"}{" "}
                available
              </p>
            </div>
            {cartCount > 0 && (
              <button
                className={styles.desktopCart}
                onClick={() => setCartOpen(true)}
              >
                <i className="ti ti-shopping-bag" /> View cart{" "}
                <span>
                  {store.currency || "NGN"} {total.toLocaleString()}
                </span>
              </button>
            )}
          </div>
          <div className={styles.filters}>
            {categories.map((c) => (
              <button
                key={c}
                className={category === c ? styles.activeFilter : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {error && <div className={styles.error}>{error}</div>}
          {filteredProducts.length ? (
            <div className={styles.grid}>
              {filteredProducts.map((p) => {
                const image = imagesOf(p)[0],
                  discount = Number(p.discount || 0) > 0;
                return (
                  <article className={styles.product} key={p.id}>
                    <button
                      type="button"
                      className={styles.productImageButton}
                      onClick={() => setSelectedProduct(p)}
                      aria-label={`View ${p.name}`}
                    >
                      <div className={styles.imageWrap}>
                        {image ? (
                          <img src={image} alt={p.name} />
                        ) : (
                          <div className={styles.imagePlaceholder}>
                            <i className="ti ti-package" />
                          </div>
                        )}
                        {discount && (
                          <span className={styles.saleBadge}>SALE</span>
                        )}{" "}
                        {!p.available && (
                          <span className={styles.soldBadge}>SOLD OUT</span>
                        )}
                        <span className={styles.quickView}>
                          Quick view <i className="ti ti-arrow-up-right" />
                        </span>
                      </div>
                    </button>
                    <div className={styles.productBody}>
                      <div className={styles.productMeta}>
                        <span>
                          {p.category || p.productCategory || "Product"}
                        </span>
                        {p.available ? (
                          <span className={styles.available}>
                            <i /> In stock
                          </span>
                        ) : (
                          <span className={styles.unavailable}>
                            Out of stock
                          </span>
                        )}
                      </div>
                      <h3>{p.name}</h3>
                      <p>{p.description || ""}</p>
                      <div className={styles.priceRow}>
                        <div>
                          <strong>
                            {p.currency}{" "}
                            {effectivePrice(p).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </strong>
                          {discount && (
                            <del>
                              {p.currency}{" "}
                              {Number(p.price).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </del>
                          )}
                        </div>
                        <button
                          disabled={!p.available}
                          onClick={() => requireCustomer(() => add(p))}
                          aria-label={`Add ${p.name} to order`}
                        >
                          <i className="ti ti-plus" /> Add
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <i className="ti ti-search-off" />
              <h3>No products found</h3>
              <p>Try a different search or category.</p>
              <button
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        <section className={styles.aboutStore}>
          <div className={styles.aboutCard}>
            <div>
              <span className={styles.sectionKicker}>ABOUT THE STORE</span>
              <h2>More than a storefront.</h2>
              <p>
                {store.description ||
                  `Welcome to ${store.name}. Browse our collection and place your order directly through this store.`}
              </p>
            </div>
            <div className={styles.storeDetails}>
              <div>
                <i className="ti ti-clock" />
                <span>
                  <b>Store hours</b>
                  <small>Check with the store for today's hours</small>
                </span>
              </div>
              <div>
                <i className="ti ti-map-pin" />
                <span>
                  <b>Fulfilment</b>
                  <small>
                    {[
                      store.pickupEnabled && "Pickup",
                      store.deliveryEnabled && "Delivery",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Order fulfilment available"}
                  </small>
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          {store.businessLogo ? (
            <img src={store.businessLogo} alt="" />
          ) : (
            <span className={styles.logoFallback}>
              {String(store.name || "S")
                .charAt(0)
                .toUpperCase()}
            </span>
          )}
          <div>
            <strong>{store.name}</strong>
            <span>Online storefront</span>
          </div>
        </div>
        <span>
          Powered by <b>Ehral</b>
        </span>
      </footer>

      {cartOpen && (
        <div
          className={styles.overlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCartOpen(false);
          }}
        >
          <aside className={styles.cartDrawer}>
            <div className={styles.drawerHead}>
              <div>
                <span className={styles.sectionKicker}>YOUR ORDER</span>
                <h2>
                  Shopping bag <small>{cartCount}</small>
                </h2>
              </div>
              <button
                className={styles.close}
                onClick={() => setCartOpen(false)}
              >
                ×
              </button>
            </div>
            {cartItems.length ? (
              <>
                <div className={styles.cartList}>
                  {cartItems.map((i) => (
                    <div className={styles.cartItem} key={i.id}>
                      {imagesOf(i)[0] ? (
                        <img src={imagesOf(i)[0]} alt="" />
                      ) : (
                        <div className={styles.cartThumb}>
                          <i className="ti ti-package" />
                        </div>
                      )}
                      <div className={styles.cartInfo}>
                        <strong>{i.name}</strong>
                        <span>
                          {i.currency} {effectivePrice(i).toLocaleString()}
                        </span>
                        <div className={styles.qty}>
                          <button onClick={() => remove(i)}>−</button>
                          <b>{i.quantity}</b>
                          <button onClick={() => add(i)}>+</button>
                        </div>
                      </div>
                      <b className={styles.lineTotal}>
                        {i.currency} {i.lineTotal.toLocaleString()}
                      </b>
                    </div>
                  ))}
                </div>
                <div className={styles.cartBottom}>
                  <div>
                    <span>Subtotal</span>
                    <strong>
                      {store.currency || cartItems[0]?.currency || "NGN"}{" "}
                      {subtotal.toLocaleString()}
                    </strong>
                  </div>
                  {taxTotal > 0 && (
                    <div>
                      <span>Tax</span>
                      <strong>
                        {store.currency || cartItems[0]?.currency || "NGN"}{" "}
                        {taxTotal.toLocaleString()}
                      </strong>
                    </div>
                  )}
                  <div className={styles.totalLine}>
                    <span>Total</span>
                    <strong>
                      {store.currency || cartItems[0]?.currency || "NGN"}{" "}
                      {total.toLocaleString()}
                    </strong>
                  </div>
                  <button className={styles.checkoutCta} onClick={openCheckout}>
                    Continue to checkout <i className="ti ti-arrow-right" />
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.emptyCart}>
                <div>
                  <i className="ti ti-shopping-bag" />
                </div>
                <h3>Your bag is empty</h3>
                <p>Add products to your order and they will appear here.</p>
                <button onClick={() => setCartOpen(false)}>
                  Continue shopping
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {selectedProduct && (
        <div
          className={styles.overlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedProduct(null);
          }}
        >
          <div className={styles.productModal}>
            <button
              className={styles.close}
              onClick={() => setSelectedProduct(null)}
            >
              ×
            </button>
            <div className={styles.modalGallery}>
              {imagesOf(selectedProduct).length ? (
                imagesOf(selectedProduct).map((u, i) => (
                  <img
                    key={u + i}
                    src={u}
                    alt={`${selectedProduct.name} ${i + 1}`}
                  />
                ))
              ) : (
                <div className={styles.imagePlaceholder}>
                  <i className="ti ti-package" />
                </div>
              )}
            </div>
            <div className={styles.modalInfo}>
              <span className={styles.sectionKicker}>
                {selectedProduct.category ||
                  selectedProduct.productCategory ||
                  "PRODUCT"}
              </span>
              <h2>{selectedProduct.name}</h2>
              <p>{selectedProduct.description || ""}</p>
              <div className={styles.modalPrice}>
                {selectedProduct.currency}{" "}
                {effectivePrice(selectedProduct).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </div>
              <span
                className={
                  selectedProduct.available
                    ? styles.modalStock
                    : styles.unavailable
                }
              >
                {selectedProduct.available
                  ? "In stock"
                  : "Currently unavailable"}
              </span>
              <div className={styles.modalActions}>
                <button
                  disabled={!selectedProduct.available}
                  onClick={() =>
                    requireCustomer(() => {
                      add(selectedProduct);
                      setSelectedProduct(null);
                      setCartOpen(true);
                    })
                  }
                >
                  Add to order <i className="ti ti-plus" />
                </button>
                {store.whatsappNumber && (
                  <button
                    className={styles.outlineCta}
                    onClick={() => {
                      setSelectedProduct(null);
                      chat(selectedProduct);
                    }}
                  >
                    <i className="ti ti-brand-whatsapp" /> Ask a question
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {customerGate.open && (
        <div className={styles.overlay}>
          <div className={styles.accountModal}>
            <button
              className={styles.close}
              onClick={() => setCustomerGate((g) => ({ ...g, open: false }))}
            >
              ×
            </button>
            <div className={styles.accountIcon}>
              <i className="ti ti-user-check" />
            </div>
            <span className={styles.sectionKicker}>ALMOST THERE</span>
            <h2>Create your customer account</h2>
            <p>
              You can browse freely. To place an order or contact this store,
              Ehral connects you to a customer account for{" "}
              <b>{store.businessName}</b>.
            </p>
            {customerGate.step === "form" && (
              <div className={styles.accountForm}>
                <div className={styles.twoCol}>
                  <input
                    required
                    placeholder="First name"
                    value={customerGate.firstName}
                    onChange={(e) =>
                      setCustomerGate((g) => ({
                        ...g,
                        firstName: e.target.value,
                      }))
                    }
                  />
                  <input
                    placeholder="Last name"
                    value={customerGate.lastName}
                    onChange={(e) =>
                      setCustomerGate((g) => ({
                        ...g,
                        lastName: e.target.value,
                      }))
                    }
                  />
                </div>
                <input
                  required
                  placeholder="Phone number"
                  value={customerGate.phone}
                  onChange={(e) =>
                    setCustomerGate((g) => ({ ...g, phone: e.target.value }))
                  }
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={customerGate.email}
                  onChange={(e) =>
                    setCustomerGate((g) => ({ ...g, email: e.target.value }))
                  }
                />
                <button
                  disabled={!customerGate.firstName || !customerGate.phone}
                  onClick={async () => {
                    try {
                      setCustomerGate((g) => ({
                        ...g,
                        step: "sending",
                        message: "Sending verification code…",
                      }));
                      const r = await sendOtp(customerGate.phone);
                      setCustomerGate((g) => ({
                        ...g,
                        step: "verify",
                        pinId: r.pinId,
                        message: r.developmentOtp
                          ? `Development OTP: ${r.developmentOtp}`
                          : "Verification code sent to your phone.",
                      }));
                    } catch (e) {
                      setCustomerGate((g) => ({
                        ...g,
                        step: "form",
                        message:
                          e?.response?.data?.message ||
                          "Could not send verification code.",
                      }));
                    }
                  }}
                >
                  Continue <i className="ti ti-arrow-right" />
                </button>
              </div>
            )}
            {customerGate.step === "verify" && (
              <div className={styles.accountForm}>
                <input
                  inputMode="numeric"
                  placeholder="Enter verification code"
                  value={customerGate.otp}
                  onChange={(e) =>
                    setCustomerGate((g) => ({ ...g, otp: e.target.value }))
                  }
                />
                <button
                  disabled={!customerGate.otp}
                  onClick={async () => {
                    try {
                      setCustomerGate((g) => ({
                        ...g,
                        step: "verifying",
                        message: "Creating your customer account…",
                      }));
                      const v = await verifyOtp(
                        customerGate.pinId,
                        customerGate.otp,
                      );
                      await registerCustomerWithPhone(
                        v.phoneVerificationToken,
                        {
                          businessSlug: slug,
                          firstName: customerGate.firstName,
                          lastName: customerGate.lastName,
                          email: customerGate.email,
                        },
                      );
                      refreshSession?.();
                      setForm((f) => ({
                        ...f,
                        customerName: [
                          customerGate.firstName,
                          customerGate.lastName,
                        ]
                          .filter(Boolean)
                          .join(" "),
                        customerPhone: customerGate.phone,
                        customerEmail: customerGate.email,
                      }));
                      const action = pendingActionRef.current;
                      pendingActionRef.current = null;
                      setCustomerGate((g) => ({
                        ...g,
                        open: false,
                        step: "done",
                        message: "",
                        pending: null,
                      }));
                      if (action) action();
                    } catch (e) {
                      setCustomerGate((g) => ({
                        ...g,
                        step: "verify",
                        message:
                          e?.response?.data?.message ||
                          "Could not create your customer account.",
                      }));
                    }
                  }}
                >
                  Verify & continue <i className="ti ti-check" />
                </button>
              </div>
            )}
            {customerGate.message && (
              <small className={styles.formMessage}>
                {customerGate.message}
              </small>
            )}
            <small className={styles.privacyNote}>
              <i className="ti ti-lock" /> Your information is used to manage
              your customer relationship with this store.
            </small>
          </div>
        </div>
      )}

      {checkout && (
        <div className={styles.overlay}>
          <div className={styles.checkoutModal}>
            <button className={styles.close} onClick={() => setCheckout(false)}>
              ×
            </button>
            <div className={styles.checkoutHead}>
              <span className={styles.sectionKicker}>CHECKOUT</span>
              <h2>Complete your order</h2>
              <p>
                Review your items and tell the store how to fulfil your order.
              </p>
            </div>
            <div className={styles.checkoutSummary}>
              {cartItems.map((i) => (
                <div key={i.id}>
                  <span>
                    {i.name} × {i.quantity}
                  </span>
                  <b>
                    {i.currency} {i.lineTotal.toLocaleString()}
                  </b>
                </div>
              ))}
              <div className={styles.summaryTotal}>
                <span>Total</span>
                <b>
                  {cartItems[0]?.currency || store.currency || "NGN"}{" "}
                  {total.toLocaleString()}
                </b>
              </div>
            </div>
            <form onSubmit={submit} className={styles.checkoutForm}>
              <div className={styles.twoCol}>
                <input
                  required
                  placeholder="Full name"
                  value={form.customerName}
                  onChange={(e) =>
                    setForm({ ...form, customerName: e.target.value })
                  }
                />
                <input
                  required
                  placeholder="WhatsApp / phone number"
                  value={form.customerPhone}
                  onChange={(e) =>
                    setForm({ ...form, customerPhone: e.target.value })
                  }
                />
              </div>
              <input
                type="email"
                placeholder="Email (optional)"
                value={form.customerEmail}
                onChange={(e) =>
                  setForm({ ...form, customerEmail: e.target.value })
                }
              />
              <div>
                <label>Fulfilment method</label>
                <select
                  required
                  value={form.fulfillmentMethod || ""}
                  onChange={(e) =>
                    setForm({ ...form, fulfillmentMethod: e.target.value })
                  }
                >
                  <option value="">Choose fulfilment</option>
                  {store.pickupEnabled && (
                    <option value="PICKUP">Pickup</option>
                  )}
                  {store.deliveryEnabled && (
                    <option value="DELIVERY">Delivery</option>
                  )}
                </select>
              </div>
              {form.fulfillmentMethod === "DELIVERY" && (
                <textarea
                  required
                  placeholder="Delivery address"
                  value={form.deliveryAddress}
                  onChange={(e) =>
                    setForm({ ...form, deliveryAddress: e.target.value })
                  }
                />
              )}
              <textarea
                placeholder="Order note (optional)"
                value={form.customerNote}
                onChange={(e) =>
                  setForm({ ...form, customerNote: e.target.value })
                }
              />
              <button className={styles.checkoutCta} disabled={submitting}>
                {submitting ? "Placing order…" : "Place order"}
                <i className="ti ti-arrow-right" />
              </button>
            </form>
          </div>
        </div>
      )}

      {placed && (
        <div className={styles.overlay}>
          <div className={styles.successModal}>
            <div className={styles.successIcon}>
              <i className="ti ti-check" />
            </div>
            <span className={styles.sectionKicker}>ORDER CONFIRMED</span>
            <h2>Thank you for your order.</h2>
            <p>
              Your order <b>#{placed.orderNumber}</b> has been created
              successfully.
            </p>
            <div className={styles.orderTotal}>
              <span>Total</span>
              <strong>
                {placed.currency} {Number(placed.total).toLocaleString()}
              </strong>
            </div>
            {store.whatsappNumber && (
              <button
                className={styles.checkoutCta}
                onClick={() =>
                  (window.location.href = buildWhatsAppLink(
                    store.whatsappNumber,
                    `Hello, I just placed order #${placed.orderNumber} through Ehral and would like to follow up.`,
                  ))
                }
              >
                Continue on WhatsApp <i className="ti ti-brand-whatsapp" />
              </button>
            )}
            <button className={styles.textCta} onClick={() => setPlaced(null)}>
              Continue shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
