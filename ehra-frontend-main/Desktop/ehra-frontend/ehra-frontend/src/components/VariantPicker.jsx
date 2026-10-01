import styles from "./VariantPicker.module.css";

// One row of option chips per variant group (Size, Color, ...). Theme-neutral:
// every colour comes from `currentColor`, so it sits correctly on the public
// storefront, the registered-customer store and in dark mode.
export default function VariantPicker({
  groups,
  selection,
  onChange,
  basePrice,
  formatPrice,
  className = "",
}) {
  if (!groups?.length) return null;

  const chosen = (group) =>
    Object.entries(selection || {}).find(
      ([n]) => n.trim().toLowerCase() === group.name.trim().toLowerCase(),
    )?.[1];

  return (
    <div className={`${styles.picker} ${className}`}>
      {groups.map((group) => {
        const current = chosen(group);
        return (
          <div className={styles.group} key={group.name}>
            <div className={styles.label}>
              <span>{group.name}</span>
              <span className={styles.chosen}>
                {current || `Select ${group.name.toLowerCase()}`}
              </span>
            </div>
            <div
              className={styles.options}
              role="radiogroup"
              aria-label={group.name}
            >
              {group.options.map((opt) => {
                const on =
                  current &&
                  current.trim().toLowerCase() ===
                    opt.value.trim().toLowerCase();
                const differs =
                  opt.price > 0 &&
                  basePrice != null &&
                  Math.abs(opt.price - basePrice) >= 0.005;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={Boolean(on)}
                    className={`${styles.option} ${on ? styles.optionOn : ""}`}
                    onClick={() => onChange(group.name, on ? "" : opt.value)}
                  >
                    {opt.image && (
                      <img
                        className={styles.thumb}
                        src={opt.image}
                        alt=""
                        loading="lazy"
                      />
                    )}
                    <span>{opt.value}</span>
                    {differs && formatPrice && (
                      <span className={styles.price}>
                        {formatPrice(opt.price)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
