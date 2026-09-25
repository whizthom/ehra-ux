import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCreditsDashboard,
  initializeCreditPurchase,
  verifyCreditPurchase,
  acceptCreditAgreement,
} from "../api/creditsApi";
import { payWithPaystack } from "../api/subscriptionApi";
import styles from "./EhralCredits.module.css";

const AMOUNTS = [1000, 2500, 5000, 10000];

// Keep in sync with CURRENT_AGREEMENT_VERSION in CreditServiceImpl.java.
// When the terms change, bump both values and update the text below —
// prior acceptances are keyed by version, so businesses are asked to
// accept again rather than being silently carried over.
const CREDITS_AGREEMENT_VERSION = "1.0";
const CREDITS_AGREEMENT_EFFECTIVE_DATE = "September 25, 2026";

const money = (n) =>
  `₦${Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const label = (code = "") =>
  code
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());

// Most services bill a flat per-use amount, so the generic
// "{billing model} · ₦X credits" line covers them fine. A few need to be
// spelled out explicitly so people don't mistake a recurring charge for a
// one-off — Product Activation is a monthly fee per product, not a
// one-time unlock, so state that plainly instead of leaning on the raw
// "Per Use" billing-model label.
const SERVICE_BILLING_NOTE = {
  PRODUCT_ACTIVATION: (s) =>
    `${money(s.amount)} credits/month for each product activated`,
};

const serviceBillingText = (s) =>
  SERVICE_BILLING_NOTE[s.serviceCode]?.(s) ??
  `${label(s.billingModel)} · ${money(s.amount)} ${s.currency === "NGN" ? "credits" : s.currency}`;

// Each known Ehral service gets an icon that actually represents what it
// does, instead of reusing one generic "AI sparkle" glyph for everything.
// Anything not yet in this map (a future service) falls back to a neutral
// feature icon rather than the sparkle.
const SERVICE_ICONS = {
  PRODUCT_ACTIVATION: "ti-package",
  POS_RECEIPT: "ti-receipt-2",
  WHATSAPP_CLICK: "ti-brand-whatsapp",
};
const DEFAULT_SERVICE_ICON = "ti-apps";
const serviceIcon = (code = "") => SERVICE_ICONS[code] || DEFAULT_SERVICE_ICON;

export default function EhralCredits() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(5000);
  const [custom, setCustom] = useState("");
  const [buyOpen, setBuyOpen] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getCreditsDashboard());
      setError("");
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          "We couldn't load your Ehral Credits right now.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const amount = Number(custom || selected);
  const promo = data?.firstPurchasePromotionEligible
    ? amount * Number(data?.firstPurchasePromotionMultiplier || 0)
    : 0;
  const services = data?.services || [];

  const usageText = useMemo(() => {
    const total = Number(data?.availableCredits || 0);
    const first = services[0];
    if (!first || !Number(first.amount)) {
      return "We'll estimate your service capacity after more activity.";
    }
    return `At the current ${label(first.billingModel).toLowerCase()} price for ${label(
      first.serviceCode,
    )}, your balance represents about ${Math.floor(total / Number(first.amount)).toLocaleString()} uses of that service.`;
  }, [data, services]);

  const purchase = async () => {
    if (!data?.agreementAccepted) {
      setBuyOpen(false);
      setAgreementOpen(true);
      return;
    }
    if (!amount || amount < 1) {
      setMessage("Enter a valid amount.");
      return;
    }
    setProcessing(true);
    try {
      const init = await initializeCreditPurchase(amount);
      await payWithPaystack({
        email: init.email,
        amountNaira: Number(init.amount),
        reference: init.reference,
        publicKey: init.publicKey,
        onSuccess: async (ref) => {
          try {
            await verifyCreditPurchase(ref);
            setMessage("Your Ehral Credits have been added successfully.");
            setBuyOpen(false);
            await load();
          } catch (e) {
            setMessage(
              e?.response?.data?.message ||
                "Payment was received, but verification is still pending. Please refresh shortly.",
            );
          } finally {
            setProcessing(false);
          }
        },
        onClose: () => setProcessing(false),
      });
    } catch (e) {
      setMessage(
        e?.response?.data?.message ||
          e?.message ||
          "We couldn't start the payment.",
      );
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonHero} />
        <div className={styles.loadingLine}>Loading your Ehral Credits…</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <div>
          <p className={styles.eyebrow}>EHRAL CREDITS</p>
          <h1>{data?.businessTypeLabel || "Business"} Credits</h1>
          <p className={styles.subtitle}>
            Power your business with Ehral services.
          </p>
        </div>
        <button className={styles.buyTop} onClick={() => setBuyOpen(true)}>
          <i className="ti ti-plus" /> Add Credits
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={load}>Retry</button>
        </div>
      )}

      {message && (
        <div className={styles.notice} role="status">
          <span>{message}</span>
          <button onClick={() => setMessage("")} aria-label="Dismiss">
            <i className="ti ti-x" />
          </button>
        </div>
      )}

      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <div className={styles.heroLabel}>
            <span className={styles.liveDot} /> Available Ehral Credits
          </div>
          <div className={styles.balance}>{money(data?.availableCredits)}</div>
          <div className={styles.breakdownInline}>
            <span>{money(data?.purchasedCredits)} purchased</span>
            <span className={styles.breakdownSep} />
            <span>
              {money(data?.promotionalCredits)} promo
              {data?.promotionalExpiresAt
                ? ` · expires ${new Date(data.promotionalExpiresAt).toLocaleDateString()}`
                : ""}
            </span>
          </div>
          <button className={styles.primary} onClick={() => setBuyOpen(true)}>
            <i className="ti ti-wallet" /> Add Credits
          </button>
        </div>
      </section>

      <section className={styles.grid2}>
        <article className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <span className={styles.kicker}>CREDIT HEALTH</span>
              <h2>
                {Number(data?.availableCredits || 0) > 1000
                  ? "Healthy"
                  : Number(data?.availableCredits || 0) > 0
                    ? "Running low"
                    : "Add credits"}
              </h2>
            </div>
            <div className={styles.healthIcon}>
              <i className="ti ti-bolt" />
            </div>
          </div>
          <p>{usageText}</p>
          <div className={styles.progress}>
            <span
              style={{
                width: `${Math.min(100, Math.max(4, Number(data?.availableCredits || 0) / 100))}%`,
              }}
            />
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <span className={styles.kicker}>YOUR BUSINESS</span>
              <h2>{data?.businessTypeLabel || "Ehral Business"}</h2>
            </div>
            <div className={styles.typeIcon}>
              <i className="ti ti-building-store" />
            </div>
          </div>
          <p>
            This Credits experience is tailored to the services available to
            your business type.
          </p>
          <button
            className={styles.textButton}
            onClick={() => setAgreementOpen(true)}
          >
            View Credits terms <i className="ti ti-arrow-up-right" />
          </button>
        </article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.kicker}>YOUR EHRAL SERVICES</span>
            <h2>Services that use Credits</h2>
          </div>
          <span className={styles.sectionHint}>
            {services.length} configured
          </span>
        </div>
        <div className={styles.serviceGrid}>
          {services.map((s) => (
            <article className={styles.serviceCard} key={s.serviceCode}>
              <div className={styles.serviceIcon}>
                <i className={`ti ${serviceIcon(s.serviceCode)}`} />
              </div>
              <div className={styles.serviceMain}>
                <h3>{label(s.serviceCode)}</h3>
                <p>{serviceBillingText(s)}</p>
              </div>
              <span className={styles.serviceArrow}>
                <i className="ti ti-chevron-right" />
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="creditActivity">
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.kicker}>CREDIT ACTIVITY</span>
            <h2>Recent activity</h2>
          </div>
        </div>
        <div className={styles.activity}>
          {(data?.activity || []).length ? (
            data.activity.map((a) => (
              <div className={styles.activityRow} key={a.id}>
                <div
                  className={`${styles.activityIcon} ${Number(a.amount) >= 0 ? styles.plus : styles.minus}`}
                >
                  <i
                    className={
                      Number(a.amount) >= 0
                        ? "ti ti-arrow-down-left"
                        : "ti ti-arrow-up-right"
                    }
                  />
                </div>
                <div className={styles.activityInfo}>
                  <strong>{a.description || label(a.eventType)}</strong>
                  <span>
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                    {a.serviceCode ? ` · ${label(a.serviceCode)}` : ""}
                  </span>
                </div>
                <div
                  className={`${styles.activityAmount} ${Number(a.amount) >= 0 ? styles.positive : ""}`}
                >
                  {Number(
                    a.eventType === "SERVICE_USAGE"
                      ? -Number(a.amount)
                      : Number(a.amount),
                  ) < 0
                    ? "-"
                    : "+"}
                  {money(Math.abs(Number(a.amount || 0)))}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.empty}>
              <i className="ti ti-receipt" />
              <h3>No credit activity yet</h3>
              <p>Your purchases and Ehral service usage will appear here.</p>
            </div>
          )}
        </div>
      </section>

      {buyOpen && (
        <div
          className={styles.overlay}
          onClick={() => !processing && setBuyOpen(false)}
        >
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.close}
              disabled={processing}
              onClick={() => setBuyOpen(false)}
              aria-label="Close"
            >
              <i className="ti ti-x" />
            </button>
            <span className={styles.kicker}>ADD EHRAL CREDITS</span>
            <h2>Power your next Ehral services</h2>
            <p className={styles.sheetSub}>
              Choose how much to add. Eligible first-purchase promotions are
              shown before payment.
            </p>
            <div className={styles.amountGrid}>
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  className={
                    amount === a && !custom
                      ? styles.amountActive
                      : styles.amount
                  }
                  onClick={() => {
                    setSelected(a);
                    setCustom("");
                  }}
                >
                  {money(a)}
                  {a === 5000 && <small>Popular</small>}
                </button>
              ))}
            </div>
            <div className={styles.customWrap}>
              <span>Custom amount</span>
              <div>
                <b>₦</b>
                <input
                  inputMode="decimal"
                  value={custom}
                  onChange={(e) =>
                    setCustom(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="Enter amount"
                />
              </div>
            </div>
            <div className={styles.purchaseSummary}>
              <div>
                <span>Purchased credits</span>
                <strong>{money(amount)}</strong>
              </div>
              <div>
                <span>Promotional credits</span>
                <strong>+{money(promo)}</strong>
              </div>
              <div className={styles.total}>
                <span>Total after payment</span>
                <strong>
                  {money(Number(data?.availableCredits || 0) + amount + promo)}
                </strong>
              </div>
            </div>
            <button
              className={styles.payButton}
              disabled={processing || !amount}
              onClick={purchase}
            >
              {processing ? (
                <>
                  <i className="ti ti-loader-2" /> Processing…
                </>
              ) : (
                <>
                  Continue to secure payment <i className="ti ti-arrow-right" />
                </>
              )}
            </button>
            <p className={styles.termsMini}>
              Purchased credits do not expire and are not refundable or
              transferable. Promotional credits follow the applicable promotion
              terms.
            </p>
          </div>
        </div>
      )}

      {agreementOpen && (
        <div className={styles.overlay} onClick={() => setAgreementOpen(false)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.close}
              onClick={() => setAgreementOpen(false)}
              aria-label="Close"
            >
              <i className="ti ti-x" />
            </button>
            <span className={styles.kicker}>EHRAL CREDITS TERMS</span>
            <h2>Ehral Credits — Terms of Use</h2>
            <p className={styles.sheetSub}>
              Please read and accept these terms before purchasing or using
              Ehral Credits.
            </p>

            <div className={styles.agreementBody}>
              <h4>1. What Ehral Credits Are</h4>
              <p>
                Ehral Credits are prepaid service credits that your business
                purchases or receives, used to access eligible services within
                the Ehral platform. Ehral Credits are:
              </p>
              <ul>
                <li>
                  <strong>Not cash.</strong> They are not a bank balance, a
                  deposit, or a store of monetary value.
                </li>
                <li>
                  <strong>Not withdrawable.</strong> Ehral Credits cannot be
                  converted back into cash or paid out to you.
                </li>
                <li>
                  <strong>Not transferable.</strong> Credits cannot be sent,
                  sold, or moved between businesses — including between
                  different businesses you may operate.
                </li>
                <li>
                  <strong>Not a general payment method.</strong> Credits cannot
                  be used to pay for anything outside of eligible Ehral
                  services; they are not a wallet for arbitrary third-party
                  purchases.
                </li>
              </ul>

              <h4>2. Purchased Credits</h4>
              <ul>
                <li>
                  Credits you purchase directly (via Paystack, through Ehral's
                  payment system) never expire.
                </li>
                <li>
                  Purchased Credits are not refundable once purchased, except
                  where Ehral, at its discretion, issues a correction for a
                  payment error, duplicate charge, fraud, or chargeback.
                </li>
              </ul>

              <h4>3. Promotional Credits</h4>
              <ul>
                <li>
                  Ehral may grant you credits as part of a promotion (for
                  example, a Welcome Credit grant for new businesses, or a
                  first-purchase bonus).
                </li>
                <li>
                  Promotional Credits may expire. Where an expiration period
                  applies, it will be clearly shown to you (for example,
                  "expires in 7 days").
                </li>
                <li>
                  Promotional Credits are not refundable and are never
                  transferable.
                </li>
                <li>
                  Promotional Credits may be subject to additional terms
                  specific to that promotion (such as eligibility requirements,
                  minimum purchase amounts, or maximum bonus limits), which will
                  be disclosed at the time the promotion is offered.
                </li>
                <li>
                  Where you hold both Promotional and Purchased Credits,
                  Promotional Credits are normally used first, before Purchased
                  Credits are drawn down.
                </li>
              </ul>

              <h4>4. Eligible Use</h4>
              <ul>
                <li>
                  Ehral Credits can only be used to access eligible Ehral
                  services — the specific services available to you depend on
                  your business type, and are shown to you within your Ehral
                  Credits dashboard.
                </li>
                <li>
                  Credits cannot be used to purchase anything outside of these
                  designated services.
                </li>
              </ul>

              <h4>5. Pricing</h4>
              <ul>
                <li>
                  The price of a given Ehral service may change in the future.
                  Any such change will apply only to actions taken after the
                  change — it will not alter what you were already charged for
                  past usage.
                </li>
                <li>
                  Where a chargeable action is about to consume credits, the
                  applicable price will be shown to you before the action is
                  taken, wherever practical.
                </li>
              </ul>

              <h4>6. What Happens If Your Credits Run Out</h4>
              <ul>
                <li>
                  If your available Ehral Credits reach zero, you will not be
                  able to perform actions that require credits until you add
                  more.
                </li>
                <li>
                  This does not lock you out of your account. You will still be
                  able to log in, view your business profile, view customers,
                  view historical records and receipts, view orders, and access
                  any part of Ehral that does not require credits.
                </li>
              </ul>

              <h4>7. Chargebacks, Reversals, and Corrections</h4>
              <ul>
                <li>
                  If a credit purchase is later reversed, disputed, or found to
                  be fraudulent, Ehral may adjust your credit balance
                  accordingly, including revoking any Promotional Credits that
                  were granted as a result of that purchase.
                </li>
                <li>
                  All such adjustments will be recorded and made visible in your
                  credit activity history.
                </li>
              </ul>

              <h4>8. Acceptance</h4>
              <p>
                By proceeding to purchase or use Ehral Credits, you confirm that
                you have read and agree to these terms. Your acceptance
                (including the version of these terms and the date/time) will be
                recorded against your business account.
              </p>
            </div>

            <p className={styles.agreementFooter}>
              Version {data?.agreementVersion || CREDITS_AGREEMENT_VERSION} —{" "}
              {CREDITS_AGREEMENT_EFFECTIVE_DATE}
            </p>

            <button
              className={styles.payButton}
              onClick={async () => {
                try {
                  await acceptCreditAgreement();
                  setAgreementOpen(false);
                  await load();
                  setBuyOpen(true);
                } catch (e) {
                  setMessage(
                    e?.response?.data?.message ||
                      "We could not record your agreement.",
                  );
                }
              }}
            >
              I agree and continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
