import { initials } from "../utils/storeHelpers";
import styles from "./BusinessCard.module.css";

// The one business card used across the customer dashboard - Discover,
// "Your businesses" and the home "Businesses you use" strip - so a business
// looks the same wherever the customer meets it.
//
// A hero-strip card: a textured brand-gradient band up top, a logo that
// floats half over its lower edge, then a calm, fully monochrome body -
// the boldness of the card lives in exactly two places (the strip and the
// primary button below), everything else is quiet enough to read in a
// long feed without competing for attention.
//
//   name, logo      identity (logo falls back to initials)
//   subtitle        one line under the name, e.g. "Retail · Fashion & Apparel"
//   badge           { label, icon } - frosted status pill on the strip, or omit
//   description     short about text (clamped to two lines)
//   stats           [{ label, value }] - a ledger line for numbers
//   facts           [{ icon, label, accent }] - plain detail lines (address, store...)
//   actions         [{ key, label, icon, onClick, variant, busy, disabled,
//                      ariaLabel }]  variant: "primary" (branded fill) | "soft"/"outline" (quiet text)
//   linked          true when the customer is connected (adds the brand glow ring)
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
      <div className={styles.strip} aria-hidden="true">
        {badge && (
          <span className={styles.badge}>
            {badge.icon && <i className={`ti ${badge.icon}`} />}
            {badge.label}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.identity}>
          <div className={styles.logo}>
            {logo ? <img src={logo} alt="" /> : <span>{initials(name)}</span>}
          </div>
          <div className={styles.identityText}>
            <h3 className={styles.name}>{name}</h3>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        </div>

        {description && <p className={styles.about}>{description}</p>}

        {stats?.length > 0 && (
          <dl className={styles.stats}>
            {stats.map((s) => (
              <div key={s.label}>
                <dd>{s.value}</dd>
                <dt>{s.label}</dt>
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
