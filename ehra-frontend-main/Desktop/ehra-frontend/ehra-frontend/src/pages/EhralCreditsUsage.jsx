import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCreditActivity } from "../api/creditsApi";
import styles from "./EhralCreditsUsage.module.css";

const money = (n) =>
  `₦${Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const label = (code = "") =>
  code
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());

const SERVICE_ICONS = {
  PRODUCT_ACTIVATION: "ti-package",
  POS_RECEIPT: "ti-receipt-2",
  WHATSAPP_CLICK: "ti-brand-whatsapp",
};
const DEFAULT_SERVICE_ICON = "ti-apps";
const serviceIcon = (code = "") => SERVICE_ICONS[code] || DEFAULT_SERVICE_ICON;

// Friendly labels for the ledger's raw eventType, and the value sent to the
// API's `eventType` filter. "" means "don't filter" (All activity).
const ACTIVITY_TYPES = [
  { value: "", label: "All activity", icon: "ti-adjustments-horizontal" },
  { value: "SERVICE_USAGE", label: "Service usage", icon: "ti-bolt" },
  { value: "CREDIT_PURCHASE", label: "Purchases", icon: "ti-wallet" },
  { value: "PROMOTIONAL_GRANT", label: "Promotional credits", icon: "ti-gift" },
  { value: "WELCOME_GRANT", label: "Welcome credit", icon: "ti-confetti" },
  { value: "ADMIN_GRANT", label: "Adjustments", icon: "ti-settings" },
  { value: "EXPIRATION", label: "Expired credits", icon: "ti-clock-x" },
];

// Timeline presets, expressed as "days back from today". `null` means
// all-time (no `from`); "custom" switches on the two date inputs.
const TIMELINES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
];

const toDateInput = (d) => d.toISOString().slice(0, 10);

const PAGE_SIZE = 20;

export default function EhralCreditsUsage({ onBack, services = [] }) {
  const [timeline, setTimeline] = useState("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [eventType, setEventType] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Bumped on every filter change so an in-flight request from a stale
  // filter set can't overwrite results from a newer one.
  const requestId = useRef(0);

  const { from, to } = useMemo(() => {
    if (timeline === "all") return { from: "", to: "" };
    if (timeline === "custom") return { from: customFrom, to: customTo };
    const days = Number(timeline);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    return { from: toDateInput(start), to: toDateInput(end) };
  }, [timeline, customFrom, customTo]);

  const fetchPage = useCallback(
    async (pageToLoad, { append }) => {
      const myId = ++requestId.current;
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const res = await getCreditActivity({
          page: pageToLoad,
          size: PAGE_SIZE,
          eventType,
          serviceCode,
          from,
          to,
        });
        if (myId !== requestId.current) return;
        setRows((prev) =>
          append ? [...prev, ...(res.content || [])] : res.content || [],
        );
        setPage(res.page ?? pageToLoad);
        setHasNext(!!res.hasNext);
        setTotalElements(res.totalElements ?? 0);
        setError("");
      } catch (e) {
        if (myId !== requestId.current) return;
        setError(
          e?.response?.data?.message ||
            "We couldn't load your Ehral Credits usage right now.",
        );
      } finally {
        if (myId !== requestId.current) return;
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [eventType, serviceCode, from, to],
  );

  // Custom range: wait until both dates are picked before querying.
  const customIncomplete = timeline === "custom" && (!customFrom || !customTo);

  useEffect(() => {
    if (customIncomplete) return;
    fetchPage(0, { append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, serviceCode, from, to]);

  const groups = useMemo(() => {
    const byDay = new Map();
    rows.forEach((a) => {
      const d = a.createdAt ? new Date(a.createdAt) : null;
      const key = d
        ? d.toLocaleDateString("en-NG", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Unknown date";
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(a);
    });
    return Array.from(byDay.entries());
  }, [rows]);

  const activeFilterCount =
    (eventType ? 1 : 0) + (serviceCode ? 1 : 0) + (timeline !== "30" ? 1 : 0);

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <button className={styles.backButton} onClick={onBack}>
          <i className="ti ti-arrow-left" /> Back to Ehral Credits
        </button>
      </div>

      <div>
        <p className={styles.eyebrow}>EHRAL CREDITS</p>
        <h1>Usage history</h1>
        <p className={styles.subtitle}>
          Every purchase, service charge and adjustment on your Ehral Credits
          balance.
        </p>
      </div>

      <button
        className={styles.filterToggle}
        onClick={() => setFiltersOpen((v) => !v)}
        aria-expanded={filtersOpen}
      >
        <span>
          <i className="ti ti-filter" /> Filters
          {activeFilterCount > 0 && (
            <span className={styles.filterBadge}>{activeFilterCount}</span>
          )}
        </span>
        <i
          className={`ti ${filtersOpen ? "ti-chevron-up" : "ti-chevron-down"}`}
        />
      </button>

      <section
        className={`${styles.filters} ${filtersOpen ? styles.filtersOpen : ""}`}
      >
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Timeline</span>
          <div className={styles.chipRow}>
            {TIMELINES.map((t) => (
              <button
                key={t.value}
                className={
                  timeline === t.value ? styles.chipActive : styles.chip
                }
                onClick={() => setTimeline(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {timeline === "custom" && (
            <div className={styles.dateRange}>
              <label>
                <span>From</span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  max={toDateInput(new Date())}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Activity type</span>
          <div className={styles.chipRow}>
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t.value || "all"}
                className={
                  eventType === t.value ? styles.chipActive : styles.chip
                }
                onClick={() => setEventType(t.value)}
              >
                <i className={`ti ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {services.length > 0 && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Service</span>
            <div className={styles.chipRow}>
              <button
                className={serviceCode === "" ? styles.chipActive : styles.chip}
                onClick={() => setServiceCode("")}
              >
                All services
              </button>
              {services.map((s) => (
                <button
                  key={s.serviceCode}
                  className={
                    serviceCode === s.serviceCode
                      ? styles.chipActive
                      : styles.chip
                  }
                  onClick={() => setServiceCode(s.serviceCode)}
                >
                  <i className={`ti ${serviceIcon(s.serviceCode)}`} />{" "}
                  {label(s.serviceCode)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => fetchPage(0, { append: false })}>Retry</button>
        </div>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>
            {loading ? "Loading…" : `${totalElements.toLocaleString()} entries`}
          </h2>
        </div>

        {loading ? (
          <div className={styles.skeletonList}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div className={styles.skeletonRow} key={i} />
            ))}
          </div>
        ) : rows.length ? (
          <div className={styles.activity}>
            {groups.map(([day, entries]) => (
              <div key={day} className={styles.dayGroup}>
                <div className={styles.dayLabel}>{day}</div>
                {entries.map((a) => {
                  const isUsage = a.eventType === "SERVICE_USAGE";
                  const signedAmount = isUsage
                    ? -Number(a.amount)
                    : Number(a.amount);
                  return (
                    <div className={styles.activityRow} key={a.id}>
                      <div
                        className={`${styles.activityIcon} ${signedAmount >= 0 ? styles.plus : styles.minus}`}
                      >
                        <i
                          className={
                            signedAmount >= 0
                              ? "ti ti-arrow-down-left"
                              : "ti ti-arrow-up-right"
                          }
                        />
                      </div>
                      <div className={styles.activityInfo}>
                        <strong>{a.description || label(a.eventType)}</strong>
                        <span>
                          {a.createdAt
                            ? new Date(a.createdAt).toLocaleTimeString(
                                "en-NG",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : ""}
                          {a.serviceCode ? ` · ${label(a.serviceCode)}` : ""}
                          {a.creditType
                            ? ` · ${label(a.creditType)} credits`
                            : ""}
                        </span>
                      </div>
                      <div className={styles.activityAmountWrap}>
                        <div
                          className={`${styles.activityAmount} ${signedAmount >= 0 ? styles.positive : ""}`}
                        >
                          {signedAmount < 0 ? "-" : "+"}
                          {money(Math.abs(Number(a.amount || 0)))}
                        </div>
                        <div className={styles.activityBalance}>
                          Balance {money(a.balanceAfter)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {hasNext && (
              <button
                className={styles.loadMore}
                disabled={loadingMore}
                onClick={() => fetchPage(page + 1, { append: true })}
              >
                {loadingMore ? (
                  <>
                    <i className="ti ti-loader-2" /> Loading…
                  </>
                ) : (
                  <>
                    Load more <i className="ti ti-chevron-down" />
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className={styles.empty}>
            <i className="ti ti-receipt-off" />
            <h3>No activity in this range</h3>
            <p>Try a wider timeline or a different activity type.</p>
          </div>
        )}
      </section>
    </div>
  );
}
