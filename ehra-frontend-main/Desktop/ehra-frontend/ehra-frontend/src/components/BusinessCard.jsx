import { initials } from "../utils/storeHelpers";
import styles from "./BusinessCard.module.css";

// The one business card used across the customer dashboard - Discover,
// "Your businesses" and the home "Businesses you use" strip - so a business
// looks the same wherever the customer meets it.
//
//   name, logo      identity (logo falls back to initials)
//   subtitle        one line under the name, e.g. "Retail · Fashion & Apparel"
//   badge           { label, icon } - status pill on the cover, or omit
//   description     short about text (clamped to two lines)
//   stats           [{ label, value }] - a two-up strip for numbers
//   facts           [{ icon, label, accent }] - small chips (address, store...)
//   actions         [{ key, label, icon, onClick, variant, busy, disabled,
//                      ariaLabel }]  variant: "primary" | "soft" | "outline"
//   linked          true when the customer is connected (adds a green edge)
export default function BusinessCard({
  name,
  logo,
  subtitle,
  badge,
  description,
  stats,
  facts,
  actions = [],
  linked = false,
}) {
  return (
    <article className={`${styles.card} ${linked ? styles.linked : ""}`}>
      <div className={styles.cover} aria-hidden="true">
        {badge && (
          <span className={styles.badge}>
            {badge.icon && <i className={`ti ${badge.icon}`} />}
            {badge.label}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.logo}>
          {logo ? <img src={logo} alt="" /> : <span>{initials(name)}</span>}
        </div>

        <h3 className={styles.name}>{name}</h3>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

        {description && <p className={styles.about}>{description}</p>}

        {stats?.length > 0 && (
          <dl className={styles.stats}>
            {stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {facts?.length > 0 && (
          <ul className={styles.facts}>
            {facts.map((f) => (
              <li key={f.label} className={f.accent ? styles.factAccent : ""}>
                <i className={`ti ${f.icon}`} aria-hidden="true" />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              className={styles[a.variant || "soft"]}
              onClick={a.onClick}
              disabled={a.disabled || a.busy}
              aria-label={a.ariaLabel}
            >
              {a.busy ? (
                <span className={styles.spinner} aria-hidden="true" />
              ) : (
                a.icon && <i className={`ti ${a.icon}`} aria-hidden="true" />
              )}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
