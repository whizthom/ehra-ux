import { useEffect, useState } from "react";
import s from "../../RetailWorkspace.module.css";
import d from "./CustomerDetail.module.css";
import { Modal, Field, Empty, Panel } from "./shared";
import {
  getCustomerDetail,
  downloadCustomerCsv,
  downloadCustomerPdf,
  awardCustomerCoupon,
  revokeCustomerCoupon,
  redeemCustomerCouponManually,
} from "../../../api/commerceApi";

const fmtDate = (v) =>
  v
    ? new Date(v).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const fmtDateTime = (v) =>
  v
    ? new Date(v).toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const COUPON_STATUS_LABEL = {
  ACTIVE: "Active",
  REDEEMED: "Redeemed",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
};

function rewardLabel(c) {
  return c.type === "PERCENTAGE"
    ? `${Number(c.value)}% off`
    : `${c.currency} ${Number(c.value).toLocaleString(undefined, { minimumFractionDigits: 2 })} off`;
}

function CustomerDetail({
  membershipId,
  money,
  businessCurrency,
  canFinance = false,
  onBack,
}) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [awardOpen, setAwardOpen] = useState(false);
  const [award, setAward] = useState({
    type: "PERCENTAGE",
    value: "",
    minSpend: "",
    expiresAt: "",
    note: "",
  });
  const [awardError, setAwardError] = useState("");
  const [awarding, setAwarding] = useState(false);
  const [busyCouponId, setBusyCouponId] = useState(null);
  const [exporting, setExporting] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [confirmRedeem, setConfirmRedeem] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    getCustomerDetail(membershipId)
      .then((r) => setDetail(r.data))
      .catch((e) =>
        setError(
          e?.response?.data?.message ||
            "Could not load this customer's details.",
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipId]);

  const mny = (v) => money(v);

  const submitAward = async (e) => {
    e.preventDefault();
    setAwardError("");
    if (!award.value || Number(award.value) <= 0) {
      setAwardError("Enter a reward value greater than zero.");
      return;
    }
    setAwarding(true);
    try {
      await awardCustomerCoupon(membershipId, {
        type: award.type,
        value: Number(award.value),
        minSpend: award.minSpend ? Number(award.minSpend) : null,
        expiresAt: award.expiresAt || null,
        note: award.note || null,
      });
      setAwardOpen(false);
      setAward({
        type: "PERCENTAGE",
        value: "",
        minSpend: "",
        expiresAt: "",
        note: "",
      });
      load();
    } catch (e2) {
      setAwardError(
        e2?.response?.data?.message || "Could not award this coupon.",
      );
    } finally {
      setAwarding(false);
    }
  };

  const doRevoke = async () => {
    if (!confirmRevoke) return;
    setBusyCouponId(confirmRevoke.id);
    try {
      await revokeCustomerCoupon(membershipId, confirmRevoke.id);
      setConfirmRevoke(null);
      load();
    } catch (e) {
      setError(e?.response?.data?.message || "Could not revoke this coupon.");
    } finally {
      setBusyCouponId(null);
    }
  };

  const doRedeem = async () => {
    if (!confirmRedeem) return;
    setBusyCouponId(confirmRedeem.id);
    try {
      await redeemCustomerCouponManually(membershipId, confirmRedeem.id);
      setConfirmRedeem(null);
      load();
    } catch (e) {
      setError(
        e?.response?.data?.message || "Could not mark this coupon redeemed.",
      );
    } finally {
      setBusyCouponId(null);
    }
  };

  const runExport = async (kind) => {
    setExporting(kind);
    try {
      const name = detail
        ? `${detail.firstName || ""} ${detail.lastName || ""}`.trim()
        : "customer";
      if (kind === "csv") await downloadCustomerCsv(membershipId, name);
      else await downloadCustomerPdf(membershipId, name);
    } catch (e) {
      setError(e?.response?.data?.message || "Could not generate the export.");
    } finally {
      setExporting("");
    }
  };

  if (loading) {
    return (
      <div className={d.wrap}>
        <button className={s.textButton} onClick={onBack}>
          ← Back to Customers
        </button>
        <div className={d.loadingState}>Loading customer…</div>
      </div>
    );
  }
  if (error && !detail) {
    return (
      <div className={d.wrap}>
        <button className={s.textButton} onClick={onBack}>
          ← Back to Customers
        </button>
        <div className={s.error}>{error}</div>
      </div>
    );
  }
  if (!detail) return null;

  const fullName =
    `${detail.firstName || "Customer"} ${detail.lastName || ""}`.trim();
  const activeCoupons = (detail.coupons || []).filter(
    (c) => c.status === "ACTIVE",
  );
  const otherCoupons = (detail.coupons || []).filter(
    (c) => c.status !== "ACTIVE",
  );
  const maxMonth = Math.max(
    1,
    ...(detail.monthlySpend || []).map((m) => Number(m.total) || 0),
  );
  const maxProduct = Math.max(
    1,
    ...(detail.topProducts || []).map((p) => Number(p.total) || 0),
  );

  return (
    <div className={d.wrap}>
      <div className={d.topBar}>
        <button className={s.textButton} onClick={onBack}>
          ← Back to Customers
        </button>
        <div className={d.topBarActions}>
          <button
            className={s.outline}
            disabled={!!exporting}
            onClick={() => runExport("csv")}
          >
            {exporting === "csv" ? "Preparing…" : "⇩ CSV"}
          </button>
          <button
            className={s.outline}
            disabled={!!exporting}
            onClick={() => runExport("pdf")}
          >
            {exporting === "pdf" ? "Preparing…" : "⇩ PDF"}
          </button>
          <button className={s.outline} onClick={() => window.print()}>
            ⎙ Print
          </button>
          <button className={s.primary} onClick={() => setAwardOpen(true)}>
            🎁 Award coupon
          </button>
        </div>
      </div>

      {error && <div className={s.error}>{error}</div>}

      <div className={d.printRoot}>
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className={d.hero}>
          <div className={d.heroAvatar}>
            {detail.profileImage ? (
              <img src={detail.profileImage} alt={fullName} />
            ) : (
              (detail.firstName || "?").slice(0, 1).toUpperCase()
            )}
          </div>
          <div className={d.heroInfo}>
            <h2>{fullName || "Customer"}</h2>
            <div className={d.heroMeta}>
              <span>{detail.phone || "No phone"}</span>
              <span>{detail.email || "No email"}</span>
              <span>Customer since {fmtDate(detail.customerSince)}</span>
            </div>
          </div>
          {activeCoupons.length > 0 && (
            <div className={d.heroCoupons}>
              {activeCoupons.slice(0, 2).map((c) => (
                <span key={c.id} className={d.heroCouponPill}>
                  {c.code} · {rewardLabel(c)}
                </span>
              ))}
              {activeCoupons.length > 2 && (
                <span className={d.heroCouponPill}>
                  +{activeCoupons.length - 2} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Stat cards ───────────────────────────────────────────── */}
        <div className={d.statGrid}>
          <div className={d.statCard}>
            <span>Total spent</span>
            <strong>{mny(detail.totalSpent)}</strong>
            <small>
              {detail.totalOrders} order{detail.totalOrders === 1 ? "" : "s"}{" "}
              lifetime
            </small>
          </div>
          <div className={d.statCard}>
            <span>Average order</span>
            <strong>{mny(detail.averageOrderValue)}</strong>
            <small>{detail.completedOrders} completed</small>
          </div>
          <div className={d.statCard}>
            <span>Last purchase</span>
            <strong className={d.statDate}>
              {fmtDate(detail.lastPurchaseAt)}
            </strong>
            <small>First order {fmtDate(detail.firstPurchaseAt)}</small>
          </div>
          {canFinance && detail.totalProfit != null && (
            <div className={`${d.statCard} ${d.statAccent}`}>
              <span>Profit from this customer</span>
              <strong>{mny(detail.totalProfit)}</strong>
              <small>Net of discounts &amp; cost</small>
            </div>
          )}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <div className={d.tabs}>
          {["overview", "orders", "coupons"].map((t) => (
            <button
              key={t}
              className={t === tab ? d.tabActive : d.tab}
              onClick={() => setTab(t)}
            >
              {t === "overview"
                ? "Overview"
                : t === "orders"
                  ? `Orders (${detail.totalOrders})`
                  : `Coupons (${(detail.coupons || []).length})`}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className={d.overviewGrid}>
            <Panel title="Monthly spend" sub="Last 12 months of activity">
              {detail.monthlySpend?.length ? (
                <div className={d.barList}>
                  {detail.monthlySpend.map((m) => (
                    <div className={d.barRow} key={m.month}>
                      <span className={d.barLabel}>{m.month}</span>
                      <div className={d.barTrack}>
                        <div
                          className={d.barFill}
                          style={{
                            width: `${Math.max(4, (Number(m.total) / maxMonth) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className={d.barValue}>{mny(m.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No purchases yet"
                  text="Spend trends will appear once this customer places an order."
                />
              )}
            </Panel>
            <Panel title="Top products" sub="What this customer buys most">
              {detail.topProducts?.length ? (
                <div className={d.barList}>
                  {detail.topProducts.map((p) => (
                    <div className={d.barRow} key={p.productName}>
                      <span className={d.barLabel} title={p.productName}>
                        {p.productName}
                      </span>
                      <div className={d.barTrack}>
                        <div
                          className={`${d.barFill} ${d.barFillAlt}`}
                          style={{
                            width: `${Math.max(4, (Number(p.total) / maxProduct) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className={d.barValue}>{mny(p.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Nothing purchased yet"
                  text="Product breakdown will appear here once orders come in."
                />
              )}
            </Panel>
          </div>
        )}

        {tab === "orders" && (
          <Panel
            title="Order history"
            sub="Every storefront order placed by this customer"
          >
            <div className={s.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Discount</th>
                    <th>Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(detail.orders || []).map((o) => (
                    <tr key={o.id}>
                      <td>
                        <button
                          className={s.linkButton}
                          onClick={() => setSelectedOrder(o)}
                        >
                          <b>{o.orderNumber}</b>
                        </button>
                      </td>
                      <td>{fmtDateTime(o.createdAt)}</td>
                      <td>
                        <span className={s.badge}>{o.status}</span>
                      </td>
                      <td>{o.paymentStatus}</td>
                      <td>
                        {Number(o.discountAmount) > 0
                          ? mny(o.discountAmount)
                          : "—"}
                      </td>
                      <td>{mny(o.total)}</td>
                      <td>
                        <button
                          className={s.textButton}
                          onClick={() => setSelectedOrder(o)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(detail.orders || []).length && (
                <Empty
                  title="No orders yet"
                  text="Orders this customer places through your storefront will show up here."
                />
              )}
            </div>
          </Panel>
        )}

        {tab === "coupons" && (
          <Panel
            title="Loyalty coupons"
            sub="Discounts awarded to this customer, redeemable on their next purchase"
            action={
              <button className={s.primary} onClick={() => setAwardOpen(true)}>
                🎁 Award coupon
              </button>
            }
          >
            {(detail.coupons || []).length ? (
              <div className={d.couponGrid}>
                {[...activeCoupons, ...otherCoupons].map((c) => (
                  <div className={d.couponCard} key={c.id}>
                    <div className={d.couponHead}>
                      <code className={d.couponCode}>{c.code}</code>
                      <span
                        className={`${d.couponStatus} ${d[`status_${c.status}`]}`}
                      >
                        {COUPON_STATUS_LABEL[c.status] || c.status}
                      </span>
                    </div>
                    <strong className={d.couponReward}>{rewardLabel(c)}</strong>
                    {c.minSpend != null && (
                      <small>Min. spend {mny(c.minSpend)}</small>
                    )}
                    {c.note && <p className={d.couponNote}>{c.note}</p>}
                    <div className={d.couponMeta}>
                      <span>
                        Awarded {fmtDate(c.createdAt)}
                        {c.awardedByName ? ` by ${c.awardedByName}` : ""}
                      </span>
                      {c.expiresAt && (
                        <span>Expires {fmtDate(c.expiresAt)}</span>
                      )}
                      {c.redeemedAt && (
                        <span>
                          Redeemed {fmtDate(c.redeemedAt)}
                          {c.redeemedOrderNumber
                            ? ` · ${c.redeemedOrderNumber}`
                            : " · in-store"}
                        </span>
                      )}
                    </div>
                    {c.status === "ACTIVE" && (
                      <div className={d.couponActions}>
                        <button
                          className={s.textButton}
                          disabled={busyCouponId === c.id}
                          onClick={() => setConfirmRedeem(c)}
                        >
                          Mark redeemed in-store
                        </button>
                        <button
                          className={s.textDanger}
                          disabled={busyCouponId === c.id}
                          onClick={() => setConfirmRevoke(c)}
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No coupons awarded yet"
                text="Reward this customer with a percentage or fixed-amount discount for their next purchase."
                action={
                  <button
                    className={s.primary}
                    onClick={() => setAwardOpen(true)}
                  >
                    Award a coupon
                  </button>
                }
              />
            )}
          </Panel>
        )}
      </div>

      {/* ── Award coupon modal ────────────────────────────────────── */}
      {awardOpen && (
        <Modal
          title={`Award a coupon to ${fullName}`}
          onClose={() => setAwardOpen(false)}
        >
          <form onSubmit={submitAward} className={d.awardForm}>
            {awardError && <div className={s.error}>{awardError}</div>}
            <label className={s.field}>
              <span>Reward type</span>
              <select
                value={award.type}
                onChange={(e) =>
                  setAward((a) => ({ ...a, type: e.target.value }))
                }
              >
                <option value="PERCENTAGE">Percentage off</option>
                <option value="FIXED_AMOUNT">Fixed amount off</option>
              </select>
            </label>
            <Field
              label={
                award.type === "PERCENTAGE"
                  ? "Percentage (%)"
                  : `Amount (${businessCurrency})`
              }
              type="number"
              min="0.01"
              step="0.01"
              required
              value={award.value}
              onChange={(e) =>
                setAward((a) => ({ ...a, value: e.target.value }))
              }
              placeholder={
                award.type === "PERCENTAGE" ? "e.g. 10" : "e.g. 2000"
              }
            />
            <Field
              label={`Minimum spend (${businessCurrency}, optional)`}
              type="number"
              min="0"
              step="0.01"
              value={award.minSpend}
              onChange={(e) =>
                setAward((a) => ({ ...a, minSpend: e.target.value }))
              }
              placeholder="No minimum"
            />
            <Field
              label="Expires on (optional)"
              type="date"
              value={award.expiresAt}
              onChange={(e) =>
                setAward((a) => ({ ...a, expiresAt: e.target.value }))
              }
            />
            <label className={s.field}>
              <span>Note (optional, shown to the customer)</span>
              <input
                value={award.note}
                onChange={(e) =>
                  setAward((a) => ({ ...a, note: e.target.value }))
                }
                placeholder="e.g. Thanks for being a loyal customer!"
                maxLength={300}
              />
            </label>
            <div className={s.modalFoot}>
              <button
                type="button"
                className={s.outline}
                onClick={() => setAwardOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className={s.primary} disabled={awarding}>
                {awarding ? "Awarding…" : "Award coupon"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Order detail modal ───────────────────────────────────── */}
      {selectedOrder && (
        <Modal
          title={`Order ${selectedOrder.orderNumber}`}
          onClose={() => setSelectedOrder(null)}
        >
          <div className={`${s.orderDetail} ${s.receipt}`}>
            <div className={s.detailGrid}>
              <div>
                <span>Status</span>
                <b>{selectedOrder.status}</b>
              </div>
              <div>
                <span>Payment</span>
                <b>{selectedOrder.paymentStatus}</b>
              </div>
              <div>
                <span>Subtotal</span>
                <b>{mny(selectedOrder.subtotal)}</b>
              </div>
              {Number(selectedOrder.discountAmount) > 0 && (
                <div>
                  <span>
                    Discount
                    {selectedOrder.couponCode
                      ? ` (${selectedOrder.couponCode})`
                      : ""}
                  </span>
                  <b>-{mny(selectedOrder.discountAmount)}</b>
                </div>
              )}
              <div>
                <span>Total</span>
                <b>{mny(selectedOrder.total)}</b>
              </div>
              <div>
                <span>Placed</span>
                <b>{fmtDateTime(selectedOrder.createdAt)}</b>
              </div>
            </div>
            <h3>Items</h3>
            <div className={s.list}>
              {(selectedOrder.items || []).map((i) => (
                <div key={i.id}>
                  <span>
                    <b>{i.productName}</b>
                    <small>
                      {i.quantity} × {mny(i.unitPrice)}
                    </small>
                  </span>
                  <strong>{mny(i.lineTotal)}</strong>
                </div>
              ))}
            </div>
            {selectedOrder.deliveryAddress && (
              <>
                <h3>Delivery address</h3>
                <p>{selectedOrder.deliveryAddress}</p>
              </>
            )}
            {selectedOrder.customerNote && (
              <>
                <h3>Customer note</h3>
                <p>{selectedOrder.customerNote}</p>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Confirm revoke ──────────────────────────────────────── */}
      {confirmRevoke && (
        <Modal title="Revoke coupon" onClose={() => setConfirmRevoke(null)}>
          <p>
            Revoke <b>{confirmRevoke.code}</b> ({rewardLabel(confirmRevoke)})?
            The customer will no longer be able to use it.
          </p>
          <div className={s.modalFoot}>
            <button
              className={s.outline}
              onClick={() => setConfirmRevoke(null)}
            >
              Cancel
            </button>
            <button
              className={s.textDanger}
              disabled={busyCouponId === confirmRevoke.id}
              onClick={doRevoke}
            >
              {busyCouponId === confirmRevoke.id
                ? "Revoking…"
                : "Revoke coupon"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Confirm manual redemption ───────────────────────────── */}
      {confirmRedeem && (
        <Modal
          title="Mark coupon redeemed"
          onClose={() => setConfirmRedeem(null)}
        >
          <p>
            Mark <b>{confirmRedeem.code}</b> ({rewardLabel(confirmRedeem)}) as
            used for an in-store / POS purchase? This can't be undone and will
            notify the customer.
          </p>
          <div className={s.modalFoot}>
            <button
              className={s.outline}
              onClick={() => setConfirmRedeem(null)}
            >
              Cancel
            </button>
            <button
              className={s.primary}
              disabled={busyCouponId === confirmRedeem.id}
              onClick={doRedeem}
            >
              {busyCouponId === confirmRedeem.id ? "Saving…" : "Mark redeemed"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export { CustomerDetail };
