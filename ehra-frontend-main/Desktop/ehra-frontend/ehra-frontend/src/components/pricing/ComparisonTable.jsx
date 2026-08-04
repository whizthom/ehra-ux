import styles from "./pricing.module.css";
import { COMPARISON_ROWS, PLANS } from "../../data/pricingPlans";

function Cell({ value }) {
  if (value === true) {
    return (
      <svg
        className={styles.tableCheck}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Included"
      >
        <path
          d="M4 10.2l3.6 3.6L16 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (value === false) {
    return <span className={styles.tableDash}>—</span>;
  }
  return <span>{value}</span>;
}

export default function ComparisonTable() {
  return (
    <section className={styles.section} aria-labelledby="compare-heading">
      <h2 id="compare-heading" className={styles.sectionHeading}>
        Compare plans
      </h2>
      <p className={styles.swipeHintTable} aria-hidden="true">
        Swipe to see all columns →
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              {PLANS.map((plan) => (
                <th key={plan.id} scope="col">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {PLANS.map((plan) => (
                  <td key={plan.id}>
                    <Cell value={row.values[plan.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
