import s from "./PremiumReceipt.module.css";

// A single receipt shape both callers normalize into:
// {
//   businessName, businessLogo, businessAddress, businessPhone,
//   saleNumber, slipNumber, currency, customerName,
//   items: [{ productName, quantity, unitPrice, lineTotal }],
//   subtotal, discount, tax, couponCode, couponDiscount, total, amountPaid,
//   paymentMethod, paymentStatus, createdAt,
// }
function money(currency, n) {
  const v = Number(n || 0);
  return `${currency || "NGN"} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "•";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export default function PremiumReceipt({ receipt, onClose, onDownload }) {
  if (!receipt) return null;
  const r = receipt;
  const date = r.createdAt ? new Date(r.createdAt) : new Date();
  const dateLabel = date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const timeLabel = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.stage} onClick={(e) => e.stopPropagation()}>
        <div className={s.receipt} id="ehral-premium-receipt">
          <div className={s.glow} />
          <div className={s.header}>
            <div className={s.brandRow}>
              <div className={s.logoWrap}>
                {r.businessLogo ? (
                  <img src={r.businessLogo} alt={r.businessName} />
                ) : (
                  <span>{initials(r.businessName)}</span>
                )}
              </div>
              <div className={s.brandText}>
                <strong>{r.businessName || "Business"}</strong>
                {(r.businessAddress || r.businessPhone) && (
                  <small>{[r.businessAddress, r.businessPhone].filter(Boolean).join(" · ")}</small>
                )}
              </div>
            </div>
            <div className={s.paidBadge}>
              <span className={s.paidDot} />
              Paid in full
            </div>
          </div>

          <div className={s.ticketDivider}>
            <span />
            <em>OFFICIAL RECEIPT</em>
            <span />
          </div>

          <div className={s.metaGrid}>
            <div>
              <small>Receipt No.</small>
              <strong>{r.saleNumber}</strong>
            </div>
            <div>
              <small>Date & time</small>
              <strong>{dateLabel} · {timeLabel}</strong>
            </div>
            <div>
              <small>Customer</small>
              <strong>{r.customerName || "Customer"}</strong>
            </div>
            <div>
              <small>Payment method</small>
              <strong>{r.paymentMethod === "EHRAL_PAY" ? "Ehral Pay" : r.paymentMethod || "Cash"}</strong>
            </div>
          </div>

          <div className={s.items}>
            <div className={s.itemsHead}>
              <span>Item</span>
              <span>Qty</span>
              <span>Amount</span>
            </div>
            {(r.items || []).map((i, idx) => (
              <div className={s.itemRow} key={idx}>
                <span className={s.itemName}>{i.productName}</span>
                <span className={s.itemQty}>× {Number(i.quantity).toLocaleString()}</span>
                <span className={s.itemAmount}>{money(r.currency, i.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className={s.totals}>
            <div>
              <span>Subtotal</span>
              <span>{money(r.currency, r.subtotal)}</span>
            </div>
            {Number(r.discount) > 0 && (
              <div className={s.rowMuted}>
                <span>Discount</span>
                <span>−{money(r.currency, r.discount)}</span>
              </div>
            )}
            {Number(r.couponDiscount) > 0 && (
              <div className={s.rowMuted}>
                <span>Coupon {r.couponCode ? `· ${r.couponCode}` : ""}</span>
                <span>−{money(r.currency, r.couponDiscount)}</span>
              </div>
            )}
            {Number(r.tax) > 0 && (
              <div className={s.rowMuted}>
                <span>Tax</span>
                <span>{money(r.currency, r.tax)}</span>
              </div>
            )}
            <div className={s.totalRow}>
              <span>Total paid</span>
              <span>{money(r.currency, r.total)}</span>
            </div>
          </div>

          <div className={s.footer}>
            <p>Thank you for shopping with {r.businessName || "us"}. This receipt was securely issued and delivered to your Ehral customer dashboard.</p>
            {(r.slipNumber) && <small>Approval reference {r.slipNumber}</small>}
          </div>

          <div className={s.stub}>
            {Array.from({ length: 26 }).map((_, i) => <i key={i} />)}
          </div>
        </div>

        <div className={s.actions}>
          <button className={s.ghost} onClick={onClose}>Close</button>
          <button className={s.solid} onClick={onDownload || (() => window.print())}>
            {onDownload ? "Save receipt" : "Print receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}

export { money as receiptMoney };
