import { useEffect, useMemo, useRef, useState } from "react";
import s from "../../RetailWorkspace.module.css";
import { Field, Panel, Toolbar } from "./shared";

const MOVEMENTS = [
  ["CORRECTION", "Correction in"],
  ["CORRECTION_OUT", "Correction out"],
  ["DAMAGED", "Damaged"],
  ["LOST", "Lost"],
  ["THEFT", "Theft"],
  ["INTERNAL_USE", "Internal use"],
];

function formatHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const month = date.toLocaleDateString(undefined, { month: "long" });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${weekday}, ${day}${suffix} of ${month} ${year} · ${time}`;
}

function SearchField({ value, onChange, placeholder = "Search products..." }) {
  return (
    <div className={s.inventorySearch}>
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
  const selected = options.find((o) => o[0] === value);
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
              aria-selected={key === value}
              className={`${s.customSelectOption} ${key === value ? s.customSelectSelected : ""}`}
              key={key}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
            >
              <span>{text}</span>
              {key === value && <span className={s.selectCheck}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Inventory({ data, products, onAdjust, money }) {
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
              options={MOVEMENTS}
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
                  <td>{formatHistoryDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

export { Inventory };
