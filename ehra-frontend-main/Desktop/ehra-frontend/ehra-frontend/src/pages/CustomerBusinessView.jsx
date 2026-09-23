import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Logo from "../components/Logo";
import BrandSplash from "../components/BrandSplash";
import ThemeToggleMenu from "../theme/ThemeToggleMenu";
import { getCustomerBusinessView } from "../api/commerceApi";
import { createCustomerBusinessConversation } from "../api/messagingApi";
import { buildWhatsAppLink } from "../api/whatsappApi";
import useBusinessConnection from "../hooks/useBusinessConnection";
import DisconnectConfirmModal from "../components/DisconnectConfirmModal";
import {
  DAYS,
  dayIndex,
  formatTime12,
  initials,
  mapsLink,
  openStatus,
  openStatusLabel,
  parseHours,
  standfirst,
  todayProgress,
} from "../utils/storeHelpers";
import styles from "./CustomerBusinessView.module.css";

// The business PROFILE - who they are, where they are, when they're open,
// how to reach them. Deliberately information-only and store-free: the
// catalogue lives one tap away behind "Visit store" (pages/CustomerStore.jsx).
//
// Design intent: an editorial "spec sheet" on a plain background - big type,
// hairline rules and generous whitespace instead of boxed panels - with the
// Ehral brand carried by the accent colour, the type and the trust footer.
// One theme-token-driven stylesheet, so it repaints correctly in light/dark
// and reflows from a phone to a wide desktop without a separate layout.

function Section({ index, title, children, id }) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionLabel}>
        <span className={styles.sectionIndex} aria-hidden="true">
          {index}
        </span>
        <h2 id={id}>{title}</h2>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export default function CustomerBusinessView() {
  const { businessId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const {
    connect: linkBusiness,
    disconnect: unlinkBusiness,
    phaseOf,
  } = useBusinessConnection();

  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [showDock, setShowDock] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [nudgeConnect, setNudgeConnect] = useState(false);
  const ctaRef = useRef(null);
  // Disconnecting asks first, using the same confirmation dialog as
  // everywhere else the customer can disconnect from a business.
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await getCustomerBusinessView(businessId);
        if (dead) return;
        setView(r.data);
        setError("");
      } catch (e) {
        if (!dead)
          setError(
            e?.response?.data?.message || "This business could not be loaded.",
          );
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [businessId, reloadKey]);

  // "Open now" must not go stale while the page sits open.
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The floating action dock (phones) only appears once the hero's own
  // buttons have scrolled out of view, so the primary action is always
  // reachable but never duplicated on screen.
  const hasView = Boolean(view);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setShowDock(!entry.isIntersecting),
      {
        threshold: 0,
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasView]);

  const business = view?.business;
  const phase = business ? phaseOf(business.businessId) : null;
  const working = Boolean(phase);
  const storefront = view?.storefront;
  const products = view?.products;

  const details = useMemo(() => {
    if (!business) return null;
    const description = business.description || storefront?.description || "";
    const categories = new Set(
      (products || []).map((p) => p.category).filter(Boolean),
    );
    return {
      description,
      standfirst: standfirst(description),
      address: business.address || storefront?.address || "",
      phone: business.phone || storefront?.phone || "",
      whatsapp: storefront?.whatsappNumber || "",
      cover: storefront?.coverImage || "",
      hoursJson: storefront?.openingHoursJson || "",
      pickup: Boolean(storefront?.pickupEnabled),
      delivery: Boolean(storefront?.deliveryEnabled),
      productCount: products?.length || 0,
      categoryCount: categories.size,
    };
  }, [business, storefront, products]);

  const hours = useMemo(
    () => parseHours(details?.hoursJson),
    [details?.hoursJson],
  );
  const status = useMemo(
    () => openStatus(details?.hoursJson, clock),
    [details?.hoursJson, clock],
  );
  const progress = useMemo(
    () => todayProgress(details?.hoursJson, clock),
    [details?.hoursJson, clock],
  );
  const todayIdx = dayIndex(clock);

  // The back arrow always lands on the customer dashboard - never "wherever
  // the browser was before" (which could be the store, a chat, or another
  // site). If the dashboard told us which tab it was opened from, return to
  // exactly that; otherwise fall back to the tab that owns this business.
  const goBack = () => {
    const tab =
      location.state?.fromTab ||
      (business?.connected ? "businesses" : "discover");
    nav(`/customer-dashboard?tab=${tab}`, { replace: true });
  };

  // One handler for both directions, so the hero button, the phone dock and
  // any future entry point behave identically: Connect <-> Disconnect.
  const toggleConnection = async () => {
    if (!business || working) return;
    const leaving = Boolean(business.connected);
    setNotice("");
    try {
      if (leaving) await unlinkBusiness(business.businessId);
      else await linkBusiness(business.businessId, { bind: true });
      setReloadKey((k) => k + 1);
      setNotice(
        leaving
          ? `You've disconnected from ${business.businessName}.`
          : `You're now connected to ${business.businessName}.`,
      );
    } catch (e) {
      setNotice(
        e?.response?.data?.message ||
          (leaving
            ? "We couldn't disconnect you from this business."
            : "We couldn't connect you to this business."),
      );
    }
  };

  // Connecting happens right away, but disconnecting asks first - this is
  // the entry point the hero button and phone dock call. It only opens the
  // confirmation dialog for the "leaving" direction; connecting still goes
  // straight through to toggleConnection above.
  const requestToggleConnection = () => {
    if (!business || working) return;
    if (business.connected) setConfirmDisconnect(true);
    else toggleConnection();
  };

  const confirmDisconnectBusiness = async () => {
    setDisconnecting(true);
    try {
      await toggleConnection();
    } finally {
      setDisconnecting(false);
      setConfirmDisconnect(false);
    }
  };

  const message = async () => {
    if (!business) return;
    if (!business.connected) {
      setNotice("Connect with this business first, then you can message them.");
      setNudgeConnect(true);
      setTimeout(() => setNudgeConnect(false), 1600);
      return;
    }
    try {
      const r = await createCustomerBusinessConversation(business.businessId);
      nav(`/customer-dashboard?chat=${r.data.id}`);
    } catch (e) {
      setNotice(
        e?.response?.data?.message ||
          "Messaging isn't available for this business right now.",
      );
    }
  };

  const visitStore = () => nav(`/customer/business/${businessId}/store`);

  // ── States ─────────────────────────────────────────────────────────

  if (loading && !view) {
    return <BrandSplash message="Opening business…" />;
  }

  if (!business) {
    return (
      <div className={styles.page}>
        <BrandSplash busy={false}>
          <h1>Business unavailable</h1>
          <p>{error || "This business isn't available right now."}</p>
          <button
            className={styles.visit}
            onClick={() => nav("/customer-dashboard?tab=discover")}
          >
            Back to Discover{" "}
            <i className="ti ti-arrow-right" aria-hidden="true" />
          </button>
        </BrandSplash>
      </div>
    );
  }

  const storeOpen = Boolean(storefront);
  const typeLine = [
    business.businessTypeLabel || business.businessType,
    business.businessCategory,
  ]
    .filter(Boolean)
    .join(" · ");
  const fulfilment = [
    details.pickup && "Store pickup",
    details.delivery && "Delivery",
  ].filter(Boolean);
  const aboutFallback = `${business.businessName} is a${/^[aeiou]/i.test(business.businessTypeLabel || "") ? "n" : ""} ${(
    business.businessTypeLabel || "Ehral"
  ).toLowerCase()} business on Ehral. Connect to keep your orders, receipts and conversations with them in one place.`;
  const hasReach = Boolean(
    details.phone || details.whatsapp || details.address,
  );

  return (
    <div className={styles.page}>
      <header className={`${styles.top} ${scrolled ? styles.topSolid : ""}`}>
        <button
          className={styles.topBack}
          onClick={goBack}
          aria-label="Go back"
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
          <span>Back</span>
        </button>
        <div className={styles.topCenter}>
          <span
            className={`${styles.topName} ${scrolled ? styles.topNameShown : ""}`}
          >
            {business.businessName}
          </span>
        </div>
        <div className={styles.topActions}>
          <ThemeToggleMenu />
        </div>
      </header>

      {notice && (
        <div className={styles.toast} role="status">
          <i className="ti ti-sparkles" aria-hidden="true" />
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      )}

      <main className={styles.main}>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <div className={styles.stage}>
          <div
            className={`${styles.cover} ${details.cover ? "" : styles.coverPattern}`}
            aria-hidden="true"
          >
            {details.cover && <img src={details.cover} alt="" />}
          </div>

          <section
            className={`${styles.hero} ${details.cover ? "" : styles.heroNoCover}`}
          >
            <div className={styles.identity} style={{ "--i": 0 }}>
              <div className={styles.logo}>
                {business.businessLogo ? (
                  <img src={business.businessLogo} alt="" />
                ) : (
                  <span>{initials(business.businessName)}</span>
                )}
                <i
                  className={`ti ti-rosette-discount-check-filled ${styles.logoCheck}`}
                  title="Registered on Ehral"
                />
              </div>
              {typeLine && <span className={styles.eyebrow}>{typeLine}</span>}
            </div>

            <h1 className={styles.name} style={{ "--i": 1 }}>
              {business.businessName}
            </h1>

            {details.standfirst && (
              <p className={styles.standfirst} style={{ "--i": 2 }}>
                {details.standfirst}
              </p>
            )}

            <ul className={styles.facts} style={{ "--i": 3 }}>
              {status.known && (
                <li
                  className={
                    status.isOpen ? styles.factOpen : styles.factClosed
                  }
                >
                  <span className={styles.dot} aria-hidden="true" />
                  {openStatusLabel(status)}
                </li>
              )}
              {business.connected && (
                <li className={styles.factConnected}>
                  <i className="ti ti-circle-check-filled" aria-hidden="true" />{" "}
                  You're connected
                </li>
              )}
              {fulfilment.length > 0 && (
                <li>
                  <i className="ti ti-truck-delivery" aria-hidden="true" />{" "}
                  {fulfilment.join(" · ")}
                </li>
              )}
            </ul>

            <div className={styles.actions} ref={ctaRef} style={{ "--i": 4 }}>
              {storeOpen ? (
                <button className={styles.visit} onClick={visitStore}>
                  Visit store{" "}
                  <i className="ti ti-arrow-right" aria-hidden="true" />
                </button>
              ) : (
                <div className={styles.soon}>
                  <i className="ti ti-clock-hour-4" aria-hidden="true" />
                  <span>
                    <strong>Store opening soon</strong>
                    <small>
                      This business hasn't opened its online store yet.
                    </small>
                  </span>
                </div>
              )}
              <button
                className={`${styles.ghost} ${nudgeConnect ? styles.nudge : ""}`}
                onClick={requestToggleConnection}
                disabled={working}
              >
                <i
                  className={
                    business.connected ? "ti ti-user-minus" : "ti ti-user-plus"
                  }
                  aria-hidden="true"
                />
                {phase === "connecting"
                  ? "Connecting…"
                  : phase === "disconnecting"
                    ? "Disconnecting…"
                    : business.connected
                      ? "Disconnect"
                      : "Connect"}
              </button>
              <button className={styles.ghost} onClick={message}>
                <i className="ti ti-message-circle" aria-hidden="true" />{" "}
                Message
              </button>
              {details.phone && (
                <a className={styles.ghost} href={`tel:${details.phone}`}>
                  <i className="ti ti-phone" aria-hidden="true" /> Call
                </a>
              )}
            </div>
            <p className={styles.connectHint}>
              {business.connected
                ? "Disconnecting removes this business from My businesses. Your past orders and receipts stay in your Ehral account, and you can reconnect any time."
                : "Connect to order, message the team and keep your receipts in your Ehral account."}
            </p>
          </section>
        </div>

        {/* ── Editorial sections ─────────────────────────────────── */}
        <div className={styles.sections}>
          <Section index="01" title="About" id="bv-about">
            <p className={styles.about}>
              {details.description || aboutFallback}
            </p>
          </Section>

          <Section index="02" title="The details" id="bv-details">
            <dl className={styles.rows}>
              {business.businessCategory && (
                <div>
                  <dt>Category</dt>
                  <dd>{business.businessCategory}</dd>
                </div>
              )}
              <div>
                <dt>Business type</dt>
                <dd>
                  {business.businessTypeLabel ||
                    business.businessType ||
                    "Ehral business"}
                </dd>
              </div>
              {details.address && (
                <div>
                  <dt>Location</dt>
                  <dd>{details.address}</dd>
                </div>
              )}
              {details.phone && (
                <div>
                  <dt>Phone</dt>
                  <dd>{details.phone}</dd>
                </div>
              )}
              {(details.pickup || details.delivery) && (
                <div>
                  <dt>Fulfilment</dt>
                  <dd>{fulfilment.join(" · ")}</dd>
                </div>
              )}
              {storeOpen && details.productCount > 0 && (
                <div>
                  <dt>Catalogue</dt>
                  <dd>
                    {details.productCount} product
                    {details.productCount === 1 ? "" : "s"}
                    {details.categoryCount > 0 &&
                      ` across ${details.categoryCount} categor${details.categoryCount === 1 ? "y" : "ies"}`}
                  </dd>
                </div>
              )}
              <div>
                <dt>Pays in</dt>
                <dd>{business.currency || "NGN"}</dd>
              </div>
              <div>
                <dt>With you</dt>
                <dd>
                  {business.connected
                    ? "Connected customer"
                    : "Not connected yet"}
                </dd>
              </div>
            </dl>
          </Section>

          {status.known && (
            <Section index="03" title="Opening hours" id="bv-hours">
              <ul className={styles.hours}>
                {DAYS.map(([key, label], i) => {
                  const row = hours[key];
                  const open = Boolean(row?.open && row?.close);
                  const isToday = i === todayIdx;
                  return (
                    <li
                      key={key}
                      className={`${isToday ? styles.hoursToday : ""} ${open ? "" : styles.hoursClosed}`}
                    >
                      <span className={styles.hoursDay}>
                        {label}
                        {isToday && <em>Today</em>}
                      </span>
                      <span className={styles.leader} aria-hidden="true" />
                      <span className={styles.hoursTime}>
                        {open
                          ? `${formatTime12(row.open)} – ${formatTime12(row.close)}`
                          : "Closed"}
                      </span>
                      {isToday && open && progress !== null && (
                        <span className={styles.hoursBar} aria-hidden="true">
                          <i
                            style={{ width: `${Math.round(progress * 100)}%` }}
                          />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className={styles.tzNote}>Times shown in your local time.</p>
            </Section>
          )}

          {hasReach && (
            <Section
              index={status.known ? "04" : "03"}
              title="Get in touch"
              id="bv-reach"
            >
              <ul className={styles.reach}>
                {details.phone && (
                  <li>
                    <a href={`tel:${details.phone}`}>
                      <i className="ti ti-phone" aria-hidden="true" />
                      <span>
                        <small>Call</small>
                        <strong>{details.phone}</strong>
                      </span>
                      <i
                        className={`ti ti-arrow-up-right ${styles.reachArrow}`}
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                )}
                {details.whatsapp && (
                  <li>
                    <a
                      href={buildWhatsAppLink(
                        details.whatsapp,
                        `Hello ${business.businessName}, I found you on Ehral.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                      <span>
                        <small>WhatsApp</small>
                        <strong>Chat with the team</strong>
                      </span>
                      <i
                        className={`ti ti-arrow-up-right ${styles.reachArrow}`}
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                )}
                {details.address && (
                  <li>
                    <a
                      href={mapsLink(details.address)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className="ti ti-map-pin" aria-hidden="true" />
                      <span>
                        <small>Find us</small>
                        <strong>{details.address}</strong>
                      </span>
                      <i
                        className={`ti ti-arrow-up-right ${styles.reachArrow}`}
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                )}
              </ul>
            </Section>
          )}
        </div>

        {/* ── Closing call to action + trust ─────────────────────── */}
        <footer className={styles.closing}>
          {storeOpen && (
            <div className={styles.closingCta}>
              <h2>Ready to browse?</h2>
              <p>
                Step into {business.businessName}'s store without leaving Ehral.
              </p>
              <button className={styles.visit} onClick={visitStore}>
                Visit store{" "}
                <i className="ti ti-arrow-right" aria-hidden="true" />
              </button>
            </div>
          )}
          <div className={styles.trust}>
            <Logo size={56} variant="horizontal" tone="brand" title="Ehral" />
            <p>
              <i className="ti ti-shield-check" aria-hidden="true" /> Your
              orders, receipts and conversations with this business stay
              protected in your Ehral account.
            </p>
            <button
              className={styles.textLink}
              onClick={() => nav("/customer-dashboard?tab=businesses")}
            >
              Back to My businesses
            </button>
          </div>
        </footer>
      </main>

      {/* Phone action dock - appears after the hero buttons scroll away. */}
      <div
        className={`${styles.dock} ${showDock ? styles.dockShown : ""}`}
        aria-hidden={!showDock}
      >
        {storeOpen ? (
          <button
            className={styles.dockPrimary}
            onClick={visitStore}
            tabIndex={showDock ? 0 : -1}
          >
            Visit store <i className="ti ti-arrow-right" aria-hidden="true" />
          </button>
        ) : !business.connected ? (
          <button
            className={styles.dockPrimary}
            onClick={requestToggleConnection}
            disabled={working}
            tabIndex={showDock ? 0 : -1}
          >
            {working ? "Connecting…" : "Connect"}{" "}
            <i className="ti ti-user-plus" aria-hidden="true" />
          </button>
        ) : null}
        {(storeOpen || business.connected) && (
          <button
            className={styles.dockIcon}
            onClick={requestToggleConnection}
            disabled={working}
            aria-label={
              business.connected
                ? `Disconnect from ${business.businessName}`
                : `Connect to ${business.businessName}`
            }
            tabIndex={showDock ? 0 : -1}
          >
            <i
              className={
                business.connected ? "ti ti-user-minus" : "ti ti-user-plus"
              }
              aria-hidden="true"
            />
          </button>
        )}
        <button
          className={styles.dockIcon}
          onClick={message}
          aria-label="Message business"
          tabIndex={showDock ? 0 : -1}
        >
          <i className="ti ti-message-circle" aria-hidden="true" />
        </button>
      </div>

      <DisconnectConfirmModal
        open={confirmDisconnect}
        businessName={business.businessName}
        loading={disconnecting}
        onCancel={() => !disconnecting && setConfirmDisconnect(false)}
        onConfirm={confirmDisconnectBusiness}
      />
    </div>
  );
}
