import { useEffect, useState } from "react";
import s from "../../RetailWorkspace.module.css";
import { getOrderPayments, addOrderPayment } from "../../../api/retailApi";
import { updateOrderStatus } from "../../../api/commerceApi";
import { getOrderPaymentBreakdown, refundOrderPayment } from "../../../api/orderPaymentApi";
import {
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
} from "./shared";
import { PaymentModal } from "./modals";

// Transparent per-order breakdown for a Paystack-paid order (spec §9,
// §10): Paystack fee and Ehral fee are always shown as two distinct
// lines, never combined into a single "fees" figure. Silently renders
// nothing for orders that were never paid online (e.g. cash/manual
// orders) - this is an addition to the order detail view, not a
// replacement for the existing manual PaymentHistory ledger below it.
function OnlinePaymentBreakdown({ orderId, money, canFinance }) {
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState("");

  const load = () => {
    setLoading(true);
    getOrderPaymentBreakdown(orderId)
      .then(setBreakdown)
      .catch(() => setBreakdown(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [orderId]);

  if (loading || !breakdown) return null;

  const remaining = Number(breakdown.grossAmount || 0) - Number(breakdown.totalRefunded || 0);

  const requestRefund = async () => {
    const reason = window.prompt("Reason for this refund?");
    if (!reason) return;
    setRefunding(true);
    setRefundError("");
    try {
      await refundOrderPayment(orderId, { reason });
      load();
    } catch (e) {
      setRefundError(e?.response?.data?.message || "Could not process this refund.");
    } finally {
      setRefunding(false);
    }
  };

  return (
    <>
      <h3>Online payment breakdown</h3>
      <div className={s.tableWrap}>
        <table>
          <tbody>
            <tr><td>Order value</td><td style={{ textAlign: "right" }}>{money(breakdown.grossAmount)}</td></tr>
            <tr><td>Paystack processing fee</td><td style={{ textAlign: "right" }}>-{money(breakdown.paystackFee)}</td></tr>
            <tr><td>Ehral platform fee</td><td style={{ textAlign: "right" }}>-{money(breakdown.ehralFee)}</td></tr>
            <tr><td><strong>Business settlement</strong></td><td style={{ textAlign: "right" }}><strong>{money(breakdown.netBusinessSettlement)}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <div className={s.detailGrid}>
        <div><span>Payment status</span><b>{breakdown.status}</b></div>
        <div><span>Reference</span><b>{breakdown.reference}</b></div>
        <div><span>Paid on</span><b>{breakdown.paidAt ? new Date(breakdown.paidAt).toLocaleString() : "—"}</b></div>
        {Number(breakdown.totalRefunded || 0) > 0 && (
          <div><span>Refunded</span><b>{money(breakdown.totalRefunded)}</b></div>
        )}
      </div>
      {refundError && <div className={s.error}>{refundError}</div>}
      {canFinance && breakdown.status === "SUCCESS" && remaining > 0 && (
        <button className={s.outline} disabled={refunding} onClick={requestRefund}>
          {refunding ? "Processing…" : "Refund this payment"}
        </button>
      )}
    </>
  );
}

function Orders({ items, query, setQuery, money, canFinance = false }) {
  const [list, setList] = useState(items);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  useEffect(() => setList(items), [items]);
  const change = async (id, status) => {
    try {
      const r = await updateOrderStatus(id, status);
      setList((x) => x.map((o) => (o.id === id ? r.data : { ...o })));
    } catch (e) {
      setError(e?.response?.data?.message || "Could not update the order.");
    }
  };
  const visible = filteredRows(list, query, [
    "orderNumber",
    "customerName",
    "customerPhone",
  ]);
  return (
    <>
      <div className={s.productsToolbar}>
        <div>
          <h2>Orders</h2>
          <p>Customer orders from your public commerce channel.</p>
        </div>
        <div className={s.productsToolbarControls}>
          <div className={s.productsSearch}>
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search orders..."
              aria-label="Search orders"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
      {error && <div className={s.error}>{error}</div>}
      <Panel
        title="Order pipeline"
        sub="Move orders through the fulfilment lifecycle"
      >
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id}>
                  <td>
                    <button
                      className={s.linkButton}
                      onClick={() => setSelected(o)}
                    >
                      <b>{o.orderNumber}</b>
                    </button>
                  </td>
                  <td>
                    {o.customerName || "Guest"}
                    <small>{o.customerPhone || ""}</small>
                  </td>
                  <td>{money(o.total)}</td>
                  <td>
                    <select
                      className={s.statusSelect}
                      value={o.status}
                      onChange={(e) => change(o.id, e.target.value)}
                    >
                      {[
                        "PENDING",
                        "CONFIRMED",
                        "PROCESSING",
                        "READY_FOR_PICKUP",
                        "OUT_FOR_DELIVERY",
                        "DELIVERED",
                        "CANCELLED",
                        "REFUNDED",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </td>
                  <td>{o.paymentStatus}</td>
                  <td>{new Date(o.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      className={s.textButton}
                      onClick={() => setSelected(o)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <Empty
              title={query ? "No orders match your search" : "No orders yet"}
              text={
                query
                  ? "Try a different order number, customer name or phone number."
                  : "Orders placed through your public storefront will appear here."
              }
            />
          )}
        </div>
      </Panel>
      {selected && (
        <Modal
          title={`Order ${selected.orderNumber}`}
          onClose={() => setSelected(null)}
        >
          <div className={`${s.orderDetail} ${s.receipt}`}>
            <div className={s.detailGrid}>
              <div>
                <span>Customer</span>
                <b>{selected.customerName || "Guest"}</b>
              </div>
              <div>
                <span>Phone</span>
                <b>{selected.customerPhone || "Not provided"}</b>
              </div>
              <div>
                <span>Payment</span>
                <b>{selected.paymentStatus}</b>
                <small>
                  Paid {money(selected.amountPaid || 0)} · Outstanding{" "}
                  {money(
                    Math.max(
                      0,
                      Number(selected.total || 0) -
                        Number(selected.amountPaid || 0),
                    ),
                  )}
                </small>
              </div>
              <div>
                <span>Status</span>
                <b>{selected.status}</b>
              </div>
              <div>
                <span>Total</span>
                <b>{money(selected.total)}</b>
              </div>
              <div>
                <span>Created</span>
                <b>{new Date(selected.createdAt).toLocaleString()}</b>
              </div>
            </div>
            <h3>Items</h3>
            <div className={s.list}>
              {(selected.items || []).map((i) => (
                <div key={i.id}>
                  <span>
                    <b>{i.productName}</b>
                    <small>
                      {i.quantity} × {money(i.unitPrice)}
                    </small>
                  </span>
                  <strong>{money(i.lineTotal)}</strong>
                </div>
              ))}
            </div>
            {selected.deliveryAddress && (
              <>
                <h3>Delivery address</h3>
                <p>{selected.deliveryAddress}</p>
              </>
            )}
            {selected.customerNote && (
              <>
                <h3>Customer note</h3>
                <p>{selected.customerNote}</p>
              </>
            )}
            <OnlinePaymentBreakdown orderId={selected.id} money={money} canFinance={canFinance} />
            {selected.status !== "REFUNDED" &&
              selected.status !== "CANCELLED" && (
                <button
                  className={s.primary}
                  onClick={() => setPaymentOrder(selected)}
                >
                  Record payment
                </button>
              )}
            <PaymentHistory
              kind="order"
              id={selected.id}
              money={money}
              canFinance={canFinance}
            />
            <button className={s.outline} onClick={() => window.print()}>
              Print receipt
            </button>
            {selected.whatsappLink && (
              <a
                className={s.primaryLink}
                href={selected.whatsappLink}
                target="_blank"
                rel="noreferrer"
              >
                Send order to WhatsApp
              </a>
            )}
          </div>
        </Modal>
      )}
      {paymentOrder && (
        <PaymentModal
          title="Record order payment"
          max={
            Number(paymentOrder.total || 0) -
            Number(paymentOrder.amountPaid || 0)
          }
          onClose={() => setPaymentOrder(null)}
          onSave={async (d) => {
            await addOrderPayment(paymentOrder.id, d);
            setPaymentOrder(null);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}

export { Orders };
