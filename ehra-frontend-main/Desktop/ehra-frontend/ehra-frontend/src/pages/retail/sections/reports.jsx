import { useEffect, useState } from "react";
import s from "../../RetailWorkspace.module.css";
import { getReport, getLedger } from "../../../api/retailApi";
import { Empty, Metric, Panel, today } from "./shared";

const toISO = (d) => d.toISOString().slice(0, 10);

// Quick timeline shortcuts shown above the manual date pickers. Each entry
// computes its own [from, to] pair in local time when tapped, so "Today"
// etc. is always relative to whenever the button is actually clicked.
const PRESETS = [
  {
    label: "Today",
    range: () => {
      const d = new Date();
      return [toISO(d), toISO(d)];
    },
  },
  {
    label: "Yesterday",
    range: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return [toISO(d), toISO(d)];
    },
  },
  {
    label: "This week",
    range: () => {
      const d = new Date();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return [toISO(monday), toISO(d)];
    },
  },
  {
    label: "Last week",
    range: () => {
      const d = new Date();
      const thisMonday = new Date(d);
      thisMonday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      return [toISO(lastMonday), toISO(lastSunday)];
    },
  },
  {
    label: "This month",
    range: () => {
      const d = new Date();
      return [toISO(new Date(d.getFullYear(), d.getMonth(), 1)), toISO(d)];
    },
  },
  {
    label: "Last month",
    range: () => {
      const d = new Date();
      const firstOfThis = new Date(d.getFullYear(), d.getMonth(), 1);
      const lastOfPrev = new Date(firstOfThis.getTime() - 86400000);
      return [
        toISO(new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1)),
        toISO(lastOfPrev),
      ];
    },
  },
  {
    label: "This quarter",
    range: () => {
      const d = new Date();
      return [
        toISO(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)),
        toISO(d),
      ];
    },
  },
  {
    label: "This year",
    range: () => {
      const d = new Date();
      return [toISO(new Date(d.getFullYear(), 0, 1)), toISO(d)];
    },
  },
];

function Reports({ report, setReport, money }) {
  const [ledger, setLedger] = useState([]);
  const [from, setFrom] = useState(() =>
    toISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [to, setTo] = useState(today());
  const [activePreset, setActivePreset] = useState("This month");
  const [loading, setLoading] = useState(false);
  // FIX: run() used to have no catch at all - a failed or timed-out
  // request (see RetailService#report for the query bug that could cause
  // one) just rejected silently, `report` stayed null, and the person was
  // left staring at "Run a report" forever with nothing telling them
  // anything had gone wrong. `error` surfaces that failure so there's
  // always a visible reason and a way to retry, instead of a page that
  // looks like it simply never loads.
  const [error, setError] = useState(null);

  const run = async (f = from, t = to) => {
    setLoading(true);
    setError(null);
    try {
      setReport((await getReport(f, t)).data);
      setLedger((await getLedger(f, t)).data || []);
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          "Couldn't load this report. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Loads This Month's report the moment the page opens, instead of
  // leaving the customer looking at an empty "Run a report" state until
  // they click the button once themselves.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    run(from, to);
  }, []);

  const applyPreset = (preset) => {
    const [f, t] = preset.range();
    setFrom(f);
    setTo(t);
    setActivePreset(preset.label);
    run(f, t);
  };

  const onManualDate = (setter) => (e) => {
    setActivePreset(null);
    setter(e.target.value);
  };

  const grossMarginPct =
    report && report.revenue > 0
      ? (report.grossProfit / report.revenue) * 100
      : null;
  const netMarginPct =
    report && report.revenue > 0
      ? (report.netProfit / report.revenue) * 100
      : null;
  const pct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

  const categories = report?.expensesByCategory || [];
  const maxCategory = categories.length
    ? Math.max(...categories.map((c) => c.amount || 0), 1)
    : 1;

  const daily = report?.daily || [];
  const maxDailyAbs = daily.length
    ? Math.max(...daily.map((d) => Math.abs(d.netProfit || 0)), 1)
    : 1;

  return (
    <>
      <div className={s.toolbar}>
        <div>
          <h2>Business reports</h2>
          <p>
            Understand sales, costs, expenses and operating profitability — day
            by day or over any period you choose.
          </p>
        </div>
      </div>

      <div className={s.presetRow}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`${s.presetBtn} ${activePreset === p.label ? s.presetBtnActive : ""}`}
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className={s.dateRange} style={{ marginBottom: 20 }}>
        <input type="date" value={from} onChange={onManualDate(setFrom)} />
        <span>to</span>
        <input type="date" value={to} onChange={onManualDate(setTo)} />
        <button className={s.primary} onClick={() => run()} disabled={loading}>
          {loading ? "Running…" : "Run report"}
        </button>
      </div>

      {error && (
        <div className={s.errorBanner} role="alert">
          <span>{error}</span>
          <button className={s.presetBtn} onClick={() => run()}>
            Retry
          </button>
        </div>
      )}

      {report ? (
        <>
          <div className={s.metrics}>
            <Metric
              label="Revenue"
              value={money(report.revenue)}
              trend="Recorded sales"
            />
            <Metric
              label="COGS"
              value={money(report.cogs)}
              trend="Historical product cost"
            />
            <Metric
              label="Gross Profit"
              value={money(report.grossProfit)}
              trend="Revenue less COGS"
            />
            <Metric
              label="Expenses"
              value={money(report.expenses)}
              trend="Operating expenses"
            />
            <Metric
              label="Net Profit"
              value={money(report.netProfit)}
              trend="Gross profit less expenses"
            />
            <Metric
              label="Gross Margin"
              value={pct(grossMarginPct)}
              trend="Gross profit ÷ revenue"
            />
            <Metric
              label="Net Margin"
              value={pct(netMarginPct)}
              trend="Net profit ÷ revenue"
            />
          </div>

          <div className={s.grid2}>
            <Panel
              title="Working capital"
              sub="Amounts that remain to be collected or paid"
            >
              <div className={s.finance}>
                <div>
                  <span>Cash received</span>
                  <b>{money(report.cashReceived)}</b>
                </div>
                <div>
                  <span>Receivables</span>
                  <b>{money(report.receivables)}</b>
                </div>
                <div>
                  <span>Payables</span>
                  <b>{money(report.payables)}</b>
                </div>
                <div>
                  <span>Refunds</span>
                  <b>{money(report.refunds || 0)}</b>
                </div>
                <div>
                  <span>Supplier payments</span>
                  <b>{money(report.paymentsOut || 0)}</b>
                </div>
                <div>
                  <span>Net cash flow</span>
                  <b>{money(report.netCashFlow || 0)}</b>
                </div>
              </div>
            </Panel>
            <Panel title="Operations" sub="Current business indicators">
              <div className={s.finance}>
                <div>
                  <span>Products</span>
                  <b>{report.products}</b>
                </div>
                <div>
                  <span>Low stock</span>
                  <b>{report.lowStockProducts}</b>
                </div>
                <div>
                  <span>Customers</span>
                  <b>{report.customers}</b>
                </div>
                <div>
                  <span>Orders</span>
                  <b>{report.orders}</b>
                </div>
              </div>
            </Panel>
          </div>

          <Panel
            title="Where the money goes"
            sub="Non-owner-withdrawal expenses for the selected period, by category — exactly what's being deducted from gross profit."
          >
            {categories.length ? (
              <div>
                {categories.map((c) => (
                  <div className={s.expenseCatRow} key={c.category}>
                    <span className={s.expenseCatName}>{c.category}</span>
                    <div className={s.expenseCatTrack}>
                      <div
                        className={s.expenseCatFill}
                        style={{
                          width: `${Math.max(2, ((c.amount || 0) / maxCategory) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className={s.expenseCatAmount}>
                      {money(c.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No expenses recorded"
                text="Expenses logged for this period will be broken down here by category."
              />
            )}
          </Panel>

          <Panel
            title="Daily operating view"
            sub="Sales and operating expenses by day for the selected period."
          >
            {daily.length > 1 && (
              <div className={s.dailyBars}>
                {daily.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${money(d.netProfit)} net`}
                    className={`${s.dailyBar} ${(d.netProfit || 0) < 0 ? s.dailyBarNegative : ""}`}
                    style={{
                      height: `${Math.max(3, (Math.abs(d.netProfit || 0) / maxDailyAbs) * 100)}%`,
                    }}
                  />
                ))}
              </div>
            )}
            <div className={s.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Revenue</th>
                    <th>COGS</th>
                    <th>Gross profit</th>
                    <th>Expenses</th>
                    <th>Net profit</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{money(d.revenue)}</td>
                      <td>{money(d.cogs)}</td>
                      <td>{money(d.grossProfit)}</td>
                      <td>{money(d.expenses)}</td>
                      <td>{money(d.netProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Operational transaction ledger"
            sub="Sales, orders, payments, refunds, purchases and expenses in one chronological view."
          >
            <div className={s.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Description</th>
                    <th>Debit</th>
                    <th>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((x) => (
                    <tr key={`${x.type}-${x.id}`}>
                      <td>{x.date ? new Date(x.date).toLocaleString() : ""}</td>
                      <td>{x.type}</td>
                      <td>{x.reference || "n/a"}</td>
                      <td>{x.description || "n/a"}</td>
                      <td>{money(x.debit)}</td>
                      <td>{money(x.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!ledger.length && (
                <p>No ledger entries for the current business.</p>
              )}
            </div>
          </Panel>
        </>
      ) : (
        <Empty
          title={
            loading
              ? "Loading…"
              : error
                ? "Report failed to load"
                : "Run a report"
          }
          text={
            error
              ? "See the error above and retry, or try a different date range."
              : "Choose a date range to see your retail financial picture."
          }
        />
      )}
    </>
  );
}

export { Reports };
