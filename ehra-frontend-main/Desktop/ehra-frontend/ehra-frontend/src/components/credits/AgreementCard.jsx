import { useState } from "react";
import { initializeAgreementPayment, verifyAgreementPayment } from "../../api/creditsApi";
import { payWithPaystack } from "../../api/paystackInline";
import { SERVICE_COPY } from "./serviceCopy";
import { formatCredits } from "./creditsFormat";
import styles from "./agreementCard.module.css";

const STATUS_COPY = {
  AGREEMENT_ACTIVE: { tone: "ok", text: "Your Business Agreement is active. Covered services do not use Credits." },
  AGREEMENT_EXPIRED: { tone: "warn", text: "Your Business Agreement has ended. Services now use your Ehral Credits." },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" }) : "");

/**
 * Shows the Business Agreement relationship to Credits explicitly, so the two are never presented as competing
 * primary states: the agreement covers the listed services, Credits cover everything else.
 */
export default function AgreementCard({ agreement, commercialStatus, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [note, setNote] = useState("");
  if (!agreement) return null;

  const status = STATUS_COPY[commercialStatus];
  const pending = agreement.pendingPayments || [];

  const pay = async (p) => {
    setBusyId(p.id);
    setNote("");
    try {
      const init = await initializeAgreementPayment(p.id);
      await payWithPaystack({
        email: init.email,
        amountNaira: Number(init.amount),
        reference: init.reference,
        publicKey: init.publicKey,
        onSuccess: async (ref) => {
          try {
            await verifyAgreementPayment(ref);
            setNote("Payment received. Thank you.");
            onChanged?.();
          } catch (e) {
            setNote(e?.response?.data?.message || "Payment was received, but confirmation is still pending. Please refresh shortly.");
          } finally {
            setBusyId(null);
          }
        },
        onClose: () => setBusyId(null),
      });
    } catch (e) {
      setNote(e?.response?.data?.message || "We couldn't start this payment. Please try again.");
      setBusyId(null);
    }
  };

  return (
    <section className={styles.card} aria-label="Business Agreement">
      <div className={styles.head}>
        <div>
          <span className={styles.eyebrow}>Business Agreement</span>
          <h2>{agreement.agreementNumber}</h2>
        </div>
        <span className={`${styles.pill} ${styles[agreement.status?.toLowerCase()] || ""}`}>{agreement.status}</span>
      </div>

      {status && <p className={`${styles.banner} ${styles[status.tone]}`}>{status.text}</p>}

      <dl className={styles.facts}>
        <div><dt>Period</dt><dd>{fmtDate(agreement.startDate)} to {fmtDate(agreement.endDate)}</dd></div>
        {agreement.status === "ACTIVE" && agreement.daysRemaining != null && (
          <div><dt>Remaining</dt><dd>{Math.max(agreement.daysRemaining, 0)} days</dd></div>
        )}
        <div><dt>Billing</dt><dd>{String(agreement.billingFrequency || "").replace("_", "-").toLowerCase()}</dd></div>
        {agreement.supportLevel && <div><dt>Support</dt><dd>{agreement.supportLevel}</dd></div>}
        {agreement.employeeAllowance != null && <div><dt>Employees</dt><dd>{agreement.employeeAllowance.toLocaleString()}</dd></div>}
        {agreement.locationAllowance != null && <div><dt>Locations</dt><dd>{agreement.locationAllowance.toLocaleString()}</dd></div>}
      </dl>

      {agreement.includedServices?.length > 0 && (
        <div>
          <h3 className={styles.sub}>Covered by your agreement</h3>
          <ul className={styles.chips}>
            {agreement.includedServices.map((c) => (
              <li key={c}>{SERVICE_COPY[c]?.title || c}</li>
            ))}
          </ul>
          <p className={styles.hint}>Everything else is billed from your Ehral Credits as usual.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className={styles.payments}>
          <h3 className={styles.sub}>Payments due</h3>
          {pending.map((p) => (
            <div key={p.id} className={styles.paymentRow}>
              <span>
                <strong>{formatCredits(p.amount)}</strong>
                {p.note ? <small>{p.note}</small> : null}
              </span>
              <button type="button" disabled={busyId === p.id} onClick={() => pay(p)}>
                {busyId === p.id ? "Processing…" : "Pay now"}
              </button>
            </div>
          ))}
        </div>
      )}

      {note && <p role="status" className={styles.hint}>{note}</p>}
    </section>
  );
}
