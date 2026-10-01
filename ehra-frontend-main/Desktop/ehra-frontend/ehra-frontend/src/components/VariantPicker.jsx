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

  const details = groups.flatMap((group) => {
    const current = chosen(group);
    const opt =
      current &&
      group.options.find(
        (o) => o.value.trim().toLowerCase() === current.trim().toLowerCase(),
      );
    return opt ? [{ group: group.name, ...opt }] : [];
  });

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
                const groupVaries =
                  new Set(group.options.map((o) => o.price)).size > 1;
                const differs =
                  opt.price > 0 &&
                  (groupVaries ||
                    (basePrice != null &&
                      Math.abs(opt.price - basePrice) >= 0.005));
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

      {details.length > 0 && (
        <ul className={styles.details} aria-label="Selected option details">
          {details.map((d) => (
            <li className={styles.detail} key={d.group}>
              {d.image ? (
                <img
                  className={styles.detailImg}
                  src={d.image}
                  alt={`${d.group}: ${d.value}`}
                  loading="lazy"
                />
              ) : (
                <span className={styles.detailDot} aria-hidden="true" />
              )}
              <div className={styles.detailBody}>
                <strong>
                  {d.group}: {d.value}
                </strong>
                <span className={styles.detailMeta}>
                  {d.price > 0 && formatPrice && (
                    <span>{formatPrice(d.price)}</span>
                  )}
                  {d.sku && <span>SKU {d.sku}</span>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
