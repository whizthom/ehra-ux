import { useNavigate } from "react-router-dom";
import { BUSINESS_OPS_NOTE, SERVICE_COPY } from "../../components/credits/serviceCopy";
import styles from "./Pricing.module.css";

// Current commercial model: free core platform + prepaid Ehral Credits + negotiated Business Agreements.
// The prices below are a public explanation; the billing engine reads the authoritative rules from the backend.
const OPS = [
  "DEPARTMENT_MANAGEMENT",
  "LEAVE_MANAGEMENT",
  "EMPLOYEE_MESSAGING",
  "PROFILE_EDIT_APPROVAL",
  "PENALTY_MANAGEMENT",
  "PAYROLL_CALCULATION",
];

export default function Pricing() {
  const navigate = useNavigate();
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <h1>Simple, prepaid pricing</h1>
        <p>Ehral Core Platform has no mandatory monthly subscription. Add Ehral Credits and pay only for what you use.</p>
        <button type="button" className={styles.cta} onClick={() => navigate("/credits")}>Buy Credits</button>
      </header>

      <section className={styles.card}>
        <h2>Ehral Credits</h2>
        <p><strong>1 Credit = ₦1.</strong> Purchased Credits do not expire, cannot be withdrawn or transferred, and are used for eligible Ehral services. Promotional Credits are separate, may expire, and are used first.</p>
        <p>Minimum purchase ₦2,500. New businesses receive ₦500 in promotional Credits, and your first purchase is matched 100% up to ₦5,000.</p>
      </section>

      <section className={styles.card}>
        <h2>Attendance</h2>
        <ul className={styles.list}>
          <li><span>Clock-in</span><b>₦25 / event</b></li>
          <li><span>Clock-out</span><b>₦25 / event</b></li>
        </ul>
      </section>

      <section className={styles.card}>
        <h2>Business Operations</h2>
        <p><b>₦75 / business / day maximum</b>, shared by all of these services:</p>
        <ul className={styles.list}>
          {OPS.map((c) => (
            <li key={c}><span><i className={`ti ${SERVICE_COPY[c].icon}`} aria-hidden="true" /> {SERVICE_COPY[c].title}</span><b>Same ₦75/day</b></li>
          ))}
        </ul>
        <p className={styles.note}>{BUSINESS_OPS_NOTE}</p>
      </section>

      <section className={styles.card}>
        <h2>AI</h2>
        <ul className={styles.list}><li><span>Standard AI</span><b>₦100 / business / day</b></li></ul>
        <p className={styles.note}>Multiple standard AI interactions during the same business day are covered by the same daily charge.</p>
      </section>

      <section className={styles.card}>
        <h2>Advanced and specialized services</h2>
        <p>Priced in Credits and configured per service. You always see the price before you use it.</p>
      </section>

      <section className={styles.card}>
        <h2>Large organizations</h2>
        <p>Need more locations, employees, integrations or support? Ask about a negotiated Business Agreement with a fixed commercial price and the services you need.</p>
        <button type="button" className={styles.secondary} onClick={() => navigate("/support")}>Talk to us</button>
      </section>
    </main>
  );
}
