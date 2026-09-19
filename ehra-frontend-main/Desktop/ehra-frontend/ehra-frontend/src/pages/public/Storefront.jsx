import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import {
  createPublicOrder,
  getPublicProducts,
  getPublicStorefront,
  getCustomerOverview,
} from "../../api/commerceApi";
import { buildWhatsAppLink } from "../../api/whatsappApi";
import {
  sendOtp,
  verifyOtp,
  checkPhone,
  registerCustomerWithPhone,
} from "../../api/phoneAuthApi";
import {
  getMyAccounts,
  switchContext,
  login as apiLogin,
  clearTokens,
} from "../../api/authApi";
import { connectCustomerToBusiness } from "../../api/commerceApi";
import { createCustomerBusinessConversation } from "../../api/messagingApi";
import { useAuth } from "../../context/AuthContext";
import Logo from "../../components/Logo";
import styles from "./Storefront.module.css";

const CART_KEY = (slug) => `ehral:storefront:cart:${slug || "unknown"}`;
const WISHLIST_KEY = (slug) => `ehral:storefront:wishlist:${slug || "unknown"}`;
const RECENT_KEY = (slug) => `ehral:storefront:recent:${slug || "unknown"}`;
const readJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable */
  }
};

const money = (currency, value) =>
  `${currency || "NGN"} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const effectivePrice = (p) => {
  const price = Number(p?.price || 0);
  const discount = Number(p?.discount || 0);
  return Math.max(0, price - (Number.isFinite(discount) ? discount : 0));
};
const getCategory = (p) => {
  const raw =
    p?.category ??
    p?.productCategory ??
    p?.categoryName ??
    (typeof p?.category === "object" ? p.category?.name : null);
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "Other products";
};
const stockOf = (p) => {
  const raw = p?.stockQuantity;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, value) : null;
};
const inventoryTracked = (p) => p?.trackInventory !== false;
const hasStockData = (p) => stockOf(p) !== null;
const isInStock = (p) => {
  const stock = stockOf(p);
  return stock !== null ? stock > 0 : Boolean(p?.available);
};
const stockState = (p) => {
  const n = stockOf(p);
  if (n !== null) {
    if (n <= 0) return { label: "Out of stock", tone: "empty", quantity: 0 };
    const threshold = Number(p?.lowStockThreshold);
    if (Number.isFinite(threshold) && threshold > 0 && n <= threshold)
      return { label: `${n} left in stock`, tone: "low", quantity: n };
    return { label: `${n} in stock`, tone: "good", quantity: n };
  }
  return isInStock(p)
    ? { label: "Available", tone: "good", quantity: null }
    : { label: "Out of stock", tone: "empty", quantity: 0 };
};
const imagesOf = (p) => {
  try {
    const parsed = p?.imagesJson ? JSON.parse(p.imagesJson) : [];
    if (Array.isArray(parsed) && parsed.length) return parsed.filter(Boolean);
  } catch {
    /* fall back to imageUrl */
  }
  return p?.imageUrl ? [p.imageUrl] : [];
};

function ProductCard({
  product,
  onOpen,
  onAdd,
  wished,
  onWishlist,
  compact = false,
}) {
  const image = imagesOf(product)[0];
  const discounted = Number(product?.discount || 0) > 0;
  const stock = stockState(product);
  return (
    <article
      className={`${styles.product} ${compact ? styles.productCompact : ""}`}
    >
      <button
        type="button"
        className={styles.productVisual}
        onClick={() => onOpen(product)}
        aria-label={`View ${product.name}`}
      >
        {image ? (
          <img src={image} alt={product.name} loading="lazy" />
        ) : (
          <div className={styles.imagePlaceholder}>
            <i className="ti ti-package" />
          </div>
        )}
        <span
          className={`${styles.stockBadge} ${styles[`stock${stock.tone}`]}`}
        >
          {stock.label}
        </span>
        {discounted && <span className={styles.saleBadge}>Offer</span>}
        <span className={styles.quickView}>
          Quick view <i className="ti ti-arrow-up-right" />
        </span>
      </button>
      <div className={styles.productBody}>
        <div className={styles.productMeta}>
          <span className={styles.categoryLabel}>
            <i className="ti ti-tag" />
            {getCategory(product)}
          </span>
          <span
            className={`${styles.cardStockText} ${styles[`stock${stock.tone}`]}`}
          >
            {stock.label}
          </span>
          <button
            type="button"
            className={`${styles.heart} ${wished ? styles.wished : ""}`}
            onClick={() => onWishlist(product)}
          >
            <i className={wished ? "ti ti-heart-filled" : "ti ti-heart"} />
          </button>
        </div>
        <button
          type="button"
          className={styles.productName}
          onClick={() => onOpen(product)}
        >
          {product.name}
        </button>
        {!compact && product.description && (
          <p className={styles.productDescription}>{product.description}</p>
        )}
        <div className={styles.productFoot}>
          <div>
            <strong>{money(product.currency, effectivePrice(product))}</strong>
            {discounted && <del>{money(product.currency, product.price)}</del>}
          </div>
          <button
            className={styles.addButton}
            disabled={!isInStock(product)}
            onClick={() => onAdd(product)}
          >
            <i className="ti ti-plus" />
          </button>
        </div>
      </div>
    </article>
  );
}
function ProductRail({
  title,
  kicker,
  products,
  onOpen,
  onAdd,
  wishlist,
  onWishlist,
}) {
  if (!products?.length) return null;
  return (
    <section className={styles.railSection}>
      <div className={styles.railHead}>
        <div>
          <span className={styles.sectionKicker}>{kicker}</span>
          <h2>{title}</h2>
        </div>
        <span>
          {products.length} item{products.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className={styles.productRail}>
        {products.slice(0, 8).map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            compact
            onOpen={onOpen}
            onAdd={onAdd}
            wished={wishlist.has(String(p.id))}
            onWishlist={onWishlist}
          />
        ))}
      </div>
    </section>
  );
}

function CustomerGate({ store, slug, gate, setGate, onComplete }) {
  const close = () =>
    setGate((g) => ({ ...g, open: false, pending: null, message: "" }));
  const setMessage = (message) => setGate((g) => ({ ...g, message }));

  const submitPhone = async () => {
    const phone = gate.phone?.trim();
    if (!phone || !isValidPhoneNumber(phone)) {
      setMessage("Enter a valid phone number before continuing.");
      return;
    }
    try {
      setGate((g) => ({
        ...g,
        step: "sending",
        message: "Sending verification code…",
      }));
      const r = await sendOtp(phone);
      setGate((g) => ({
        ...g,
        phone,
        step: "verify",
        pinId: r?.pinId,
        otp: "",
        message: r?.developmentOtp
          ? `Development OTP: ${r.developmentOtp}`
          : "Verification code sent to your phone.",
      }));
    } catch (e) {
      setGate((g) => ({
        ...g,
        step: "phone",
        message:
          e?.response?.data?.message || "Could not send verification code.",
      }));
    }
  };

  const verify = async () => {
    if (!gate.pinId || !gate.otp) return;
    try {
      setGate((g) => ({
        ...g,
        step: "verifying",
        message: "Verifying your phone number…",
      }));
      const v = await verifyOtp(gate.pinId, gate.otp);
      const phoneVerificationToken = v.phoneVerificationToken;
      const check = await checkPhone(phoneVerificationToken);
      setGate((g) => ({
        ...g,
        phone: v.phoneNumber || g.phone,
        phoneVerificationToken,
        step: check.exists ? "existingLogin" : "password",
        message: check.exists
          ? "This phone already has an Ehral account. Please sign in instead."
          : "Phone number verified. Create your password to continue.",
      }));
    } catch (e) {
      setGate((g) => ({
        ...g,
        step: "verify",
        message:
          e?.response?.data?.message ||
          "The verification code could not be confirmed.",
      }));
    }
  };

  const continueToProfile = () => {
    if (!gate.password || gate.password.length < 8) {
      setMessage("Create a password with at least 8 characters.");
      return;
    }
    if (gate.password !== gate.confirmPassword) {
      setMessage("Your passwords do not match.");
      return;
    }
    setGate((g) => ({
      ...g,
      step: "profile",
      message: "Password created. Now complete your basic profile.",
    }));
  };

  const createAccount = async () => {
    if (!gate.phoneVerificationToken || !gate.firstName.trim()) {
      setMessage("Enter your first name to continue.");
      return;
    }
    try {
      setGate((g) => ({
        ...g,
        step: "creating",
        message: "Creating your secure Ehral customer account…",
      }));
      await registerCustomerWithPhone(gate.phoneVerificationToken, {
        businessSlug: slug,
        firstName: gate.firstName.trim(),
        lastName: gate.lastName.trim(),
        email: gate.email.trim(),
        password: gate.password,
      });
      clearTokens();
      navigate("/login", {
        state: {
          phone: gate.phone,
          message:
            "Your Ehral customer account is ready. Sign in with your password to continue.",
        },
      });
      setGate((g) => ({
        ...g,
        open: false,
        pending: null,
        step: "done",
        message: "",
      }));
    } catch (e) {
      setGate((g) => ({
        ...g,
        step: "profile",
        message:
          e?.response?.data?.message ||
          "Could not create your customer account.",
      }));
    }
  };

  const signInExisting = async () => {
    if (!gate.password) {
      setMessage("Enter your Ehral account password.");
      return;
    }
    try {
      setGate((g) => ({
        ...g,
        step: "signingIn",
        message: "Signing you into Ehral…",
      }));
      await apiLogin(gate.phone, gate.password);
      const accounts = await getMyAccounts();
      const list = Array.isArray(accounts) ? accounts : [];
      const existing = list.find(
        (a) =>
          a?.type === "CUSTOMER" &&
          String(a?.businessId) === String(store?.businessId),
      );
      if (existing?.membershipId)
        await switchContext("CUSTOMER", existing.membershipId);
      else {
        await connectCustomerToBusiness(slug);
        const refreshed = await getMyAccounts();
        const membership = (Array.isArray(refreshed) ? refreshed : []).find(
          (a) =>
            a?.type === "CUSTOMER" &&
            String(a?.businessId) === String(store?.businessId),
        );
        if (membership?.membershipId)
          await switchContext("CUSTOMER", membership.membershipId);
      }
      let profile = {};
      try {
        const profileResponse = await getCustomerOverview();
        profile = profileResponse?.data || {};
      } catch {}
      onComplete({
        name: [profile.firstName || gate.firstName, profile.lastName]
          .filter(Boolean)
          .join(" "),
        phone: profile.phone || gate.phone,
        email: profile.email || gate.email,
        action: gate.pending,
      });
    } catch (e) {
      setGate((g) => ({
        ...g,
        step: "existingLogin",
        message:
          e?.response?.data?.message ||
          "We could not sign you in. Check your password and try again.",
      }));
    }
  };

  if (!gate.open) return null;
  const stepNumber = ["phone", "sending"].includes(gate.step)
    ? 1
    : ["verify", "verifying"].includes(gate.step)
      ? 2
      : 3;
  const storeName = store?.businessName || store?.name || "this store";
  const isLogin = gate.step === "existingLogin" || gate.step === "signingIn";
  const isPasswordStep = gate.step === "password";
  const isProfileStep = gate.step === "profile" || gate.step === "creating";
  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Ehral customer account"
    >
      <div className={`${styles.accountModal} ${styles.customerGateModal}`}>
        <button className={styles.close} onClick={close} aria-label="Close">
          ×
        </button>
        <div className={styles.customerGateBrand}>
          <div className={styles.customerGateEhral}>
            <Logo size={112} variant="horizontal" title="Ehral" tone="brand" />
            <span className={styles.customerGatePowered}>EHRAL CUSTOMER</span>
          </div>
          {store?.businessLogo && (
            <>
              <span
                className={styles.customerGateBrandDivider}
                aria-hidden="true"
              />
              <span className={styles.customerGateStoreLogo}>
                <img src={store.businessLogo} alt="" />
              </span>
            </>
          )}
        </div>
        <div className={styles.customerGateBrandRule} aria-hidden="true">
          <span />
          <i />
          <span />
        </div>
        <div
          className={styles.customerGateProgress}
          aria-label={`Step ${stepNumber} of 3`}
        >
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={
                n <= stepNumber ? styles.customerGateProgressActive : ""
              }
            >
              {n}
            </span>
          ))}
        </div>
        <span className={styles.sectionKicker}>
          {isLogin ? "WELCOME BACK" : "EHRAL CUSTOMER ACCOUNT"}
        </span>
        <h2>
          {stepNumber === 1
            ? "Start with your phone number"
            : stepNumber === 2
              ? "Verify your phone number"
              : isLogin
                ? "Sign in to continue"
                : isPasswordStep
                  ? "Create your password"
                  : "Complete your profile"}
        </h2>
        <p>
          {stepNumber === 1 && (
            <>
              Use your phone number to securely connect with <b>{storeName}</b>.
            </>
          )}
          {stepNumber === 2 && (
            <>
              We sent a verification code to <b>{gate.phone}</b>. Enter it below
              to continue.
            </>
          )}
          {stepNumber === 3 && !isLogin && isPasswordStep && (
            <>
              Your phone is verified. Create the password you will use to sign
              in to your Ehral account.
            </>
          )}
          {stepNumber === 3 && !isLogin && isProfileStep && (
            <>
              Password set. Add your basic details now. You can complete and
              edit your full profile later from your customer dashboard.
            </>
          )}
          {isLogin && (
            <>
              An Ehral account already exists for <b>{gate.phone}</b>. Please
              sign in instead. If you do not remember your password, use the
              password reset link below.
            </>
          )}
        </p>
        {gate.step === "phone" && (
          <div className={styles.accountForm}>
            <label className={styles.customerGateLabel}>Phone number</label>
            <div className={styles.customerPhoneWrap}>
              <PhoneInput
                international
                defaultCountry="NG"
                countryCallingCodeEditable={false}
                placeholder="Enter your phone number"
                value={gate.phone}
                onChange={(value) =>
                  setGate((g) => ({ ...g, phone: value || "", message: "" }))
                }
                onKeyDown={(e) => e.key === "Enter" && submitPhone()}
                className={styles.customerPhoneInput}
              />
            </div>
            <small className={styles.customerGateHint}>
              We verify your phone before requesting your personal details.
            </small>
            <button
              disabled={!gate.phone || !isValidPhoneNumber(gate.phone)}
              onClick={submitPhone}
            >
              Continue securely <i className="ti ti-arrow-right" />
            </button>
          </div>
        )}
        {gate.step === "sending" && (
          <div className={styles.gateLoading}>
            <span className={styles.gateSpinner} /> Sending your verification
            code…
          </div>
        )}
        {(gate.step === "verify" || gate.step === "verifying") && (
          <div className={styles.accountForm}>
            <label className={styles.customerGateLabel}>
              Verification code
            </label>
            <input
              className={styles.otpInput}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="Enter verification code"
              value={gate.otp}
              onChange={(e) =>
                setGate((g) => ({
                  ...g,
                  otp: e.target.value.replace(/\D/g, "").slice(0, 8),
                  message: "",
                }))
              }
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
            <button
              disabled={!gate.otp || gate.step === "verifying"}
              onClick={verify}
            >
              {gate.step === "verifying" ? "Verifying…" : "Verify phone number"}{" "}
              <i className="ti ti-check" />
            </button>
            <button
              type="button"
              className={styles.customerBackButton}
              onClick={() =>
                setGate((g) => ({
                  ...g,
                  step: "phone",
                  otp: "",
                  pinId: "",
                  message: "",
                }))
              }
            >
              Change phone number
            </button>
          </div>
        )}
        {gate.step === "password" && (
          <div className={styles.accountForm}>
            <div className={styles.verifiedPhone}>
              <i className="ti ti-circle-check-filled" />
              <span>{gate.phone}</span>
              <b>Phone verified</b>
            </div>
            <div className={styles.passwordPair}>
              <div>
                <label className={styles.customerGateLabel}>
                  Create password
                </label>
                <input
                  autoFocus
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={gate.password}
                  onChange={(e) =>
                    setGate((g) => ({
                      ...g,
                      password: e.target.value,
                      message: "",
                    }))
                  }
                />
              </div>
              <div>
                <label className={styles.customerGateLabel}>
                  Confirm password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={gate.confirmPassword}
                  onChange={(e) =>
                    setGate((g) => ({
                      ...g,
                      confirmPassword: e.target.value,
                      message: "",
                    }))
                  }
                />
              </div>
            </div>
            <small className={styles.customerGateHint}>
              This password will be used to sign in to your Ehral account. Your
              full profile can be completed later from the dashboard.
            </small>
            <button
              disabled={
                gate.password.length < 8 ||
                gate.password !== gate.confirmPassword
              }
              onClick={continueToProfile}
            >
              Continue to profile <i className="ti ti-arrow-right" />
            </button>
          </div>
        )}
        {gate.step === "profile" && (
          <div className={styles.accountForm}>
            <div className={styles.verifiedPhone}>
              <i className="ti ti-circle-check-filled" />
              <span>{gate.phone}</span>
              <b>Verified</b>
            </div>
            <div className={styles.twoCol}>
              <div>
                <label className={styles.customerGateLabel}>First name</label>
                <input
                  autoFocus
                  required
                  placeholder="First name"
                  value={gate.firstName}
                  onChange={(e) =>
                    setGate((g) => ({
                      ...g,
                      firstName: e.target.value,
                      message: "",
                    }))
                  }
                />
              </div>
              <div>
                <label className={styles.customerGateLabel}>Last name</label>
                <input
                  placeholder="Last name"
                  value={gate.lastName}
                  onChange={(e) =>
                    setGate((g) => ({
                      ...g,
                      lastName: e.target.value,
                      message: "",
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className={styles.customerGateLabel}>
                Email address <span>(optional)</span>
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={gate.email}
                onChange={(e) =>
                  setGate((g) => ({ ...g, email: e.target.value, message: "" }))
                }
              />
            </div>
            <small className={styles.customerGateHint}>
              These are your basic registration details. You can add and edit
              your full profile from the customer dashboard after signing in.
            </small>
            <button
              disabled={!gate.firstName.trim() || gate.step === "creating"}
              onClick={createAccount}
            >
              {gate.step === "creating"
                ? "Creating account…"
                : "Create my Ehral account"}{" "}
              <i className="ti ti-arrow-right" />
            </button>
          </div>
        )}
        {gate.step === "creating" && (
          <div className={styles.gateLoading}>
            <span className={styles.gateSpinner} /> Creating your secure Ehral
            account…
          </div>
        )}
        {(gate.step === "existingLogin" || gate.step === "signingIn") && (
          <div className={styles.accountForm}>
            <div className={styles.verifiedPhone}>
              <i className="ti ti-circle-check-filled" />
              <span>{gate.phone}</span>
              <b>Phone verified</b>
            </div>
            <label className={styles.customerGateLabel}>Password</label>
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              placeholder="Your Ehral password"
              value={gate.password}
              onChange={(e) =>
                setGate((g) => ({
                  ...g,
                  password: e.target.value,
                  message: "",
                }))
              }
              onKeyDown={(e) => e.key === "Enter" && signInExisting()}
            />
            <button
              disabled={!gate.password || gate.step === "signingIn"}
              onClick={signInExisting}
            >
              {gate.step === "signingIn" ? "Signing in…" : "Sign in to Ehral"}{" "}
              <i className="ti ti-login-2" />
            </button>
            <button
              type="button"
              className={styles.customerBackButton}
              onClick={() =>
                navigate("/forgot-password", { state: { phone: gate.phone } })
              }
            >
              Forgot password?
            </button>
            <button
              type="button"
              className={styles.customerBackButton}
              onClick={() =>
                setGate((g) => ({
                  ...g,
                  step: "phone",
                  password: "",
                  message: "",
                }))
              }
            >
              Use another phone number
            </button>
          </div>
        )}
        {gate.message && (
          <small className={styles.formMessage} role="status">
            {gate.message}
          </small>
        )}
        <small className={styles.privacyNote}>
          <i className="ti ti-lock" /> Your Ehral account securely connects your
          shopping, orders, receipts and conversations across participating
          businesses.
        </small>
      </div>
    </div>
  );
}

export default function Storefront() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const pendingAction = useRef(null);
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(() => readJson(CART_KEY(slug), {}));
  const [wishlist, setWishlist] = useState(
    () => new Set(readJson(WISHLIST_KEY(slug), []).map(String)),
  );
  const [recentIds, setRecentIds] = useState(() =>
    readJson(RECENT_KEY(slug), []).map(String),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productQty, setProductQty] = useState(1);
  const [productImageIndex, setProductImageIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("featured");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    deliveryAddress: "",
    customerNote: "",
    fulfillmentMethod: "",
  });
  const [customerGate, setCustomerGate] = useState({
    open: false,
    step: "phone",
    pending: null,
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    pinId: "",
    otp: "",
    message: "",
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([getPublicStorefront(slug), getPublicProducts(slug)])
      .then(([s, p]) => {
        if (!alive) return;
        setStore(s?.data || null);
        setProducts(Array.isArray(p?.data) ? p.data : []);
      })
      .catch((e) => {
        if (alive)
          setError(e?.response?.data?.message || "Storefront not found.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => writeJson(CART_KEY(slug), cart), [cart, slug]);
  useEffect(
    () => writeJson(WISHLIST_KEY(slug), Array.from(wishlist)),
    [wishlist, slug],
  );
  useEffect(
    () => writeJson(RECENT_KEY(slug), recentIds.slice(0, 12)),
    [recentIds, slug],
  );

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        document.getElementById("store-search")?.focus();
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMobileMenu(false);
        setSelectedProduct(null);
        if (cartOpen) setCartOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen]);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(products.map(getCategory).filter(Boolean))),
    ],
    [products],
  );
  const categoryGroups = useMemo(
    () =>
      categories
        .slice(1)
        .map((name) => ({
          name,
          products: products.filter((p) => getCategory(p) === name),
        }))
        .filter((g) => g.products.length),
    [categories, products],
  );
  const availableProducts = useMemo(
    () => products.filter(isInStock),
    [products],
  );
  const deals = useMemo(
    () =>
      availableProducts
        .filter((p) => Number(p.discount || 0) > 0)
        .sort((a, b) => Number(b.discount || 0) - Number(a.discount || 0)),
    [availableProducts],
  );
  const popular = useMemo(
    () => availableProducts.slice(0, 8),
    [availableProducts],
  );
  const recentProducts = useMemo(
    () =>
      recentIds
        .map((id) => products.find((p) => String(p.id) === String(id)))
        .filter(Boolean),
    [recentIds, products],
  );
  const wishedProducts = useMemo(
    () =>
      Array.from(wishlist)
        .map((id) => products.find((p) => String(p.id) === String(id)))
        .filter(Boolean),
    [wishlist, products],
  );
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = products.filter((p) => {
      const matchesCategory = category === "All" || getCategory(p) === category;
      const haystack = [
        p.name,
        p.description,
        p.category,
        p.productCategory,
        p.sku,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesCategory && (!q || haystack.includes(q));
    });
    if (sort === "price-low")
      return [...result].sort((a, b) => effectivePrice(a) - effectivePrice(b));
    if (sort === "price-high")
      return [...result].sort((a, b) => effectivePrice(b) - effectivePrice(a));
    if (sort === "name")
      return [...result].sort((a, b) =>
        String(a.name).localeCompare(String(b.name)),
      );
    if (sort === "sale")
      return [...result].sort(
        (a, b) => Number(b.discount || 0) - Number(a.discount || 0),
      );
    return result;
  }, [products, category, search, sort]);
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 6);
    return products
      .filter((p) =>
        [p.name, p.description, getCategory(p)]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 7);
  }, [products, search]);
  const cartItems = useMemo(
    () =>
      products
        .filter((p) => Number(cart[p.id]) > 0)
        .map((p) => ({
          ...p,
          quantity: Math.min(
            stockOf(p) !== null ? Math.floor(stockOf(p)) : 1000,
            Math.max(1, Number(cart[p.id])),
          ),
          lineTotal: effectivePrice(p) * Number(cart[p.id]),
          lineTax: Number(p.tax || 0) * Number(cart[p.id]),
        })),
    [products, cart],
  );
  const subtotal = cartItems.reduce((n, x) => n + x.lineTotal, 0);
  const taxTotal = cartItems.reduce((n, x) => n + x.lineTax, 0);
  const total = subtotal + taxTotal;
  const cartCount = cartItems.reduce((n, x) => n + x.quantity, 0);
  const featured =
    availableProducts.find((p) => imagesOf(p).length) ||
    availableProducts[0] ||
    products[0];
  const currency = store?.currency || cartItems[0]?.currency || "NGN";

  useEffect(() => {
    const contextType = localStorage.getItem("contextType");
    const businessId = localStorage.getItem("businessId");
    if (
      contextType !== "CUSTOMER" ||
      !store?.businessId ||
      String(businessId) !== String(store.businessId)
    )
      return;
    getCustomerOverview()
      .then((r) => {
        const d = r?.data;
        const name = [d?.firstName, d?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        setForm((f) => ({
          ...f,
          customerName: name || f.customerName,
          customerPhone: d?.phone || f.customerPhone,
          customerEmail: d?.email || f.customerEmail,
        }));
      })
      .catch(() => {});
  }, [store?.businessId]);

  const rememberProduct = useCallback((product) => {
    if (!product?.id) return;
    setRecentIds((ids) =>
      [
        String(product.id),
        ...ids.filter((id) => String(id) !== String(product.id)),
      ].slice(0, 12),
    );
  }, []);
  const openProduct = useCallback(
    (product) => {
      rememberProduct(product);
      setSelectedProduct(product);
      setProductQty(1);
      setProductImageIndex(0);
      setSearchOpen(false);
    },
    [rememberProduct],
  );
  const add = useCallback(
    (product) =>
      setCart((c) => {
        const current = Number(c[product.id]) || 0;
        const stock = stockOf(product);
        const limit = stock !== null ? Math.floor(stock) : 1000;
        if (limit <= 0 || current >= limit) return c;
        return { ...c, [product.id]: Math.min(current + 1, limit) };
      }),
    [],
  );
  const remove = useCallback(
    (product) =>
      setCart((c) => {
        const next = { ...c };
        if ((Number(next[product.id]) || 0) <= 1) delete next[product.id];
        else next[product.id] = Number(next[product.id]) - 1;
        return next;
      }),
    [],
  );
  const toggleWishlist = useCallback(
    (product) =>
      setWishlist((current) => {
        const next = new Set(current);
        const id = String(product.id);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  const completeCustomerGate = async ({ name, phone, email, action }) => {
    try {
      await Promise.resolve(refreshSession?.());
    } catch {
      /* the account was still created; the next authenticated API call will surface any issue */
    }
    setForm((f) => ({
      ...f,
      customerName: name,
      customerPhone: phone,
      customerEmail: email || f.customerEmail,
    }));
    setCustomerGate((g) => ({
      ...g,
      open: false,
      pending: null,
      step: "done",
      message: "",
    }));
    if (action) action();
  };

  const requireCustomer = async (action) => {
    if (!store) return;
    const type = localStorage.getItem("contextType");
    const businessId = localStorage.getItem("businessId");
    if (
      type === "CUSTOMER" &&
      String(businessId) === String(store.businessId)
    ) {
      action();
      return;
    }
    try {
      if (localStorage.getItem("accessToken")) {
        const response = await getMyAccounts();
        const accounts = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.data?.accounts)
              ? response.data.accounts
              : [];
        const existing = accounts.find(
          (a) =>
            a?.type === "CUSTOMER" &&
            String(a?.businessId) === String(store.businessId),
        );
        if (existing?.membershipId) {
          await switchContext("CUSTOMER", existing.membershipId);
          await Promise.resolve(refreshSession?.());
          action();
          return;
        }
      }
    } catch (e) {
      setActionError(
        e?.response?.data?.message ||
          "We could not verify your customer account. Please continue below.",
      );
    }
    pendingAction.current = action;
    setCustomerGate((g) => ({
      ...g,
      open: true,
      pending: action,
      step: "phone",
      pinId: "",
      otp: "",
      phoneVerificationToken: "",
      password: "",
      confirmPassword: "",
      message: "",
    }));
  };

  const chat = (product) =>
    requireCustomer(async () => {
      try {
        const r = await createCustomerBusinessConversation(store.businessId);
        sessionStorage.setItem(
          `ehral:pending-chat:${r.data.id}`,
          `Hello, I am interested in ${product.name} (${money(product.currency, effectivePrice(product))}).`,
        );
        navigate(`/customer-dashboard?chat=${r.data.id}`);
      } catch (e) {
        setActionError(
          e?.response?.data?.message ||
            "Ehral messaging is temporarily unavailable.",
        );
      }
    });
  const generalChat = () =>
    requireCustomer(async () => {
      try {
        const r = await createCustomerBusinessConversation(store.businessId);
        sessionStorage.setItem(
          `ehral:pending-chat:${r.data.id}`,
          "Hello, I found your store on Ehral and would like to make an enquiry.",
        );
        navigate(`/customer-dashboard?chat=${r.data.id}`);
      } catch (e) {
        setActionError(
          e?.response?.data?.message ||
            "Ehral messaging is temporarily unavailable.",
        );
      }
    });
  const openCheckout = () => {
    if (!cartItems.length) {
      setActionError("Your shopping bag is empty.");
      return;
    }
    requireCustomer(() => {
      setCartOpen(false);
      setCheckout(true);
    });
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!cartItems.length) {
      setActionError("Your shopping bag is empty.");
      return;
    }
    if (
      !form.fulfillmentMethod &&
      (store?.pickupEnabled || store?.deliveryEnabled)
    ) {
      setActionError("Choose a fulfilment method before placing your order.");
      return;
    }
    setSubmitting(true);
    setActionError("");
    try {
      const response = await createPublicOrder(slug, {
        ...form,
        items: cartItems.map((i) => ({
          productId: i.id,
          quantity: i.quantity,
        })),
      });
      setPlaced(response.data);
      setCart({});
      setCheckout(false);
      setCartOpen(false);
    } catch (e2) {
      setActionError(
        e2?.response?.data?.message || "Could not place your order.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className={styles.center}>
        <div className={styles.loader}>
          <span />
          <span />
          <span />
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
    <div
      className={styles.page}
      style={{
        "--ehral-primary": "#0f6e56",
        "--ehral-primary-dark": "#0b1f1a",
        "--ehral-accent": "#55e0ae",
        "--ehral-mint": "#eaf6f1",
        "--ehral-line": "#b8ccc5",
      }}
    >
      <div className={styles.announcement}>
        {" "}
        <span>Shop directly from {store?.name}</span>
        <span>Powered by Ehral commerce</span>
      </div>
      <header className={styles.navbar}>
        <a
          href="#top"
          className={styles.brandMark}
          aria-label={`${store.name} home`}
        >
          <span className={styles.brandLogo}>
            {store.businessLogo ? (
              <img src={store.businessLogo} alt="" />
            ) : (
              <span className={styles.logoFallback}>
                {String(store.name || "S")
                  .charAt(0)
                  .toUpperCase()}
              </span>
            )}
          </span>
          <span>{store.name}</span>
        </a>
        <div
          className={`${styles.searchBox} ${searchOpen ? styles.searchFocused : ""}`}
        >
          <i className="ti ti-search" />
          <input
            id="store-search"
            value={search}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search products, categories..."
            aria-label="Search products"
          />
          <kbd>⌘ K</kbd>
          {searchOpen && (
            <div className={styles.searchPanel}>
              {searchResults.length ? (
                searchResults.map((p) => (
                  <button
                    key={p.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => openProduct(p)}
                  >
                    <span>
                      {imagesOf(p)[0] ? (
                        <img src={imagesOf(p)[0]} alt="" />
                      ) : (
                        <i className="ti ti-package" />
                      )}
                    </span>
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {getCategory(p)} ·{" "}
                        {money(p.currency, effectivePrice(p))}
                      </small>
                    </div>
                    <i className="ti ti-arrow-up-right" />
                  </button>
                ))
              ) : (
                <div className={styles.searchEmpty}>
                  No products match your search.
                </div>
              )}
              <button
                className={styles.searchAll}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSearchOpen(false);
                  document
                    .getElementById("products")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                View all results <i className="ti ti-arrow-right" />
              </button>
            </div>
          )}
        </div>
        <div className={styles.navActions}>
          {store.whatsappNumber && (
            <button className={styles.iconAction} onClick={generalChat}>
              <i className="ti ti-brand-whatsapp" />
              <span>Chat</span>
            </button>
          )}
          <button
            className={styles.cartAction}
            onClick={() => setCartOpen(true)}
          >
            <i className="ti ti-shopping-bag" />
            <span>Bag</span>
            {cartCount > 0 && <b>{cartCount}</b>}
          </button>
          <button
            className={styles.mobileMenuButton}
            onClick={() => setMobileMenu((v) => !v)}
            aria-label="Open menu"
          >
            <i className="ti ti-menu-2" />
          </button>
        </div>
      </header>
      {mobileMenu && (
        <nav className={styles.mobileMenu}>
          <a href="#products" onClick={() => setMobileMenu(false)}>
            Shop all
          </a>
          {categories.slice(1, 7).map((c) => (
            <button
              key={c}
              onClick={() => {
                setCategory(c);
                setMobileMenu(false);
                document
                  .getElementById("products")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {c}
            </button>
          ))}
          {store.whatsappNumber && (
            <button onClick={generalChat}>Chat with store</button>
          )}
        </nav>
      )}

      <main id="top">
        <section
          className={styles.hero}
          style={
            store.coverImage
              ? {
                  backgroundImage: `linear-gradient(100deg,rgba(9,12,20,.9) 0%,rgba(9,12,20,.7) 45%,rgba(9,12,20,.24) 100%),url(${store.coverImage})`,
                }
              : {}
          }
        >
          <div className={styles.heroOrbOne} />
          <div className={styles.heroOrbTwo} />
          <div className={styles.heroContent}>
            <div className={styles.heroEyebrow}>
              <span className={styles.liveDot} />{" "}
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
                Shop the collection <i className="ti ti-arrow-right" />
              </a>
              {store.whatsappNumber && (
                <button className={styles.secondaryCta} onClick={generalChat}>
                  <i className="ti ti-brand-whatsapp" /> Chat with us
                </button>
              )}
            </div>
            <div className={styles.heroStats}>
              <span>
                <b>{products.length}</b> products
              </span>
              <span>
                <b>{categories.length - 1}</b> categories
              </span>
              <span>
                <b>
                  {store.pickupEnabled || store.deliveryEnabled
                    ? "Flexible"
                    : "Direct"}
                </b>{" "}
                fulfilment
              </span>
            </div>
          </div>
          {featured && (
            <button
              className={styles.featuredFloat}
              onClick={() => openProduct(featured)}
            >
              <span>Featured selection</span>
              <div className={styles.featuredInner}>
                {imagesOf(featured)[0] ? (
                  <img src={imagesOf(featured)[0]} alt="" />
                ) : (
                  <div className={styles.imagePlaceholder}>
                    <i className="ti ti-package" />
                  </div>
                )}
                <div>
                  <small>{getCategory(featured)}</small>
                  <strong>{featured.name}</strong>
                  <b>{money(featured.currency, effectivePrice(featured))}</b>
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
              <small>Secure ordering through Ehral</small>
            </span>
          </div>
          <div>
            <i className="ti ti-truck-delivery" />
            <span>
              <b>Flexible fulfilment</b>
              <small>
                {store.pickupEnabled && store.deliveryEnabled
                  ? "Pickup or delivery"
                  : store.pickupEnabled
                    ? "Store pickup"
                    : store.deliveryEnabled
                      ? "Delivery available"
                      : "Contact store"}
              </small>
            </span>
          </div>
          <div>
            <i className="ti ti-message-circle" />
            <span>
              <b>Need help?</b>
              <small>
                {store.whatsappNumber
                  ? "Chat directly with the store"
                  : "Contact the store"}
              </small>
            </span>
          </div>
        </section>

        <section className={styles.discoverySection}>
          <div className={styles.discoveryIntro}>
            <span className={styles.sectionKicker}>DISCOVER</span>
            <h2>Find your next favourite.</h2>
            <p>
              Browse by collection, explore offers, or return to products you
              have viewed.
            </p>
          </div>
          <div className={styles.categoryTiles}>
            {categories.slice(1, 5).map((c, i) => (
              <button
                key={c}
                onClick={() => {
                  setCategory(c);
                  document
                    .getElementById("products")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <span>0{i + 1}</span>
                <strong>{c}</strong>
                <i className="ti ti-arrow-up-right" />
              </button>
            ))}
          </div>
        </section>

        <ProductRail
          title="Popular right now"
          kicker="CURATED PICKS"
          products={popular}
          onOpen={openProduct}
          onAdd={(p) => requireCustomer(() => add(p))}
          wishlist={wishlist}
          onWishlist={toggleWishlist}
        />
        <ProductRail
          title="Special offers"
          kicker="LIMITED OFFERS"
          products={deals}
          onOpen={openProduct}
          onAdd={(p) => requireCustomer(() => add(p))}
          wishlist={wishlist}
          onWishlist={toggleWishlist}
        />

        <section className={styles.catalog} id="products">
          <div className={styles.catalogHead}>
            <div>
              <span className={styles.sectionKicker}>THE COLLECTION</span>
              <h2>Shop all products</h2>
              <p>
                {filteredProducts.length}{" "}
                {filteredProducts.length === 1 ? "product" : "products"}{" "}
                {search || category !== "All"
                  ? "matching your selection"
                  : "in this store"}
              </p>
            </div>
            {cartCount > 0 && (
              <button
                className={styles.desktopCart}
                onClick={() => setCartOpen(true)}
              >
                <i className="ti ti-shopping-bag" /> View bag{" "}
                <span>{money(currency, total)}</span>
              </button>
            )}
          </div>
          <div className={styles.catalogToolbar}>
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
            <select
              className={styles.sortSelect}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort products"
            >
              <option value="featured">Featured</option>
              <option value="sale">Best offers</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="name">Name</option>
            </select>
          </div>
          {actionError && (
            <div className={styles.error}>
              {actionError}
              <button onClick={() => setActionError("")} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}
          {error && <div className={styles.error}>{error}</div>}
          {filteredProducts.length ? (
            category === "All" && !search.trim() ? (
              <div className={styles.categoryGroups}>
                {categoryGroups.map((group) => (
                  <section className={styles.categoryGroup} key={group.name}>
                    <div className={styles.categoryGroupHead}>
                      <div>
                        <span className={styles.categoryOverline}>
                          COLLECTION
                        </span>
                        <h3>{group.name}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCategory(group.name)}
                      >
                        {group.products.length}{" "}
                        {group.products.length === 1 ? "product" : "products"}
                        <i className="ti ti-arrow-right" />
                      </button>
                    </div>
                    <div className={styles.grid}>
                      {group.products.map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          onOpen={openProduct}
                          onAdd={(x) => requireCustomer(() => add(x))}
                          wished={wishlist.has(String(p.id))}
                          onWishlist={toggleWishlist}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className={styles.grid}>
                {filteredProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onOpen={openProduct}
                    onAdd={(x) => requireCustomer(() => add(x))}
                    wished={wishlist.has(String(p.id))}
                    onWishlist={toggleWishlist}
                  />
                ))}
              </div>
            )
          ) : (
            <div className={styles.empty}>
              <i className="ti ti-search-off" />
              <h3>No products found</h3>
              <p>Try a different search or category.</p>
              <button
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                  setSort("featured");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        <section className={styles.discoveryBand}>
          <div>
            <span className={styles.sectionKicker}>SHOP YOUR WAY</span>
            <h2>Need a little help choosing?</h2>
            <p>
              Save favourites, revisit recently viewed products, or speak
              directly with the store.
            </p>
          </div>
          <div>
            <button
              onClick={() =>
                setCategory(deals.length ? getCategory(deals[0]) : "All")
              }
              className={styles.bandButton}
            >
              Explore offers <i className="ti ti-arrow-right" />
            </button>
            {store.whatsappNumber && (
              <button
                onClick={generalChat}
                className={styles.bandButtonSecondary}
              >
                Talk to the store
              </button>
            )}
          </div>
        </section>
        <ProductRail
          title="Recently viewed"
          kicker="YOUR HISTORY"
          products={recentProducts}
          onOpen={openProduct}
          onAdd={(p) => requireCustomer(() => add(p))}
          wishlist={wishlist}
          onWishlist={toggleWishlist}
        />
        <ProductRail
          title="Your wishlist"
          kicker="SAVED FOR LATER"
          products={wishedProducts}
          onOpen={openProduct}
          onAdd={(p) => requireCustomer(() => add(p))}
          wishlist={wishlist}
          onWishlist={toggleWishlist}
        />

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
                      .join(" · ") || "Contact store"}
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
        <div className={styles.footerLinks}>
          <a href="#products">Shop</a>
          {store.whatsappNumber && (
            <button onClick={generalChat}>Contact</button>
          )}
          <span className={styles.ehralFooterBrand}>
            <small>POWERED BY</small>
            <Logo size={48} variant="horizontal" title="Ehral" tone="brand" />
          </span>
        </div>
      </footer>
      <nav className={styles.mobileBottomNav}>
        <a href="#top">
          <i className="ti ti-home-2" />
          <span>Home</span>
        </a>
        <button
          onClick={() => {
            setSearchOpen(true);
            setTimeout(
              () => document.getElementById("store-search")?.focus(),
              0,
            );
          }}
        >
          <i className="ti ti-search" />
          <span>Search</span>
        </button>
        <a href="#products">
          <i className="ti ti-layout-grid" />
          <span>Shop</span>
        </a>
        <button onClick={() => setCartOpen(true)}>
          <i className="ti ti-shopping-bag" />
          <span>Bag{cartCount ? ` (${cartCount})` : ""}</span>
        </button>
      </nav>

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
                aria-label="Close"
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
                        <span>{money(i.currency, effectivePrice(i))}</span>
                        <div className={styles.qty}>
                          <button onClick={() => remove(i)}>−</button>
                          <b>{i.quantity}</b>
                          <button onClick={() => add(i)}>+</button>
                        </div>
                      </div>
                      <b className={styles.lineTotal}>
                        {money(i.currency, i.lineTotal)}
                      </b>
                    </div>
                  ))}
                </div>
                <div className={styles.cartBottom}>
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
                  <div className={styles.totalLine}>
                    <span>Total</span>
                    <strong>{money(currency, total)}</strong>
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

      {selectedProduct &&
        (() => {
          const gallery = imagesOf(selectedProduct);
          const stock = stockOf(selectedProduct);
          const state = stockState(selectedProduct);
          const maxQty =
            stock !== null
              ? Math.max(1, Math.floor(stock))
              : isInStock(selectedProduct)
                ? 1000
                : 0;
          const meter =
            stock === 0
              ? 4
              : Math.min(
                  100,
                  Math.max(
                    10,
                    (stock /
                      Math.max(
                        stock,
                        Number(selectedProduct.lowStockThreshold || 5) * 4,
                      )) *
                      100,
                  ),
                );
          return (
            <div
              className={styles.productOverlay}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setSelectedProduct(null);
              }}
            >
              <section
                className={styles.productSheet}
                role="dialog"
                aria-modal="true"
                aria-label={selectedProduct.name}
              >
                <button
                  className={styles.productClose}
                  onClick={() => setSelectedProduct(null)}
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
                <div className={styles.productMedia}>
                  <div className={styles.mainProductImage}>
                    {gallery.length ? (
                      <img
                        src={
                          gallery[
                            Math.min(productImageIndex, gallery.length - 1)
                          ]
                        }
                        alt={selectedProduct.name}
                      />
                    ) : (
                      <div className={styles.imagePlaceholder}>
                        <i className="ti ti-package" />
                      </div>
                    )}
                    <span
                      className={`${styles.detailStockPill} ${styles[`stock${state.tone}`]}`}
                    >
                      <i />
                      {state.label}
                    </span>
                  </div>
                  {gallery.length > 1 && (
                    <div className={styles.thumbRail}>
                      {gallery.map((u, i) => (
                        <button
                          type="button"
                          key={`${u}-${i}`}
                          className={
                            i === productImageIndex ? styles.thumbActive : ""
                          }
                          onClick={() => setProductImageIndex(i)}
                        >
                          <img src={u} alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.productDetail}>
                  <div className={styles.detailEyebrow}>
                    <span>{getCategory(selectedProduct)}</span>
                    {selectedProduct.sku && (
                      <span>SKU {selectedProduct.sku}</span>
                    )}
                    <button
                      type="button"
                      className={`${styles.detailHeart} ${wishlist.has(String(selectedProduct.id)) ? styles.wished : ""}`}
                      onClick={() => toggleWishlist(selectedProduct)}
                    >
                      <i
                        className={
                          wishlist.has(String(selectedProduct.id))
                            ? "ti ti-heart-filled"
                            : "ti ti-heart"
                        }
                      />
                    </button>
                  </div>
                  <h2>{selectedProduct.name}</h2>
                  <div className={styles.detailPriceRow}>
                    <strong>
                      {money(
                        selectedProduct.currency,
                        effectivePrice(selectedProduct),
                      )}
                    </strong>
                    {Number(selectedProduct.discount || 0) > 0 && (
                      <>
                        <del>
                          {money(
                            selectedProduct.currency,
                            selectedProduct.price,
                          )}
                        </del>
                        <span>
                          Save{" "}
                          {money(
                            selectedProduct.currency,
                            selectedProduct.discount,
                          )}
                        </span>
                      </>
                    )}
                  </div>
                  <p className={styles.detailDescription}>
                    {selectedProduct.description ||
                      "A carefully selected product from this store."}
                  </p>
                  <div className={styles.stockPanel}>
                    <div className={styles.stockPanelTop}>
                      <span>Current availability</span>
                      <strong>
                        {stock > 0
                          ? `${stock} ${stock === 1 ? "unit" : "units"} in stock`
                          : "Currently out of stock"}
                      </strong>
                    </div>
                    <div className={styles.stockMeter}>
                      <span style={{ width: `${meter}%` }} />
                    </div>
                    {stock > 0 &&
                    stock <= Number(selectedProduct.lowStockThreshold || 5) ? (
                      <small>
                        Only {stock} {stock === 1 ? "unit" : "units"} remaining.
                        Order soon while available.
                      </small>
                    ) : (
                      <small>
                        {selectedProduct.trackInventory
                          ? "Live inventory count from the store."
                          : "Stock availability is supplied by the store."}
                      </small>
                    )}
                  </div>
                  <div className={styles.detailPerks}>
                    <span>
                      <i className="ti ti-shield-check" /> Secure order
                    </span>
                    {store.pickupEnabled && (
                      <span>
                        <i className="ti ti-building-store" /> Pickup available
                      </span>
                    )}
                    {store.deliveryEnabled && (
                      <span>
                        <i className="ti ti-truck-delivery" /> Delivery
                        available
                      </span>
                    )}
                  </div>
                  <div className={styles.detailPurchase}>
                    <div className={styles.quantityControl}>
                      <button
                        type="button"
                        onClick={() => setProductQty((q) => Math.max(1, q - 1))}
                        disabled={productQty <= 1}
                      >
                        −
                      </button>
                      <b>{productQty}</b>
                      <button
                        type="button"
                        onClick={() =>
                          setProductQty((q) => Math.min(maxQty, q + 1))
                        }
                        disabled={productQty >= maxQty}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className={styles.primaryPurchase}
                      disabled={!isInStock(selectedProduct) || maxQty === 0}
                      onClick={() =>
                        requireCustomer(() => {
                          for (let i = 0; i < productQty; i++)
                            add(selectedProduct);
                          setSelectedProduct(null);
                          setCartOpen(true);
                        })
                      }
                    >
                      Add {productQty > 1 ? `${productQty} items` : "to bag"}
                      <i className="ti ti-arrow-right" />
                    </button>
                  </div>
                  {store.whatsappNumber && (
                    <button
                      type="button"
                      className={styles.questionCta}
                      onClick={() => {
                        setSelectedProduct(null);
                        chat(selectedProduct);
                      }}
                    >
                      <i className="ti ti-brand-whatsapp" /> Have a question
                      about this product?
                    </button>
                  )}
                </div>
              </section>
            </div>
          );
        })()}

      <CustomerGate
        store={store}
        slug={slug}
        gate={customerGate}
        setGate={setCustomerGate}
        onComplete={completeCustomerGate}
      />

      {checkout && (
        <div className={styles.overlay}>
          <div className={styles.checkoutModal}>
            <button
              className={styles.close}
              onClick={() => setCheckout(false)}
              aria-label="Close"
            >
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
                  <b>{money(i.currency, i.lineTotal)}</b>
                </div>
              ))}
              <div className={styles.summaryTotal}>
                <span>Total</span>
                <b>{money(currency, total)}</b>
              </div>
            </div>
            <form onSubmit={submit} className={styles.checkoutForm}>
              <div className={styles.verifiedCheckoutIdentity}>
                <div>
                  <span>Customer</span>
                  <strong>
                    {form.customerName || "Verified Ehral customer"}
                  </strong>
                </div>
                <div>
                  <span>Verified phone</span>
                  <strong>{form.customerPhone}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{form.customerEmail || "Not added"}</strong>
                </div>
                <i className="ti ti-shield-check" />
              </div>
              {store.pickupEnabled || store.deliveryEnabled ? (
                <div>
                  <label>Fulfilment method</label>
                  <select
                    required
                    value={form.fulfillmentMethod}
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
              ) : (
                <div className={styles.fulfilmentNotice}>
                  <i className="ti ti-info-circle" /> The store will contact you
                  to arrange fulfilment.
                </div>
              )}
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
              {actionError && <div className={styles.error}>{actionError}</div>}
              <button
                className={styles.checkoutCta}
                disabled={submitting || !cartItems.length}
              >
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
              successfully. Your receipt will become available in My Ehral after
              the order has been fully paid, and it will be sent to your email
              when available.
            </p>
            <div className={styles.orderTotal}>
              <span>Total</span>
              <strong>{money(placed.currency, placed.total)}</strong>
            </div>
            <button
              className={styles.checkoutCta}
              onClick={() => navigate("/customer-dashboard?chat=" + "")}
            >
              Open My Ehral <i className="ti ti-layout-dashboard" />
            </button>
            {store.whatsappNumber && (
              <button
                className={styles.textCta}
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
