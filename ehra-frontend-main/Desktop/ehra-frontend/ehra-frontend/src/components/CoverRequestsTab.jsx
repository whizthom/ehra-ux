import { useState, useEffect, useCallback } from "react";
import { getMyCoverRequests, respondToCover } from "../api/leaveApi";
import useMessageStream from "../hooks/useMessageStream";
import { useAuth } from "../context/AuthContext";
import {
  leaveTypeLabel,
  LEAVE_TYPE_ICON,
  leaveStatusConfig,
  formatDate,
  timeAgo,
  initials,
} from "../utils/leaveHelpers";
import styles from "./CoverRequestsTab.module.css";

// Statuses that mean "still waiting on my response".
const PENDING_STATUS = "PENDING_COVER";

// Everything the requester passed through after I responded — shown in
// "History" so I can see what eventually happened to a request I acted on.
const HISTORY_STATUSES = [
  "COVER_DECLINED",
  "PENDING_HOD",
  "PENDING_EMPLOYER",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

// One nominated-cover card, in either "awaiting my response" or read-only
// history mode.
function CoverCard({ leave, onRespond, responding }) {
  const [mode, setMode] = useState(null); // null | "decline"
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const isPending = leave.status === PENDING_STATUS;
  const typeIcon = LEAVE_TYPE_ICON[leave.leaveType] || "ti-calendar";
  const name = [leave.employeeFirstName, leave.employeeLastName]
    .filter(Boolean)
    .join(" ");

  const submitAccept = () => {
    onRespond(leave.id, true, note.trim() || undefined);
  };

  const submitDecline = () => {
    if (!note.trim()) {
      setError("Please tell them why you can't cover — this is required.");
      return;
    }
    setError("");
    onRespond(leave.id, false, note.trim());
  };

  const isBusy = responding === leave.id;

  return (
    <div className={`${styles.card} ${isPending ? styles.cardPending : ""}`}>
      <div className={styles.cardTop}>
        <div className={styles.avatar}>
          {leave.employeeProfilePictureUrl ? (
            <img src={leave.employeeProfilePictureUrl} alt="" />
          ) : (
            initials(leave.employeeFirstName, leave.employeeLastName)
          )}
        </div>
        <div className={styles.cardTopInfo}>
          <span className={styles.cardName}>{name}</span>
          <span className={styles.cardDept}>{leave.department || "—"}</span>
        </div>
        {!isPending && (
          <span
            className={styles.statusPill}
            style={{
              background: leaveStatusConfig(leave.status).bg,
              color: leaveStatusConfig(leave.status).color,
            }}
          >
            <i className={`ti ${leaveStatusConfig(leave.status).icon}`} />
            {leaveStatusConfig(leave.status).label}
          </span>
        )}
      </div>

      <div className={styles.cardMeta}>
        <span className={styles.typeBadge}>
          <i className={`ti ${typeIcon}`} />
          {leaveTypeLabel(leave.leaveType)}
        </span>
        <span className={styles.dateRange}>
          <i className="ti ti-calendar" />
          {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
          <span className={styles.daysBadge}>{leave.days}d</span>
        </span>
      </div>

      <div className={styles.reasonBox}>
        <p className={styles.reasonLabel}>Their reason</p>
        <p className={styles.reasonText}>{leave.reason}</p>
      </div>

      <div className={styles.cardFooter}>
        <span className={styles.timeAgo}>
          <i className="ti ti-clock" /> Requested {timeAgo(leave.createdAt)}
        </span>
      </div>

      {isPending && (
        <div className={styles.actions}>
          {mode === "decline" ? (
            <div className={styles.declineBox}>
              {error && <div className={styles.errorText}>{error}</div>}
              <label className={styles.declineLabel}>
                Reason for declining <span className={styles.req}>*</span>
              </label>
              <textarea
                rows={3}
                autoFocus
                placeholder="e.g. I'll be travelling that week too…"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (error) setError("");
                }}
              />
              <div className={styles.declineBtns}>
                <button
                  type="button"
                  className={styles.cancelSmallBtn}
                  onClick={() => {
                    setMode(null);
                    setNote("");
                    setError("");
                  }}
                  disabled={isBusy}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={styles.declineConfirmBtn}
                  onClick={submitDecline}
                  disabled={isBusy}
                >
                  {isBusy ? "Sending…" : "Confirm decline"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={styles.acceptBtn}
                onClick={submitAccept}
                disabled={isBusy}
              >
                <i className="ti ti-check" />
                {isBusy ? "Accepting…" : "Accept & cover"}
              </button>
              <button
                type="button"
                className={styles.declineBtn}
                onClick={() => setMode("decline")}
                disabled={isBusy}
              >
                <i className="ti ti-x" />
                Decline
              </button>
            </>
          )}
        </div>
      )}

      {!isPending && leave.coverNote && (
        <div className={styles.myNoteBox}>
          <p className={styles.reasonLabel}>Your note</p>
          <p className={styles.reasonText}>"{leave.coverNote}"</p>
        </div>
      )}
    </div>
  );
}

// Replaces nothing — this is a brand-new surface. Any employee can be
// nominated as a cover person by a colleague requesting leave, regardless
// of role or department, so this tab is visible to every employee (not
// gated behind isHod like Workforce/Departments).
export default function CoverRequestsTab() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [responding, setResponding] = useState(null);
  const [actionError, setActionError] = useState("");

  const fetchMine = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getMyCoverRequests();
      setLeaves(data);
    } catch (err) {
      console.error("Failed to load cover requests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  // Live update — patch this cover person's list in place, no refresh
  // needed. Only react to leaves where I'm the nominated cover person, so
  // this connection doesn't get chatty about unrelated leave events.
  useMessageStream({
    onLeaveUpdate: (leave) => {
      if (!leave || !user?.membershipId) return;
      if (leave.coverPersonId !== user.membershipId) return;
      setLeaves((prev) => {
        const exists = prev.some((l) => l.id === leave.id);
        if (exists) return prev.map((l) => (l.id === leave.id ? leave : l));
        return [leave, ...prev];
      });
    },
  });

  const pending = leaves.filter((l) => l.status === PENDING_STATUS);
  const history = leaves
    .filter((l) => HISTORY_STATUSES.includes(l.status))
    .sort(
      (a, b) =>
        new Date(b.coverRespondedAt || b.createdAt) -
        new Date(a.coverRespondedAt || a.createdAt),
    );

  const handleRespond = async (id, accepted, note) => {
    setActionError("");
    setResponding(id);
    try {
      const { data } = await respondToCover(id, { accepted, note });
      setLeaves((prev) => prev.map((l) => (l.id === id ? data : l)));
      setTab(accepted || !accepted ? "pending" : tab);
    } catch (err) {
      setActionError(
        err?.response?.data?.message ||
          err?.response?.data ||
          "Couldn't submit your response. Please try again.",
      );
    } finally {
      setResponding(null);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Cover requests</h2>
          <p className={styles.subtitle}>
            Colleagues who've nominated you to cover their duties while they're
            on leave.
          </p>
        </div>
        {pending.length > 0 && (
          <span className={styles.headerBadge}>
            {pending.length} awaiting your response
          </span>
        )}
      </div>

      {actionError && <div className={styles.errorBox}>{actionError}</div>}

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === "pending" ? styles.tabActive : ""}`}
          onClick={() => setTab("pending")}
        >
          <i className="ti ti-clock" /> Needs your response
          {pending.length > 0 && (
            <span className={styles.tabCount}>{pending.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === "history" ? styles.tabActive : ""}`}
          onClick={() => setTab("history")}
        >
          <i className="ti ti-history" /> History
          {history.length > 0 && (
            <span className={styles.tabCount}>{history.length}</span>
          )}
        </button>
      </div>

      {loading ? (
        <div className={styles.emptyState}>
          <i className="ti ti-loader-2" />
          <p>Loading cover requests…</p>
        </div>
      ) : tab === "pending" ? (
        pending.length === 0 ? (
          <div className={styles.emptyState}>
            <i className="ti ti-shield-check" />
            <p className={styles.emptyTitle}>You're all caught up</p>
            <p className={styles.emptySub}>
              No one currently needs you to cover for them.
            </p>
          </div>
        ) : (
          <div className={styles.grid}>
            {pending.map((l) => (
              <CoverCard
                key={l.id}
                leave={l}
                onRespond={handleRespond}
                responding={responding}
              />
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <div className={styles.emptyState}>
          <i className="ti ti-history" />
          <p className={styles.emptyTitle}>No history yet</p>
          <p className={styles.emptySub}>
            Cover requests you've responded to will show up here.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {history.map((l) => (
            <CoverCard
              key={l.id}
              leave={l}
              onRespond={handleRespond}
              responding={responding}
            />
          ))}
        </div>
      )}
    </div>
  );
}
