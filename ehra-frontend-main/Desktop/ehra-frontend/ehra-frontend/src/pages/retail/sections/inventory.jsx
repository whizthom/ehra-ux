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
  const [view, setView] = useState("table");
  const [density, setDensity] = useState("comfortable");

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
  const activeFilters = [
    productId && "Product",
    type && "Movement",
    from && "From",
    to && "To",
  ].filter(Boolean).length;

  return (
    <section className={s.historyPage} aria-label="Inventory movement history">
      <div className={s.historyPageHead}>
        <div className={s.historyTitleBlock}>
          <button type="button" className={s.historyBack} onClick={onBack}>
            ← Inventory
          </button>
          <span className={s.kicker}>INVENTORY HISTORY</span>
          <h2>All stock movements</h2>
          <p>
            Your complete inventory activity, with 50 movements per page.
            Search, filter, and move through the record without leaving this
            workspace.
          </p>
        </div>
        <div className={s.historyHeadMeta}>
          <span>
            {loading
              ? "Updating history"
              : `${rows.length} movements on this page`}
          </span>
          {activeFilters > 0 && (
            <button type="button" className={s.historyClearTop} onClick={reset}>
              {activeFilters} filter{activeFilters === 1 ? "" : "s"} · Clear
            </button>
          )}
        </div>
      </div>

      <div className={s.historyFilterBar}>
        <div className={s.historyFilterIntro}>
          <strong>Find a movement</strong>
          <span>Refine the record by product, movement type, or date.</span>
        </div>
        <div className={s.historyFilterControls}>
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
          <button type="button" className={s.historyReset} onClick={reset}>
            Reset
          </button>
        </div>
      </div>

      {error && <div className={s.errorBox}>{error}</div>}

      <div className={s.historyRecordsHead}>
        <div>
          <span className={s.kicker}>ACTIVITY LOG</span>
          <h3>Movement history</h3>
        </div>
        <div className={s.historyViewTools}>
          <div className={s.historyViewToggle} aria-label="History view">
            <button
              type="button"
              className={view === "table" ? s.historyViewActive : ""}
              onClick={() => setView("table")}
            >
              Table
            </button>
            <button
              type="button"
              className={view === "timeline" ? s.historyViewActive : ""}
              onClick={() => setView("timeline")}
            >
              Timeline
            </button>
          </div>
          {view === "table" && (
            <div className={s.historyDensity} aria-label="Table density">
              <button
                type="button"
                className={
                  density === "comfortable" ? s.historyDensityActive : ""
                }
                onClick={() => setDensity("comfortable")}
              >
                Comfortable
              </button>
              <button
                type="button"
                className={density === "compact" ? s.historyDensityActive : ""}
                onClick={() => setDensity("compact")}
              >
                Compact
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className={`${s.historyRecords} ${density === "compact" ? s.historyCompact : ""}`}
      >
        {loading ? (
          <div className={s.historyLoading}>
            <span></span>
            <strong>Loading movement history</strong>
            <small>Fetching the latest records…</small>
          </div>
        ) : rows.length === 0 ? (
          <div className={s.historyEmpty}>
            <strong>No movements found</strong>
            <span>Try changing the filters or date range.</span>
            <button type="button" className={s.outline} onClick={reset}>
              Clear filters
            </button>
          </div>
        ) : view === "table" ? (
          <div className={s.historyTableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Date & time</th>
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
                    <td>
                      <span className={s.historyProduct}>{m.productName}</span>
                    </td>
                    <td>
                      <span className={s.historyMovementBadge}>{m.type}</span>
                    </td>
                    <td>
                      <strong className={s.historyQuantity}>
                        {m.quantity}
                      </strong>
                    </td>
                    <td className={s.historyReference}>{m.reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={s.historyTimeline}>
            {rows.map((m) => (
              <article className={s.historyTimelineItem} key={m.id}>
                <div className={s.historyTimelineRail}>
                  <span></span>
                </div>
                <div className={s.historyTimelineContent}>
                  <div className={s.historyTimelineTop}>
                    <strong>{m.productName}</strong>
                    <time>
                      {formatMovementDate(m.createdAt)} ·{" "}
                      {formatMovementTime(m.createdAt)}
                    </time>
                  </div>
                  <div className={s.historyTimelineDetails}>
                    <span className={s.historyMovementBadge}>{m.type}</span>
                    <strong>Quantity: {m.quantity}</strong>
                    {m.reference && <span>Reference: {m.reference}</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <footer className={s.historyPagination}>
        <div>
          <strong>{rows.length ? `Page ${page}` : ""}</strong>
          {rows.length && <span>Showing {rows.length} records</span>}
        </div>
        <div className={s.historyPaginationButtons}>
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
            Next 50&nbsp; →
          </button>
        </div>
      </footer>
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
          <button
            type="button"
            className={s.mobileSaveAdjustment}
            onClick={() => onAdjust(p, type, qty, note)}
          >
            Save adjustment
          </button>
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
