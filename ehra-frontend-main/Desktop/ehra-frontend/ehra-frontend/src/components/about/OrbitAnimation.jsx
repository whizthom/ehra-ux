import Logo from "../../components/Logo";
import styles from "./OrbitAnimation.module.css";

function OrbitIcon({ type }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  switch (type) {
    case "employees":
      return (
        <svg {...commonProps} className={styles.nodeIcon}>
          <path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" />
          <circle cx="10" cy="7" r="3.2" />
          <path d="M17.5 9.5a3 3 0 0 1 0 5.8M20.5 7.5a2.5 2.5 0 1 1 0 5" />
        </svg>
      );
    case "customers":
      return (
        <svg {...commonProps} className={styles.nodeIcon}>
          <path d="M3.5 18.5a7 7 0 0 1 14 0" />
          <circle cx="10.5" cy="8" r="3.2" />
          <path d="M15.5 18.5v-1a3.5 3.5 0 0 1 3.5-3.5h.5" />
          <path d="M19.5 5.5a2.5 2.5 0 1 1 0 5" />
        </svg>
      );
    case "business":
      return (
        <svg {...commonProps} className={styles.nodeIcon}>
          <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
          <path d="M8 6V4.5M16 6V4.5M4 11.5h16" />
        </svg>
      );
    case "partners":
      return (
        <svg {...commonProps} className={styles.nodeIcon}>
          <path d="M7.5 18V9.5A2.5 2.5 0 0 1 10 7h4a2.5 2.5 0 0 1 2.5 2.5V18" />
          <path d="M5 18h14" />
          <path d="M10.5 7V5.5M13.5 7V5.5M9 12h6M9 15h6" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps} className={styles.nodeIcon}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}

export default function OrbitAnimation() {
  const items = [
    { key: "employees", label: "Employees", color: "#dff7d8" },
    { key: "customers", label: "Customers", color: "#fce7b1" },
    { key: "business", label: "Business", color: "#d2ebff" },
    { key: "partners", label: "Other businesses", color: "#e8ddff" },
  ];

  return (
    <div className={styles.stage}>
      <div className={styles.orbitWrap}>
        <div
          className={styles.orbitContainer}
          role="img"
          aria-label="Ehral at center with Employees, Customers, Business and Other businesses orbiting around it"
        >
          <div className={styles.center}>
            <Logo variant="stacked" size={84} />
          </div>

          <div className={styles.orbitRing} aria-hidden="true" />

          <div className={styles.orbit} aria-hidden={false}>
            {items.map((it, i) => (
              <div
                key={it.key}
                className={styles.orbitItem}
                style={{
                  ["--angle"]: `${(i / items.length) * 360}deg`,
                  ["--color"]: it.color,
                }}
              >
                <div className={styles.node}>
                  <div
                    className={styles.nodeDot}
                    style={{ background: it.color }}
                    aria-hidden="true"
                  >
                    <OrbitIcon type={it.key} />
                  </div>
                  <div className={styles.nodeLabel} aria-hidden="false">
                    {it.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <ul className={styles.srOnly} aria-hidden="false">
            {items.map((it) => (
              <li key={it.key}>{it.label}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
