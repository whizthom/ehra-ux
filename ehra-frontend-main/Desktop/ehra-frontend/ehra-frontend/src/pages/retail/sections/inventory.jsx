import { useEffect, useMemo, useState } from "react";
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

function HistoryModal({ products, onClose }) {
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cursor, setCursor] = useState(null);
  const [rows, setRows] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const load = async (next = null) => {
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
      setCursor(next);
      setPage((p) => (next ? p + 1 : 1));
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
    load(null);
  }, [productId, type, from, to]);

  const reset = () => {
    setProductId("");
    setType("");
    setFrom("");
    setTo("");
    setCursor(null);
    setPage(1);
  };
  return (
    <div
      className={s.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Inventory movement history"
    >
      <section className={`${s.modal} ${s.movementHistoryModal}`}>
        <header className={s.modalHead}>
          <div>
            <span className={s.kicker}>INVENTORY HISTORY</span>
            <h2>All stock movements</h2>
            <p>
              Browse your complete inventory record without loading the entire
              history at once.
            </p>
          </div>
          <button className={s.iconBtn} onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </header>
        <div className={s.movementHistoryFilters}>
          <label className={s.field}>
            <span>Product</span>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">All products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            <span>Movement</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {MOVEMENT_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
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
        {error && <div className={s.errorBox}>{error}</div>}
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
              disabled={!cursor || loading}
              onClick={() => load(null)}
            >
              First page
            </button>
            <button
              className={s.primary}
              disabled={!nextCursor || loading}
              onClick={() => load(nextCursor)}
            >
              Next 50
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function Inventory({ data, products, onAdjust, money }) {
  const [p, setP] = useState(products[0]);
  const [qty, setQty] = useState(1);
  const [type, setType] = useState("CORRECTION_IN");
  const [note, setNote] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <>
      <Toolbar
        title="Inventory control"
        sub="Every adjustment is recorded as a stock movement."
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
        <Panel title="Stock levels" sub="Live quantities by product">
          <div className={s.stockGrid}>
            {products.map((x) => (
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
          </div>
        </Panel>
        <Panel
          title="Record movement"
          sub="Use positive quantities. Ehral calculates the resulting stock."
        >
          <div className={s.formGrid}>
            <label className={s.field}>
              <span>Product</span>
              <select
                value={p?.id || ""}
                onChange={(e) =>
                  setP(products.find((x) => x.id === Number(e.target.value)))
                }
              >
                {products.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.field}>
              <span>Movement</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="CORRECTION">Correction in</option>
                <option value="CORRECTION_OUT">Correction out</option>
                <option value="DAMAGED">Damaged</option>
                <option value="LOST">Lost</option>
                <option value="THEFT">Theft</option>
                <option value="INTERNAL_USE">Internal use</option>
              </select>
            </label>
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
          <button className={s.outline} onClick={() => setHistoryOpen(true)}>
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
      {historyOpen && (
        <HistoryModal
          products={products}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}
export { Inventory };
