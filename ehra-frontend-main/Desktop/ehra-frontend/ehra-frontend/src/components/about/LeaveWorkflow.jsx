import styles from "./LeaveWorkflow.module.css";

const LANE = [
  {
    icon: "ti-user",
    role: "Employee",
    note: "Submits request",
    status: "Sent",
  },
  {
    icon: "ti-user-shield",
    role: "Cover person",
    note: "Confirms availability",
    status: "Confirmed",
  },
  {
    icon: "ti-users-group",
    role: "HOD",
    note: "Reviews the request",
    status: "Reviewed",
  },
  {
    icon: "ti-briefcase",
    role: "Employer",
    note: "Makes the final call",
    status: "Approved",
  },
  {
    icon: "ti-bell",
    role: "Everyone",
    note: "Notified automatically",
    status: "Done",
  },
];

/**
 * Dedicated visual for "Leave shouldn't require a WhatsApp conversation" —
 * shows the structured request lane (employee → cover person → HOD →
 * employer → notification) as a distinct component from the generic
 * WorkflowDiagram, since this one carries roles + per-step status chips
 * rather than a plain sequence of icons.
 */
export default function LeaveWorkflow() {
  return (
    <div className={styles.lane}>
      {LANE.map((stop, i) => (
        <div className={styles.stop} key={stop.role}>
          <div className={styles.avatar}>
            <i className={`ti ${stop.icon}`} />
          </div>
          <span className={styles.role}>{stop.role}</span>
          <span className={styles.note}>{stop.note}</span>
          <span className={styles.status}>{stop.status}</span>
          {i < LANE.length - 1 && (
            <span className={styles.dashLine} aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}
