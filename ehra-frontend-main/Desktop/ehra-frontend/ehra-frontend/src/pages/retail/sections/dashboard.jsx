import { useEffect, useState } from "react";
import s from "../../RetailWorkspace.module.css";
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

function Dashboard({
  todaySales,
  monthSales,
  active,
  low,
  pending,
  data,
  setTab,
  money,
  allowedTabs,
  credits,
}) {
  const canCredits = !allowedTabs || allowedTabs.has("Ehral Credits");
  return (
    <>
      {/* Glass hero - same "frosted glass" treatment as the customer
          dashboard's welcome panel (see .ghHero in
          CustomerDashboard.module.css / .hero here in
          RetailWorkspace.module.css), so the two dashboards read as one
          product. The Ehral Credits balance rides along as a chip here -
          the most-seen panel in the workspace - so it stays easy to find
          instead of being buried a few taps deep. */}
      <div className={s.hero}>
        <div className={s.heroCopy}>
          <span>GOOD BUSINESS STARTS WITH VISIBILITY</span>
          <h2>Good morning. Here is your retail pulse.</h2>
          <p>
            Track sales, stock, orders and cash movement without leaving your
            workspace.
          </p>
          <div className={s.heroActions}>
            {(!allowedTabs || allowedTabs.has("Sales / POS")) && (
              <button
                className={s.heroCta}
                onClick={() => setTab("Sales / POS")}
              >
                ＋ New Sale
              </button>
            )}
          </div>
        </div>
        {canCredits && (
          <div className={s.heroChips}>
            <button
              type="button"
              className={s.heroChip}
              onClick={() => setTab("Ehral Credits")}
              aria-label={`${credits ? money(credits.availableCredits) : "View"} Ehral Credits balance`}
            >
              <span className={s.heroChipIcon}>
                <i className="ti ti-wallet" aria-hidden="true" />
              </span>
              <span>
                <b>{credits ? money(credits.availableCredits) : "—"}</b>
                <small>Ehral Credits</small>
              </span>
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className={s.metrics}>
        <Metric
          label="Today's Sales"
          value={money(todaySales)}
          trend="POS sales today"
        />
        <Metric
          label="This Month"
          value={money(monthSales)}
          trend="Recorded retail sales"
        />
        <Metric
          label="Products"
          value={active.length}
          trend={`${low.length} need attention`}
        />
        <Metric
          label="Orders"
          value={data.orders.length}
          trend={`${pending.length} currently pending`}
        />
        <Metric
          label="Customers"
          value={data.customers.length}
          trend="Business relationships"
        />
      </div>

      <div className={s.grid2}>
        <Panel title="Quick actions" sub="Common tasks">
          <div className={s.quickGrid}>
            {[
              ["Add Product", "Products"],
              ["New Sale", "Sales / POS"],
              ["Adjust Stock", "Inventory"],
              ["Add Expense", "Expenses"],
              ["Add Supplier", "Suppliers"],
              ["View Orders", "Orders"],
              ["Profit & Loss", "Reports"],
            ]
              .filter((x) => !allowedTabs || allowedTabs.has(x[1]))
              .map((x) => (
                <button key={x[0]} onClick={() => setTab(x[1])}>
                  <b>{x[0].slice(0, 1)}</b>
                  <span>{x[0]}</span>
                  <i>→</i>
                </button>
              ))}
          </div>
        </Panel>
        <Panel
          title="Inventory attention"
          sub="Products at or below their threshold"
        >
          {low.length ? (
            <div className={s.list}>
              {low.slice(0, 5).map((p) => (
                <div key={p.id}>
                  <span>
                    <b>{p.name}</b>
                    <small>{p.sku || "No SKU"}</small>
                  </span>
                  <strong className={s.warning}>
                    {p.stockQuantity} {p.unit || "units"}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Stock looks healthy"
              text="No active products are currently below their low-stock threshold."
            />
          )}
        </Panel>
      </div>
    </>
  );
}

export { Dashboard };
