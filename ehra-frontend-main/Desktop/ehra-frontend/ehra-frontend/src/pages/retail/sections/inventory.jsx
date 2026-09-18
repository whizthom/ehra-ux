import { useEffect, useMemo, useRef, useState } from "react";
import s from "../../RetailWorkspace.module.css";
import { Field, Panel, Toolbar } from "./shared";
import { getMovementHistory } from "../../../api/retailApi";

const MOVEMENT_TYPES = [
  ["", "All movements"],
  ["PURCHASE", "Purchases"],
  ["SALE", "Sales"],
  ["RETURN", "Returns"],
  ["CORRECTION", "Correction in"],
  ["CORRECTION_OUT", "Correction out"],
  ["DAMAGED", "Damaged"],
  ["LOST", "Lost"],
  ["THEFT", "Theft"],
  ["INTERNAL_USE", "Internal use"],
  ["INITIAL_STOCK", "Initial stock"],
];

function ordinal(n) {
  const v = n % 100;
  return `${n}${v >= 11 && v <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
}
function formatMovementDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.toLocaleDateString(undefined, { weekday: "long" });
  const month = d.toLocaleDateString(undefined, { month: "long" });
  return `${day}, ${ordinal(d.getDate())} of ${month} ${d.getFullYear()}`;
}
function formatMovementTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function SearchField({ value, onChange, placeholder = "Search products..." }) {
  return (
    <div className={`${s.productsSearch} ${s.inventoryStockSearch}`}>
      <span aria-hidden="true">⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}

function SelectMenu({
  label,
  value,
  onChange,
  options,
  placeholder = "Select",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((o) => String(o[0]) === String(value));
  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className={s.customSelect} ref={ref}>
      <span className={s.customSelectLabel}>{label}</span>
      <button
        type="button"
        className={`${s.customSelectButton} ${open ? s.customSelectOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.[1] || placeholder}</span>
        <span className={s.selectChevron}>⌄</span>
      </button>
      {open && (
        <div className={s.customSelectMenu} role="listbox">
          {options.map(([key, text]) => (
            <button
              type="button"
              role="option"
              aria-selected={String(key) === String(value)}
              className={`${s.customSelectOption} ${String(key) === String(value) ? s.customSelectSelected : ""}`}
              key={key}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
            >
              <span>{text}</span>
              {String(key) === String(value) && (
                <span className={s.selectCheck}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InventoryHistory({ products, onBack }) {
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageCursors, setPageCursors] = useState([null]);

  const load = async (next = null, targetPage = 1) => {
    setLoading(true);
    setError("");
    try {
      const params = { size: 50 };
      if (productId) params.productId = productId;
      if (type) params.type = type;
      if (from) params.from = from;
      if (to) params.to = to;
      if (next) params.cursor = next;
      const { data } = await getMovementHistory(params);
      setRows(data?.items || []);
      setNextCursor(data?.nextCursor || null);
      setPage(targetPage);
      if (targetPage === 1) setPageCursors([null]);
      else
        setPageCursors((prev) => {
          const stack = prev.slice(0, targetPage);
          stack[targetPage - 1] = next;
          return stack;
        });
    } catch (e) {
      setError(
        e?.response?.data?.message || "Unable to load movement history.",
      );
      setRows([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPageCursors([null]);
    load(null, 1);
  }, [productId, type, from, to]);

  const reset = () => {
    setProductId("");
    setType("");
    setFrom("");
    setTo("");
  };
  return (
    <section className={s.historyPage} aria-label="Inventory movement history">
      <div className={s.historyPageHead}>
        <div>
          <span className={s.kicker}>INVENTORY HISTORY</span>
          <h2>All stock movements</h2>
          <p>
            Browse your complete inventory record 50 movements at a time. Use
            filters or date ranges to locate older records.
          </p>
        </div>
        <button type="button" className={s.outline} onClick={onBack}>
          ← Back to inventory
        </button>
      </div>
      <Panel
        title="Find a movement"
        sub="Filter the complete inventory record without loading the entire history into the browser."
      >
        <div className={s.movementHistoryFilters}>
          <SelectMenu
            label="Product"
            value={productId}
            onChange={setProductId}
            options={[
              ["", "All products"],
              ...products.map((p) => [String(p.id), p.name]),
            ]}
          />
          <SelectMenu
            label="Movement"
            value={type}
            onChange={setType}
            options={MOVEMENT_TYPES}
          />
          <Field
            label="From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Field
            label="To"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button type="button" className={s.outline} onClick={reset}>
            Reset filters
          </button>
        </div>
      </Panel>
      {error && <div className={s.errorBox}>{error}</div>}
      <Panel
        title="Movement history"
        sub={
          loading
            ? "Loading…"
            : rows.length
              ? `Page ${page} · Showing ${rows.length} records`
              : `Page ${page} · No movements found`
        }
      >
        <div className={s.movementHistoryTableWrap}>
          {loading ? (
            <div className={s.modalLoading}>Loading movement history…</div>
          ) : rows.length === 0 ? (
            <div className={s.emptyState}>
              <strong>No movements found</strong>
              <span>Try changing the filters or date range.</span>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Movement</th>
                  <th>Quantity</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{formatMovementDate(m.createdAt)}</strong>
                      <small>{formatMovementTime(m.createdAt)}</small>
                    </td>
                    <td>{m.productName}</td>
                    <td>
                      <span className={s.badge}>{m.type}</span>
                    </td>
                    <td>{m.quantity}</td>
                    <td>{m.reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <footer className={s.movementHistoryFooter}>
          <span>
            {rows.length ? `Page ${page} · Showing ${rows.length} records` : ""}
          </span>
          <div>
            <button
              className={s.outline}
              disabled={page <= 1 || loading}
              onClick={() => load(pageCursors[page - 2] || null, page - 1)}
            >
              Previous
            </button>
            <button
              className={s.outline}
              disabled={page <= 1 || loading}
              onClick={() => load(null, 1)}
            >
              First page
            </button>
            <button
              className={s.primary}
              disabled={!nextCursor || loading}
              onClick={() => load(nextCursor, page + 1)}
            >
              Next 50
            </button>
          </div>
        </footer>
      </Panel>
    </section>
  );
}

function Inventory({ data, products, onAdjust, money, onViewHistory }) {
  const [p, setP] = useState(products[0]);
  const [qty, setQty] = useState(1);
  const [type, setType] = useState("CORRECTION");
  const [note, setNote] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockPage, setStockPage] = useState(1);
  const STOCK_PAGE_SIZE = 12;
  const filteredProducts = useMemo(
    () =>
      products.filter((x) =>
        String(x.name || "")
          .toLowerCase()
          .includes(stockSearch.trim().toLowerCase()),
      ),
    [products, stockSearch],
  );
  const stockPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / STOCK_PAGE_SIZE),
  );
  const visibleProducts = filteredProducts.slice(
    (stockPage - 1) * STOCK_PAGE_SIZE,
    stockPage * STOCK_PAGE_SIZE,
  );
  useEffect(() => {
    setStockPage(1);
  }, [stockSearch]);
  useEffect(() => {
    if (p && !products.some((x) => x.id === p.id)) setP(products[0]);
  }, [products, p]);
  return (
    <>
      <Toolbar
        title="Inventory control"
        sub="Every adjustment is recorded as a stock movement."
        showSearch={false}
        action={
          <button
            className={s.primary}
            onClick={() => onAdjust(p, type, qty, note)}
          >
            Save adjustment
          </button>
        }
      />
      <div className={s.grid2}>
        <Panel
          title="Stock levels"
          sub={`${products.length} product${products.length === 1 ? "" : "s"} · quantities update as movements are recorded`}
        >
          <SearchField value={stockSearch} onChange={setStockSearch} />
          <div className={s.stockGrid}>
            {visibleProducts.map((x) => (
              <div
                key={x.id}
                className={
                  Number(x.stockQuantity) <= Number(x.lowStockThreshold || 5)
                    ? s.stockLow
                    : ""
                }
              >
                <span>{x.name}</span>
                <strong>{x.trackInventory ? x.stockQuantity : "∞"}</strong>
                <small>
                  {x.trackInventory
                    ? Number(x.stockQuantity) <=
                      Number(x.lowStockThreshold || 5)
                      ? "Low stock"
                      : "Healthy stock"
                    : "Not tracked"}
                </small>
              </div>
            ))}
            {!visibleProducts.length && (
              <div className={s.stockEmpty}>No products match your search.</div>
            )}
          </div>
          {stockPages > 1 && (
            <div className={s.stockPagination}>
              <button
                type="button"
                className={s.pageButton}
                disabled={stockPage === 1}
                onClick={() => setStockPage((v) => v - 1)}
              >
                Previous
              </button>
              <span>
                Page <strong>{stockPage}</strong> of{" "}
                <strong>{stockPages}</strong>
              </span>
              <button
                type="button"
                className={s.pageButton}
                disabled={stockPage === stockPages}
                onClick={() => setStockPage((v) => v + 1)}
              >
                Next
              </button>
            </div>
          )}
        </Panel>
        <Panel
          title="Record movement"
          sub="Use positive quantities. Ehral calculates the resulting stock."
        >
          <div className={s.formGrid}>
            <SelectMenu
              label="Product"
              value={p?.id || ""}
              onChange={(id) =>
                setP(products.find((x) => String(x.id) === String(id)))
              }
              options={products.map((x) => [String(x.id), x.name])}
            />
            <SelectMenu
              label="Movement"
              value={type}
              onChange={setType}
              options={MOVEMENT_TYPES.slice(1)}
            />
            <Field
              label="Quantity"
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <Field
              label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason or reference"
            />
          </div>
        </Panel>
      </div>
      <Panel
        title="Recent movement history"
        sub="Latest 200 recorded movements"
        action={
          <button className={s.outline} onClick={onViewHistory}>
            View all history
          </button>
        }
      >
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Movement</th>
                <th>Quantity</th>
                <th>Reference</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.movements.map((m) => (
                <tr key={m.id}>
                  <td>{m.productName}</td>
                  <td>
                    <span className={s.badge}>{m.type}</span>
                  </td>
                  <td>{m.quantity}</td>
                  <td>{m.reference || "—"}</td>
                  <td>
                    <strong>{formatMovementDate(m.createdAt)}</strong>
                    <small>{formatMovementTime(m.createdAt)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

export { Inventory, InventoryHistory };
