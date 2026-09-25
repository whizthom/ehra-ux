import { initials } from "../utils/storeHelpers";
import styles from "./BusinessCard.module.css";

// The one business card used across the customer dashboard - Discover,
// "Your businesses" and the home "Businesses you use" strip - so a business
// looks the same wherever the customer meets it.
//
// Laid out as a contact row (avatar beside the name, status as a small
// dot) rather than a hero card, on purpose - the rest of this app already
// borrows WhatsApp's own vocabulary for how a business is introduced, so
// this card follows the same idiom instead of a generic boxed-card kit.
//
//   name, logo      identity (logo falls back to initials)
//   subtitle        one line under the name, e.g. "Retail · Fashion & Apparel"
//   badge           { label, icon } - live-status dot next to the subtitle, or omit
//   description     short about text (clamped to two lines)
//   stats           [{ label, value }] - a ledger line for numbers
//   facts           [{ icon, label, accent }] - plain detail lines (address, store...)
//   actions         [{ key, label, icon, onClick, variant, busy, disabled,
//                      ariaLabel }]  variant: "primary" (filled) | "soft"/"outline" (quiet text)
//   linked          true when the customer is connected (adds a subtle edge)
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
      <div className={styles.ribbon} aria-hidden="true" />

      <div className={styles.body}>
        <div className={styles.identity}>
          <div className={styles.logo}>
            {logo ? <img src={logo} alt="" /> : <span>{initials(name)}</span>}
          </div>
          <div className={styles.identityText}>
            <h3 className={styles.name}>{name}</h3>
            <p className={styles.subtitleRow}>
              {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
              {badge && (
                <span className={styles.status}>
                  <i
                    className={`ti ${badge.icon || "ti-point-filled"}`}
                    aria-hidden="true"
                  />
                  {badge.label}
                </span>
              )}
            </p>
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
