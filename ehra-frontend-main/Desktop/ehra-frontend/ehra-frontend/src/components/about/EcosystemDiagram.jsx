import styles from "./EcosystemDiagram.module.css";

const NODES = [
  {
    key: "businesses",
    icon: "ti-building-store",
    label: "Businesses",
    pos: "top",
  },
  { key: "employees", icon: "ti-users", label: "Employees", pos: "right" },
  {
    key: "customers",
    icon: "ti-heart-handshake",
    label: "Customers",
    pos: "bottom",
  },
  {
    key: "network",
    icon: "ti-network",
    label: "Other businesses",
    pos: "left",
  },
];

// Endpoint coordinates on a 320×320 canvas, matching the four CSS-positioned
// nodes below — kept in sync manually since the connecting lines are SVG.
const LINES = {
  top: "M160,160 L160,42",
  right: "M160,160 L278,160",
  bottom: "M160,160 L160,278",
  left: "M160,160 L42,160",
};

/**
 * "One platform connecting the people and organizations that make
 * business happen." Center node is Ehral; four satellites are the
 * relationships it's built (today) and is building toward (vision) —
 * pass `subdued` on a node's data if a section wants to gray out the
 * not-yet-live relationships, but by default all four render at equal
 * weight since this is explicitly a vision diagram, labelled as such by
 * the section around it.
 */
export default function EcosystemDiagram() {
  return (
    <div className={styles.canvas}>
      <svg viewBox="0 0 320 320" className={styles.lines} aria-hidden="true">
        {Object.values(LINES).map((d) => (
          <path key={d} d={d} className={styles.line} />
        ))}
      </svg>

      <div className={styles.center}>
        <i className="ti ti-hexagon-letter-e" />
        <span>Ehral</span>
      </div>

      {NODES.map((node) => (
        <div key={node.key} className={`${styles.node} ${styles[node.pos]}`}>
          <i className={`ti ${node.icon}`} aria-hidden="true" />
          <span>{node.label}</span>
        </div>
      ))}
    </div>
  );
}
