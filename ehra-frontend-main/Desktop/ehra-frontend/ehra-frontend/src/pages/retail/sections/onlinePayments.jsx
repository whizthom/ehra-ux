import { useEffect, useRef, useState } from "react";
import s from "../../RetailWorkspace.module.css";
import {
  getOnlinePaymentTerms,
  getOnlinePaymentAccountStatus,
  listSettlementBanks,
  resolveSettlementAccount,
  activateOnlinePayments,
  suspendOnlinePayments,
  resumeOnlinePayments,
  getOrderPaymentSummary,
} from "../../../api/orderPaymentApi";
import { Panel, Metric } from "./shared";
import { GlassSelect } from "./GlassSelect";

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

function pct(n) {
  return `${n}%`;
}

// "Before you enable online payments" - the fee explainer + worked
// examples shown directly on this page (never behind a tooltip or a
// separate T&Cs page) - spec §2, §18.
function FeeExplainer({ terms, money }) {
  if (!terms) return null;
  return (
    <div className={s.formGrid}>
      <div className={s.fieldWide}>
        <span className={s.sectionLabel}>How payment fees work</span>
        <div className={`${s.tableWrap}`} style={{ marginTop: 8 }}>
          <table className={s.feeInfoTable}>
            <tbody>
              <tr>
                <td>
                  <strong>Ehral platform fee</strong>
                </td>
                <td>
                  {pct(terms.ehralFeeRatePercent)} of every successfully
                  completed order
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Paystack processing fee</strong>
                </td>
                <td>
                  {pct(terms.paystackPercentageRatePercent)} +{" "}
                  {money(terms.paystackFlatFee)} (the{" "}
                  {money(terms.paystackFlatFee)} flat component is waived below{" "}
                  {money(terms.paystackFlatFeeWaiverThreshold)}; capped at{" "}
                  {money(terms.paystackFeeCap)} per transaction)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={s.fieldWide}>
        <span className={s.sectionLabel}>Who pays these fees?</span>
        <p style={{ marginTop: 6 }}>
          Your business bears the applicable Paystack processing fee and Ehral's{" "}
          {pct(terms.ehralFeeRatePercent)} platform fee. These charges are
          deducted from your settlement. Your customers are charged exactly the
          order price you set - Ehral never adds these fees on top of what your
          customer pays.
        </p>
      </div>

      <div className={s.fieldWide}>
        <span className={s.sectionLabel}>Examples</span>
        <div className={s.tableWrap} style={{ marginTop: 8 }}>
          <table className={s.examplesTable}>
            <thead>
              <tr>
                <th>Order value</th>
                <th>Paystack fee</th>
                <th>Ehral fee</th>
                <th>Estimated settlement</th>
              </tr>
            </thead>
            <tbody>
              {(terms.examples || []).map((ex) => (
                <tr key={ex.orderAmount}>
                  <td data-label="Order value">{money(ex.orderAmount)}</td>
                  <td data-label="Paystack fee">{money(ex.paystackFee)}</td>
                  <td data-label="Ehral fee">{money(ex.ehralFee)}</td>
                  <td data-label="Estimated settlement">
                    <strong>{money(ex.estimatedSettlement)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={s.fieldHint}>
          These are examples. Actual Paystack charges may depend on Paystack's
          applicable pricing/configuration at the time of the transaction.
        </div>
      </div>
    </div>
  );
}

// The full activation flow (spec §1-§6, §18): terms displayed in full on
// this page -> bank account resolved and confirmed -> explicit,
// non-preselected checkbox -> Accept & Enable.
function ActivationFlow({ terms, onActivated, money }) {
  const [banks, setBanks] = useState([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolved, setResolved] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const termsBodyRef = useRef(null);

  useEffect(() => {
    listSettlementBanks()
      .then(setBanks)
      .catch(() => setBanks([]));
  }, []);

  const handleTermsScroll = () => {
    const el = termsBodyRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24)
      setReachedEnd(true);
  };

  const resolveAccount = async () => {
    setError("");
    setResolved(null);
    if (!bankCode || accountNumber.trim().length < 10) {
      setError("Select a bank and enter a valid account number first.");
      return;
    }
    setResolving(true);
    try {
      const r = await resolveSettlementAccount(bankCode, accountNumber.trim());
      setResolved(r);
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          "Could not resolve that account number with the selected bank.",
      );
    } finally {
      setResolving(false);
    }
  };

  const activate = async () => {
    setError("");
    if (!resolved) {
      setError(
        "Resolve and confirm your settlement account before continuing.",
      );
      return;
    }
    if (!accepted) {
      setError(
        "You must accept the complete Online Ordering & Payment Terms to continue.",
      );
      return;
    }
    setActivating(true);
    try {
      const account = await activateOnlinePayments({
        bankCode,
        accountNumber: accountNumber.trim(),
        termsVersion: terms.termsVersion,
        termsAccepted: true,
      });
      onActivated(account);
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          "Could not enable online payments. Please try again.",
      );
    } finally {
      setActivating(false);
    }
  };

  const canCheckAccept = reachedEnd;
  const canActivate = accepted && Boolean(resolved) && !activating;

  return (
    <Panel
      title="Before you enable online payments"
      sub="This is a financial agreement between your business, your customers and Ehral. Please read the complete terms below."
    >
      <FeeExplainer terms={terms} money={money} />

      <div className={s.formGrid} style={{ marginTop: 18 }}>
        <div className={s.fieldWide}>
          <span className={s.sectionLabel}>Settlement bank account</span>
          <small>
            Customer payments settle to this account, via a Paystack subaccount
            created automatically for your business.
          </small>
        </div>
        <GlassSelect
          label="Bank"
          value={bankCode}
          onChange={(v) => {
            setBankCode(v);
            setResolved(null);
          }}
          options={banks.map((b) => ({ value: b.code, label: b.name }))}
          placeholder="Select your bank"
        />
        <label className={s.field}>
          <span>Account number</span>
          <input
            value={accountNumber}
            onChange={(e) => {
              setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10));
              setResolved(null);
            }}
            placeholder="0123456789"
            inputMode="numeric"
          />
        </label>
        <div className={s.field}>
          <span>&nbsp;</span>
          <button
            type="button"
            className={s.outline}
            onClick={resolveAccount}
            disabled={resolving}
          >
            {resolving ? "Resolving…" : "Resolve account"}
          </button>
        </div>
        {resolved && (
          <div className={s.fieldWide}>
            <div className={s.copyConfirmation}>
              <i className="ti ti-check" /> Account resolved:{" "}
              <strong>{resolved.accountName}</strong> ({resolved.bankName})
            </div>
          </div>
        )}
      </div>

      <div
        className={`${s.fieldWide} ${s.descriptionField}`}
        style={{ marginTop: 18 }}
      >
        <div className={s.fieldLabelRow}>
          <span>
            Full Online Ordering & Payment Terms (v{terms.termsVersion})
          </span>
        </div>
        <div
          ref={termsBodyRef}
          onScroll={handleTermsScroll}
          style={{
            maxHeight: 260,
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            border: "1px solid var(--border,#e4e4e7)",
            borderRadius: 10,
            padding: 16,
            fontSize: 13.5,
            lineHeight: 1.6,
          }}
        >
          {terms.fullTermsText}
        </div>
        {!reachedEnd && (
          <div className={s.fieldHint}>
            Scroll to the end of the terms to continue.
          </div>
        )}
      </div>

      <label
        className={s.toggleCard}
        style={{ marginTop: 16, opacity: canCheckAccept ? 1 : 0.6 }}
      >
        <input
          type="checkbox"
          checked={accepted}
          disabled={!canCheckAccept}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <span>
          <b>
            I have read, understood, and accept the complete Ehral Online
            Ordering & Payment Terms
          </b>
          <small>
            Including the Ehral {pct(terms.ehralFeeRatePercent)} platform fee
            and applicable Paystack processing charges.
          </small>
        </span>
      </label>

      {error && (
        <div className={s.error} style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      <div className={s.toolbar} style={{ marginTop: 18 }}>
        <div />
        <button
          className={s.primary}
          disabled={!canActivate}
          onClick={activate}
        >
          {activating ? "Enabling…" : "Accept Terms & Enable Online Ordering"}
        </button>
      </div>
    </Panel>
  );
}

function StatusBadge({ status }) {
  const map = {
    ACTIVE: { label: "Active", cls: s.urlAvailable },
    PENDING: { label: "Pending", cls: "" },
    SUSPENDED: { label: "Suspended", cls: s.urlTaken },
    DISABLED: { label: "Disabled", cls: s.urlTaken },
    REQUIRES_REAUTHORIZATION: { label: "Needs re-acceptance", cls: s.urlTaken },
  };
  const m = map[status] || { label: status, cls: "" };
  return <span className={`${s.urlStatus} ${m.cls}`}>{m.label}</span>;
}

function AccountDashboard({ account, terms, onSuspend, onResume, money }) {
  const [range, setRange] = useState({ from: firstOfMonth(), to: today() });
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadSummary = async (from, to) => {
    setLoadingSummary(true);
    try {
      setSummary(await getOrderPaymentSummary(from, to));
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadSummary(range.from, range.to);
  }, [range.from, range.to]);

  const toggleStatus = async () => {
    setBusy(true);
    try {
      if (account.status === "ACTIVE") await onSuspend();
      else await onResume();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={s.toolbar}>
        <div>
          <h2>Online payments</h2>
          <p>
            Customer order payments settle to your account, minus the applicable
            Paystack and Ehral fees.
          </p>
        </div>
        <button
          className={account.status === "ACTIVE" ? s.dangerButton : s.primary}
          disabled={busy}
          onClick={toggleStatus}
        >
          {busy
            ? "Please wait…"
            : account.status === "ACTIVE"
              ? "Suspend online payments"
              : "Resume online payments"}
        </button>
      </div>

      <div className={s.grid2}>
        <Panel
          title="Payment account"
          sub="Your customer-order settlement setup."
        >
          <div className={s.formGrid}>
            <div className={s.field}>
              <span>Status</span>
              <div>
                <StatusBadge status={account.status} />
              </div>
            </div>
            <div className={s.field}>
              <span>Provider</span>
              <div>{account.provider}</div>
            </div>
            <div className={s.field}>
              <span>Bank</span>
              <div>{account.bankName || "—"}</div>
            </div>
            <div className={s.field}>
              <span>Account number</span>
              <div>{account.accountNumberMasked || "—"}</div>
            </div>
            <div className={s.field}>
              <span>Account name</span>
              <div>{account.accountName || "—"}</div>
            </div>
            <div className={s.field}>
              <span>Terms accepted</span>
              <div>
                v{account.termsVersionAccepted}{" "}
                {account.termsAcceptedAt
                  ? `on ${new Date(account.termsAcceptedAt).toLocaleDateString()}`
                  : ""}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Fee schedule"
          sub="Deducted from every successful order settlement."
        >
          <FeeExplainer terms={terms} money={money} />
        </Panel>
      </div>

      <Panel
        title="Payment summary"
        sub={`Reporting period: ${range.from} to ${range.to}`}
        action={
          <div className={s.dateRange}>
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) =>
                setRange((r) => ({ ...r, from: e.target.value }))
              }
            />
            <input
              type="date"
              value={range.to}
              min={range.from}
              max={today()}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </div>
        }
      >
        {loadingSummary ? (
          <div className={s.loading}>Loading…</div>
        ) : summary ? (
          <div className={s.metrics}>
            <Metric label="Paid orders" value={summary.paidOrderCount} />
            <Metric label="Sales processed" value={money(summary.totalSales)} />
            <Metric
              label="Paystack fees"
              value={money(summary.totalPaystackFees)}
            />
            <Metric label="Ehral fees" value={money(summary.totalEhralFees)} />
            <Metric
              label="Net settlements"
              value={money(summary.totalNetSettlements)}
            />
          </div>
        ) : (
          <div className={s.empty}>
            <p>No payment activity for this period yet.</p>
          </div>
        )}
      </Panel>
    </>
  );
}

function OnlinePayments({ owner, money }) {
  const [terms, setTerms] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [t, a] = await Promise.all([
        getOnlinePaymentTerms(),
        getOnlinePaymentAccountStatus(),
      ]);
      setTerms(t);
      setAccount(a);
    } catch (e) {
      setLoadError(
        e?.response?.data?.message ||
          "Could not load your online payment settings.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className={s.loading}>Loading…</div>;
  if (loadError) return <div className={s.error}>{loadError}</div>;
  if (!owner) {
    return (
      <Panel
        title="Online payments"
        sub="Only the business owner can view and manage payment setup."
      >
        <div className={s.empty}>
          <p>Ask the business owner to enable or manage online payments.</p>
        </div>
      </Panel>
    );
  }

  const needsActivation = !account?.configured || account?.reacceptanceRequired;

  return (
    <>
      {account?.configured && account?.reacceptanceRequired && (
        <div className={s.warning} style={{ marginBottom: 16 }}>
          Ehral's Online Ordering & Payment Terms have been updated to version{" "}
          {terms.termsVersion}. Please review and accept the latest terms to
          keep online payments active.
        </div>
      )}
      {needsActivation ? (
        <ActivationFlow
          terms={terms}
          money={money}
          onActivated={(a) => setAccount(a)}
        />
      ) : (
        <AccountDashboard
          account={account}
          terms={terms}
          money={money}
          onSuspend={async () => setAccount(await suspendOnlinePayments())}
          onResume={async () => setAccount(await resumeOnlinePayments())}
        />
      )}
    </>
  );
}

export { OnlinePayments };
