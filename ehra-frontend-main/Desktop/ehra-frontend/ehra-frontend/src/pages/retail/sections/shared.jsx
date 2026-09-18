import { updatePaymentStatus } from "../../../api/retailApi";
import { useEffect, useState } from "react";
import s from "../../RetailWorkspace.module.css";
import {
  getSalePayments,
  getOrderPayments,
  getPurchasePayments,
} from "../../../api/retailApi";
const RETAIL_CATEGORIES = [
  "Clothing & Fashion",
  "Electronics",
  "Phones & Accessories",
  "Computers & Accessories",
  "Beauty & Personal Care",
  "Home & Living",
  "Groceries & Food",
  "Health & Wellness",
  "Baby & Kids",
  "Shoes & Bags",
  "Jewelry & Accessories",
  "Automotive",
  "Sports & Fitness",
  "Office & Stationery",
  "Books & Media",
  "Other",
];
const today = () => new Date().toISOString().slice(0, 10);
function Modal({ title, onClose, children, className = "" }) {
  return (
    <div className={s.overlay}>
      <div className={`${s.modal} ${className}`.trim()}>
        <div className={s.modalHead}>
          <div>
            <span className={s.kicker}>RETAIL WORKSPACE</span>
            <h2>{title}</h2>
          </div>
          <button className={s.iconBtn} onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, ...p }) {
  return (
    <label className={s.field}>
      <span>{label}</span>
      <input {...p} />
    </label>
  );
}
function Empty({ title, text, action }) {
  return (
    <div className={s.empty}>
      <div className={s.emptyIcon}>＋</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Metric({ label, value, trend }) {
  return (
    <div className={s.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{trend}</small>
    </div>
  );
}
function Panel({ title, sub, children, action }) {
  return (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <h3>{title}</h3>
          <p>{sub}</p>
        </div>
        {action && <div className={s.panelHeadAction}>{action}</div>}
      </div>
      {children}
    </section>
  );
}
function Toolbar({ title, sub, query, setQuery, action, showSearch = true }) {
  return (
    <div className={s.toolbar}>
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      <div className={s.toolbarRight}>
        {showSearch && (
          <input
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}{" "}
        {action}
      </div>
    </div>
  );
}
function filteredRows(arr, q, fields) {
  const needle = String(q || "")
    .toLowerCase()
    .trim();
  return !needle
    ? arr
    : arr.filter((x) =>
        fields.some((k) =>
          String(x[k] || "")
            .toLowerCase()
            .includes(needle),
        ),
      );
}
function PaymentHistory({ kind, id, money, canFinance = false }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const load = () => {
    const run =
      kind === "sale"
        ? getSalePayments(id)
        : kind === "order"
          ? getOrderPayments(id)
          : getPurchasePayments(id);
    run
      .then((r) => setItems(r.data || []))
      .catch((e) =>
        setError(
          e?.response?.data?.message || "Could not load payment history.",
        ),
      );
  };
  useEffect(() => {
    let live = true;
    const run =
      kind === "sale"
        ? getSalePayments(id)
        : kind === "order"
          ? getOrderPayments(id)
          : getPurchasePayments(id);
    run
      .then((r) => {
        if (live) setItems(r.data || []);
      })
      .catch((e) => {
        if (live)
          setError(
            e?.response?.data?.message || "Could not load payment history.",
          );
      });
    return () => {
      live = false;
    };
  }, [kind, id]);
  const voidPayment = async () => {
    if (!voidReason.trim()) return;
    try {
      await updatePaymentStatus(voidTarget.id, "VOIDED", voidReason.trim());
      setVoidTarget(null);
      setVoidReason("");
      load();
    } catch (e) {
      setError(e?.response?.data?.message || "Could not void payment.");
    }
  };
  return (
    <div className={s.tableWrap}>
      <h3>Payment history</h3>
      {error && <div className={s.error}>{error}</div>}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th>Reference</th>
            <th>Provider</th>
            <th>Transaction ID</th>
            <th>Recorded by</th>
            {canFinance && <th />}
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>
                {p.paidAt
                  ? new Date(p.paidAt).toLocaleString()
                  : p.createdAt
                    ? new Date(p.createdAt).toLocaleString()
                    : ""}
              </td>
              <td>{p.type}</td>
              <td>{money(p.amount)}</td>
              <td>{p.method}</td>
              <td>
                {p.status}
                {p.voidReason && <small>Reason: {p.voidReason}</small>}
                {p.voidedBy && <small>Voided by: {p.voidedBy}</small>}
              </td>
              <td>{p.reference || "—"}</td>
              <td>{p.provider || "—"}</td>
              <td>{p.providerTransactionId || "—"}</td>
              <td>{p.recordedBy || "—"}</td>
              {canFinance && (
                <td>
                  {p.status === "COMPLETED" && (
                    <button
                      className={s.textDanger}
                      onClick={() => {
                        setVoidTarget(p);
                        setVoidReason("");
                      }}
                    >
                      Void
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && !error && <p>No payment transactions recorded.</p>}
      {voidTarget && (
        <Modal title="Void payment" onClose={() => setVoidTarget(null)}>
          <p>
            This will mark the completed payment as voided and preserve it in
            the financial history.
          </p>
          <Field
            label="Reason for voiding"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Required reason"
          />
          <div className={s.modalFoot}>
            <button className={s.outline} onClick={() => setVoidTarget(null)}>
              Cancel
            </button>
            <button
              className={s.textDanger}
              disabled={!voidReason.trim()}
              onClick={voidPayment}
            >
              Void payment
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export {
  Modal,
  Field,
  Empty,
  Metric,
  Panel,
  Toolbar,
  filteredRows,
  PaymentHistory,
  RETAIL_CATEGORIES,
  today,
};
