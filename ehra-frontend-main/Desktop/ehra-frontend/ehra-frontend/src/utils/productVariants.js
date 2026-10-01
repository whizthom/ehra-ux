// Product variants, shared by the public storefront, the registered-customer
// store and the product page.
//
// The owner adds variants in the product editor as flat rows:
//   { name: "Size", value: "M", sku, price, quantity, image }
// A row is one option. Rows that share a `name` form one choice group
// (Size: S / M / L, Color: Red / Blue), and a customer picks one option from
// every group. The backend applies the same price rule in OrderServiceImpl -
// keep the two in step.

const clean = (v) => String(v ?? "").trim();
const same = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();

/** Variant rows for a product, tolerant of missing / malformed JSON. */
export function parseVariants(product) {
  let raw = product?.variantsJson;
  if (!raw) return [];
  try {
    if (typeof raw === "string") raw = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => ({
      name: clean(v?.name) || "Option",
      value: clean(v?.value),
      sku: clean(v?.sku),
      price: Number(v?.price) || 0,
      image: clean(v?.image),
    }))
    .filter((v) => v.value);
}

/** Choice groups: [{ name, options: [{ value, sku, price, image }] }]. */
export function groupVariants(variants) {
  const groups = [];
  variants.forEach((v) => {
    let g = groups.find((x) => same(x.name, v.name));
    if (!g) {
      g = { name: v.name, options: [] };
      groups.push(g);
    }
    if (!g.options.some((o) => same(o.value, v.value))) {
      g.options.push({
        value: v.value,
        sku: v.sku,
        price: v.price,
        image: v.image,
      });
    }
  });
  return groups;
}

export const hasVariants = (product) => parseVariants(product).length > 0;

const findOption = (groups, name, value) =>
  groups.find((g) => same(g.name, name))?.options.find((o) => same(o.value, value));

/** True when every entry of `selection` is still an option the owner offers. */
export function isSelectionValid(product, selection) {
  const groups = groupVariants(parseVariants(product));
  return Object.entries(selection || {}).every(([n, v]) =>
    Boolean(findOption(groups, n, v)),
  );
}

/** True when one option has been chosen from every group. */
export function isSelectionComplete(groups, selection) {
  return groups.every((g) =>
    Object.entries(selection || {}).some(
      ([n, v]) => same(n, g.name) && findOption(groups, n, v),
    ),
  );
}

/** Name of the first group still waiting for a choice (for button hints). */
export function firstMissingGroup(groups, selection) {
  return (
    groups.find(
      (g) =>
        !Object.entries(selection || {}).some(
          ([n, v]) => same(n, g.name) && findOption(groups, n, v),
        ),
    )?.name || ""
  );
}

/**
 * Price before any product discount. The owner's editor copies the product
 * price into every new variant, so a variant only counts as a price override
 * when it differs from the product price. No override -> product price; one or
 * more -> the highest. (Order-independent, so the server can repeat it.)
 */
export function variantBasePrice(product, selection) {
  const base = Number(product?.price || 0);
  const groups = groupVariants(parseVariants(product));
  const overrides = Object.entries(selection || {})
    .map(([n, v]) => findOption(groups, n, v)?.price || 0)
    .filter((p) => p > 0 && Math.abs(p - base) >= 0.005);
  return overrides.length ? Math.max(...overrides) : base;
}

/** Image of the most recently listed chosen option that has one, else "". */
export function variantImage(product, selection) {
  const groups = groupVariants(parseVariants(product));
  let image = "";
  Object.entries(selection || {}).forEach(([n, v]) => {
    const o = findOption(groups, n, v);
    if (o?.image) image = o.image;
  });
  return image;
}

/** Every distinct option photo, for galleries that show them as extra slides. */
export function allVariantImages(product) {
  const seen = new Set();
  parseVariants(product).forEach((v) => v.image && seen.add(v.image));
  return [...seen];
}

/** "Size: M · Color: Red" */
export function describeSelection(selection) {
  return Object.entries(selection || {})
    .filter(([, v]) => clean(v))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([n, v]) => `${n}: ${v}`)
    .join(" · ");
}

// ── Cart line keys ───────────────────────────────────────────────────
// The cart is a { key: quantity } map. A plain product keeps the key it always
// had (its id), so carts saved before variants existed still load. A product
// with chosen options gets "<id>~<Name>=<Value>|<Name>=<Value>".

export function lineKey(productId, selection) {
  const entries = Object.entries(selection || {}).filter(([, v]) => clean(v));
  if (!entries.length) return String(productId);
  entries.sort(([a], [b]) => a.localeCompare(b));
  const body = entries
    .map(([n, v]) => `${encodeURIComponent(n)}=${encodeURIComponent(v)}`)
    .join("|");
  return `${productId}~${body}`;
}

export function parseLineKey(key) {
  const s = String(key);
  const i = s.indexOf("~");
  if (i < 0) return { productId: s, selection: {} };
  const selection = {};
  s.slice(i + 1)
    .split("|")
    .forEach((part) => {
      const j = part.indexOf("=");
      if (j <= 0) return;
      try {
        selection[decodeURIComponent(part.slice(0, j))] = decodeURIComponent(
          part.slice(j + 1),
        );
      } catch {
        // malformed key from an old / hand-edited cart - ignore that option
      }
    });
  return { productId: s.slice(0, i), selection };
}

/** The `variants` array the order API expects. */
export const selectionPayload = (selection) =>
  Object.entries(selection || {})
    .filter(([, v]) => clean(v))
    .map(([name, value]) => ({ name, value }));

/**
 * Turn a { key: qty } cart into display lines. `priceOf(product, basePrice)`
 * lets each screen apply its own discount rule; `limitOf(product)` its stock
 * cap. Lines whose product or options have disappeared are dropped.
 */
export function buildCartLines(cart, products, { priceOf, limitOf }) {
  return Object.entries(cart || {}).flatMap(([key, qty]) => {
    if (!(Number(qty) > 0)) return [];
    const { productId, selection } = parseLineKey(key);
    const product = products.find((p) => String(p.id) === productId);
    if (!product || !isSelectionValid(product, selection)) return [];
    const quantity = Math.min(limitOf(product), Math.max(1, Number(qty)));
    const unitPrice = priceOf(product, variantBasePrice(product, selection));
    return [
      {
        ...product,
        lineKey: key,
        selection,
        variantLabel: describeSelection(selection),
        variantImage: variantImage(product, selection),
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
        lineTax: Number(product.tax || 0) * quantity,
      },
    ];
  });
}