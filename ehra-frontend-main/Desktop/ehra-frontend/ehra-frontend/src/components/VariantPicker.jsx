import styles from "./VariantPicker.module.css";

// Product options shown the way a professional store shows them: one block per
// option group (the editor's "name", e.g. Size / Color), and inside it a tile
// for every option (the editor's "value") with its own photo and price. SKU is
// an internal field and is never shown to customers.
//
// Theme-neutral - every colour comes from `currentColor`, so it sits correctly
// on the public storefront, the registered-customer store and in dark mode.
export default function VariantPicker({
  groups,
  selection,
  onChange,
  formatPrice,
  className = "",
}) {
  if (!groups?.length) return null;

  const same = (a, b) =>
    String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  const chosen = (group) =>
    Object.entries(selection || {}).find(([n]) => same(n, group.name))?.[1];

  return (
    <div className={`${styles.picker} ${className}`}>
      {groups.map((group) => {
        const current = chosen(group);
        // If any option in the group has a photo, the others get a neutral
        // placeholder so every tile in the row has the same shape.
        const groupHasPhotos = group.options.some((o) => o.image);
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
                const on = Boolean(current) && same(current, opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`${styles.tile} ${on ? styles.tileOn : ""}`}
                    onClick={() => onChange(group.name, on ? "" : opt.value)}
                  >
                    {opt.image ? (
                      <span className={styles.tileMedia}>
                        <img src={opt.image} alt="" loading="lazy" />
                      </span>
                    ) : (
                      groupHasPhotos && (
                        <span
                          className={`${styles.tileMedia} ${styles.tilePlaceholder}`}
                          aria-hidden="true"
                        >
                          {opt.value.trim().charAt(0).toUpperCase()}
                        </span>
                      )
                    )}
                    <span className={styles.tileValue}>{opt.value}</span>
                    {opt.price > 0 && formatPrice && (
                      <span className={styles.tilePrice}>
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
