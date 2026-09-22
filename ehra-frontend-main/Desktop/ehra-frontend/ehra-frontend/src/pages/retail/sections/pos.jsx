import { useEffect, useState } from "react";
import s from "../../RetailWorkspace.module.css";
import {
  addSalePayment,
  getSalePayments,
  createSaleApproval,
  getSaleApprovals,
  confirmSaleApprovalPayment,
  cancelSaleApproval,
} from "../../../api/retailApi";
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
import { GlassSelect } from "./GlassSelect";

const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash", icon: "cash" },
  { value: "POS", label: "POS / Card", icon: "card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer", icon: "bank" },
  { value: "OTHER", label: "Other", icon: "dot" },
];
import PremiumReceipt from "../../../components/PremiumReceipt";
import { subscribeToUserQueue } from "../../../services/messagingSocket";

const STATUS_LABEL = {
  PENDING_CUSTOMER_APPROVAL: "Awaiting customer",
  CUSTOMER_APPROVED: "Customer approved",
  AWAITING_BUSINESS_CONFIRMATION: "Awaiting your confirmation",
  CUSTOMER_DECLINED: "Declined",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};
const STATUS_TONE = {
  PENDING_CUSTOMER_APPROVAL: "pending",
  CUSTOMER_APPROVED: "pending",
  AWAITING_BUSINESS_CONFIRMATION: "action",
  CUSTOMER_DECLINED: "danger",
  CANCELLED: "muted",
  COMPLETED: "success",
};

function initials(name) {
  const p = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return p.length ? ((p[0][0] || "") + (p[1]?.[0] || "")).toUpperCase() : "?";
}

function approvalToReceipt(a) {
  return {
    businessName: a.businessName,
    businessLogo: a.businessLogo,
    saleNumber: a.saleNumber || a.slipNumber,
    slipNumber: a.slipNumber,
    currency: a.currency,
    customerName: a.customerName,
    items: (a.items || []).map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    subtotal: a.subtotal,
    discount: a.discount,
    tax: a.tax,
    couponCode: a.couponCode,
    couponDiscount: a.couponDiscount,
    total: a.total,
    amountPaid: a.total,
    paymentMethod: a.paymentMethodChosen,
    paymentStatus: "PAID",
    createdAt: a.confirmedAt || a.createdAt,
  };
}

function CustomerPicker({ customers, picked, onPick, onClear }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = (customers || []).filter((c) => {
    const needle = q.toLowerCase().trim();
    if (!needle) return true;
    const name = [c.firstName, c.lastName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return name.includes(needle) || String(c.phone || "").includes(needle);
  });
  if (picked) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid var(--accent,#0f6e56)",
          background:
            "color-mix(in srgb, var(--accent,#0f6e56) 8%, transparent)",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: "var(--accent,#0f6e56)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: 12,
            flex: "none",
          }}
        >
          {initials([picked.firstName, picked.lastName].join(" "))}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong
            style={{
              display: "block",
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {[picked.firstName, picked.lastName].filter(Boolean).join(" ") ||
              "Customer"}
          </strong>
          <small
            style={{
              display: "block",
              fontSize: 10,
              color: "#0f6e56",
              fontWeight: 700,
            }}
          >
            ✓ Ehral account · {picked.phone || "No phone"}
          </small>
        </div>
        <button type="button" className={s.textButton} onClick={onClear}>
          Change
        </button>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      <input
        className={s.posSearch}
        placeholder="Search your customers by name or phone…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            maxHeight: 260,
            overflow: "auto",
            background: "var(--bg-surface,#fff)",
            border: "1px solid var(--border-color,#e2e8f0)",
            borderRadius: 12,
            boxShadow: "0 20px 50px rgba(0,0,0,.14)",
          }}
        >
          {list.slice(0, 20).map((c) => (
            <button
              type="button"
              key={c.membershipId}
              onClick={() => {
                onPick(c);
                setOpen(false);
                setQ("");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 12px",
                border: 0,
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "#0f6e56",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 11,
                  flex: "none",
                }}
              >
                {initials([c.firstName, c.lastName].join(" "))}
              </div>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 12 }}>
                  {[c.firstName, c.lastName].filter(Boolean).join(" ") ||
                    "Customer"}
                </strong>
                <small
                  style={{ display: "block", fontSize: 10, color: "#8a8d91" }}
                >
                  {c.phone || "No phone"} {c.email ? `· ${c.email}` : ""}
                </small>
              </div>
            </button>
          ))}
          {!list.length && (
            <div
              style={{ padding: "16px 12px", fontSize: 11, color: "#8a8d91" }}
            >
              No matching customers. They'll need an Ehral account connected to
              this business before you can send them an approval slip —
              otherwise, just enter their details manually below.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApprovalStatusBadge({ status }) {
  const tone = STATUS_TONE[status] || "muted";
  const colors = {
    pending: { bg: "#fff4d6", fg: "#8a6d00" },
    action: { bg: "#e6f8f0", fg: "#0f6e56" },
    danger: { bg: "#fde8e6", fg: "#a33b32" },
    muted: { bg: "#eef0f2", fg: "#666" },
    success: { bg: "#e6f8f0", fg: "#0f6e56" },
  };
  const c = colors[tone];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 9px",
        borderRadius: 99,
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        background: c.bg,
        color: c.fg,
      }}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function POS({
  products,
  sales,
  customers,
  business,
  onDone,
  onRefund,
  onApprovalsChanged,
  money,
  canFinance = false,
}) {
  const [receipt, setReceipt] = useState(null);
  const [paymentSale, setPaymentSale] = useState(null);
  const [historySale, setHistorySale] = useState(null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("CASH");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentProvider, setPaymentProvider] = useState("");
  const [pickedCustomer, setPickedCustomer] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sentSlip, setSentSlip] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [approvalsBusy, setApprovalsBusy] = useState(null);
  const loadApprovals = () =>
    getSaleApprovals("OPEN")
      .then((r) => setApprovals(r.data || []))
      .catch(() => {});
  useEffect(() => {
    loadApprovals();
  }, []);
  // Live updates: the moment a customer approves/declines a slip, or a
  // confirm-payment we (or a teammate on another screen) triggered finishes,
  // this fires over the same WebSocket connection chat messages use — no
  // manual refresh needed on either side. RetailWorkspace already keeps the
  // socket connected via useMessagingConnection().
  useEffect(() => {
    return subscribeToUserQueue((event) => {
      if (!event?.type) return;
      if (event.type === "SALE_APPROVAL_DECIDED") {
        loadApprovals();
      } else if (event.type === "SALE_COMPLETED") {
        loadApprovals();
        onApprovalsChanged && onApprovalsChanged();
      }
    });
  }, []);
  const add = (p) =>
    setCart((c) => {
      const x = c.find((i) => i.productId === p.id);
      const max = p.trackInventory ? Number(p.stockQuantity || 0) : Infinity;
      if (max <= 0) return c;
      if (x)
        return c.map((i) =>
          i.productId === p.id
            ? { ...i, quantity: Math.min(i.quantity + 1, max) }
            : i,
        );
      return [
        ...c,
        {
          productId: p.id,
          name: p.name,
          price: Math.max(0, Number(p.price || 0) - Number(p.discount || 0)),
          quantity: 1,
          maxStock: max,
        },
      ];
    });
  const subtotal = cart.reduce((n, i) => n + Number(i.price) * i.quantity, 0);
  const total = Math.max(
    0,
    subtotal - Number(discount || 0) + Number(tax || 0),
  );
  const clearCheckout = () => {
    setCart([]);
    setName("");
    setPhone("");
    setDiscount("");
    setTax("");
    setAmountPaid("");
    setPaymentReference("");
    setPaymentProvider("");
    setCouponCode("");
    setPickedCustomer(null);
  };
  const sendApproval = async () => {
    setSending(true);
    setSendError("");
    try {
      const r = await createSaleApproval({
        customerMembershipId: pickedCustomer.membershipId,
        discount: Number(discount || 0),
        tax: Number(tax || 0),
        couponCode: couponCode.trim() || undefined,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      });
      setSentSlip(r.data);
      clearCheckout();
      loadApprovals();
      onApprovalsChanged && onApprovalsChanged();
    } catch (e) {
      setSendError(
        e?.response?.data?.message ||
          "Could not send the approval slip. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };
  const confirmPayment = async (id) => {
    setApprovalsBusy(id);
    try {
      const r = await confirmSaleApprovalPayment(id);
      setReceipt(approvalToReceipt(r.data));
      loadApprovals();
      onApprovalsChanged && onApprovalsChanged();
    } catch (e) {
      alert(e?.response?.data?.message || "Could not confirm this payment.");
    } finally {
      setApprovalsBusy(null);
    }
  };
  const cancelApproval = async (id) => {
    if (!confirm("Withdraw this approval slip?")) return;
    setApprovalsBusy(id);
    try {
      await cancelSaleApproval(id);
      loadApprovals();
    } catch (e) {
      alert(e?.response?.data?.message || "Could not cancel this slip.");
    } finally {
      setApprovalsBusy(null);
    }
  };

  return (
    <>
      <div className={s.posHead}>
        <div>
          <span className={s.kicker}>COUNTER SALES</span>
          <h2>New sale</h2>
          <p>
            Select products, then either complete a walk-in sale or send an
            approval slip to a customer's Ehral dashboard.
          </p>
        </div>
        <span className={s.live}>● Ready</span>
      </div>
      <div className={s.pos}>
        <section className={s.posProducts}>
          <input
            className={s.posSearch}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a product…"
          />
          <div className={s.productPicker}>
            {products
              .filter(
                (p) =>
                  p.name.toLowerCase().includes(search.toLowerCase()) ||
                  String(p.sku || "")
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((p) => (
                <button
                  key={p.id}
                  disabled={
                    p.trackInventory && Number(p.stockQuantity || 0) <= 0
                  }
                  onClick={() => add(p)}
                >
                  <span>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} />
                    ) : (
                      <b>{p.name.slice(0, 1)}</b>
                    )}
                  </span>
                  <strong>{p.name}</strong>
                  <small>
                    {money(
                      Math.max(
                        0,
                        Number(p.price || 0) - Number(p.discount || 0),
                      ),
                    )}
                    {p.trackInventory && Number(p.stockQuantity || 0) <= 0
                      ? " · Out of stock"
                      : ""}
                  </small>
                </button>
              ))}
          </div>
        </section>
        <section className={s.cart}>
          <h3>Current sale</h3>
          {cart.length ? (
            cart.map((i) => (
              <div className={s.cartRow} key={i.productId}>
                <span>
                  <b>{i.name}</b>
                  <small>{money(i.price)} each</small>
                </span>
                <div>
                  <button
                    onClick={() =>
                      setCart((c) =>
                        c.map((x) =>
                          x.productId === i.productId
                            ? { ...x, quantity: Math.max(1, x.quantity - 1) }
                            : x,
                        ),
                      )
                    }
                  >
                    −
                  </button>
                  <b>{i.quantity}</b>
                  <button
                    onClick={() =>
                      setCart((c) =>
                        c.map((x) =>
                          x.productId === i.productId
                            ? {
                                ...x,
                                quantity: Math.min(
                                  x.quantity + 1,
                                  x.maxStock ?? Infinity,
                                ),
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    ＋
                  </button>
                </div>
                <strong>{money(i.price * i.quantity)}</strong>
              </div>
            ))
          ) : (
            <Empty
              title="Your cart is empty"
              text="Choose a product to begin the sale."
            />
          )}
          <div className={s.checkout}>
            <label className={s.field} style={{ marginBottom: 4 }}>
              <span>Paying customer</span>
            </label>
            <CustomerPicker
              customers={customers}
              picked={pickedCustomer}
              onPick={(c) => {
                setPickedCustomer(c);
                setName("");
                setPhone("");
              }}
              onClear={() => setPickedCustomer(null)}
            />
            {!pickedCustomer && (
              <>
                <Field
                  label="Customer name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional · walk-in"
                />
                <Field
                  label="Customer phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Optional"
                />
              </>
            )}
            {pickedCustomer && (
              <Field
                label="Coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Optional — applied on the approval slip"
              />
            )}

            <Field
              label="Discount"
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
            <Field
              label="Tax adjustment"
              type="number"
              min="0"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
            />
            {!pickedCustomer && (
              <>
                <Field
                  label="Amount paid"
                  type="number"
                  min="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={String(total)}
                />
                <Field
                  label="Payment reference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Optional terminal/bank reference"
                />
                <Field
                  label="Payment provider"
                  value={paymentProvider}
                  onChange={(e) => setPaymentProvider(e.target.value)}
                  placeholder="Optional"
                />
                <GlassSelect
                  label="Payment method"
                  value={payment}
                  onChange={setPayment}
                  options={PAYMENT_METHOD_OPTIONS}
                />
              </>
            )}
            <div className={s.total}>
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            {sendError && <div className={s.errorBox}>{sendError}</div>}
            {pickedCustomer ? (
              <button
                disabled={!cart.length || sending}
                className={s.primaryFull}
                onClick={sendApproval}
              >
                {sending ? "Sending…" : `Send approval slip · ${money(total)}`}
              </button>
            ) : (
              <button
                disabled={!cart.length}
                className={s.primaryFull}
                onClick={async () => {
                  const r = await onDone({
                    customerName: name,
                    customerPhone: phone,
                    paymentMethod: payment,
                    paymentReference,
                    paymentProvider,
                    amountPaid: Number(amountPaid === "" ? total : amountPaid),
                    discount: Number(discount || 0),
                    tax: Number(tax || 0),
                    items: cart.map((i) => ({
                      productId: i.productId,
                      quantity: i.quantity,
                    })),
                  });
                  setReceipt(r?.data || r);
                }}
              >
                Complete sale · {money(total)}
              </button>
            )}
            {pickedCustomer && (
              <small
                style={{
                  display: "block",
                  marginTop: 8,
                  color: "#8a8d91",
                  fontSize: 10,
                  lineHeight: 1.5,
                }}
              >
                {pickedCustomer.firstName || "The customer"} will get this on
                their Ehral dashboard to review and approve before anything is
                charged.
              </small>
            )}
          </div>
        </section>
      </div>
      <Panel
        title="Approval slips"
        sub="Carts sent to customers for their review — approve, decline, or awaiting your payment confirmation."
      >
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Slip</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Sent</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id}>
                  <td>
                    <b>{a.slipNumber}</b>
                  </td>
                  <td>{a.customerName}</td>
                  <td>{money(a.total)}</td>
                  <td>
                    <ApprovalStatusBadge status={a.status} />
                  </td>
                  <td>
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                  </td>
                  <td>
                    {a.status === "AWAITING_BUSINESS_CONFIRMATION" && (
                      <button
                        className={s.textButton}
                        disabled={approvalsBusy === a.id}
                        onClick={() => confirmPayment(a.id)}
                      >
                        {approvalsBusy === a.id
                          ? "Confirming…"
                          : `Confirm ${a.paymentMethodChosen === "EHRAL_PAY" ? "Ehral Pay" : "cash"} received`}
                      </button>
                    )}
                    {a.status === "PENDING_CUSTOMER_APPROVAL" && (
                      <button
                        className={s.textDanger}
                        disabled={approvalsBusy === a.id}
                        onClick={() => cancelApproval(a.id)}
                      >
                        Withdraw
                      </button>
                    )}
                    {a.status === "COMPLETED" && (
                      <button
                        className={s.textButton}
                        onClick={() => setReceipt(approvalToReceipt(a))}
                      >
                        View receipt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!approvals.length && (
            <Empty
              title="No approval slips yet"
              text="Pick an Ehral customer at checkout to send them a slip for approval."
            />
          )}
        </div>
      </Panel>
      <Panel
        title="Recent sales"
        sub="Recorded counter sales and their current payment state."
      >
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Sale</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(sales || []).slice(0, 20).map((x) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.saleNumber}</b>
                  </td>
                  <td>{x.customerName || "Walk-in"}</td>
                  <td>{money(x.total)}</td>
                  <td>{x.paymentMethod}</td>
                  <td>
                    <span className={s.badge}>{x.status || "COMPLETED"}</span>
                  </td>
                  <td>
                    {x.createdAt ? new Date(x.createdAt).toLocaleString() : ""}
                  </td>
                  <td>
                    {x.status !== "REFUNDED" && (
                      <>
                        <button
                          className={s.textButton}
                          onClick={() => setHistorySale(x)}
                        >
                          History
                        </button>
                        <button
                          className={s.textButton}
                          onClick={() => setPaymentSale(x)}
                        >
                          Payment
                        </button>
                        <button
                          className={s.textDanger}
                          onClick={() => onRefund(x.id)}
                        >
                          Refund
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(sales || []).length && (
            <Empty
              title="No sales recorded"
              text="Completed POS transactions will appear here."
            />
          )}
        </div>
      </Panel>
      {receipt && (
        <PremiumReceipt
          receipt={{
            businessName: business?.name,
            businessLogo: business?.logo,
            businessAddress: business?.address,
            businessPhone: business?.phone,
            saleNumber: receipt.saleNumber,
            slipNumber: receipt.slipNumber,
            currency: receipt.currency || "NGN",
            customerName: receipt.customerName,
            items: (receipt.items || []).map((i) => ({
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              lineTotal: i.lineTotal,
            })),
            subtotal: receipt.subtotal,
            discount: receipt.discount,
            tax: receipt.tax,
            couponCode: receipt.couponCode,
            couponDiscount: receipt.couponDiscount,
            total: receipt.total,
            amountPaid: receipt.amountPaid,
            paymentMethod: receipt.paymentMethod,
            paymentStatus: receipt.paymentStatus,
            createdAt: receipt.createdAt,
          }}
          onClose={() => setReceipt(null)}
        />
      )}
      {sentSlip && (
        <Modal title="Approval slip sent" onClose={() => setSentSlip(null)}>
          <div style={{ padding: "6px 2px 2px" }}>
            <p style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
              {sentSlip.customerName} will see this cart on their Ehral
              dashboard — <b>{money(sentSlip.total)}</b> for{" "}
              {sentSlip.itemCount} item(s). Once they approve and choose how
              they'll pay, it'll appear above under <b>Approval slips</b> for
              you to confirm.
            </p>
            <div className={s.modalFoot}>
              <button className={s.primary} onClick={() => setSentSlip(null)}>
                Got it
              </button>
            </div>
          </div>
        </Modal>
      )}
      {historySale && (
        <Modal
          title={`Payment history ${historySale.saleNumber}`}
          onClose={() => setHistorySale(null)}
        >
          <PaymentHistory
            kind="sale"
            id={historySale.id}
            money={money}
            canFinance={canFinance}
          />
        </Modal>
      )}{" "}
      {paymentSale && (
        <PaymentModal
          title="Record sale payment"
          max={
            Number(paymentSale.total || 0) - Number(paymentSale.amountPaid || 0)
          }
          onClose={() => setPaymentSale(null)}
          onSave={async (d) => {
            await addSalePayment(paymentSale.id, d);
            setPaymentSale(null);
          }}
        />
      )}
    </>
  );
}

export { POS };
