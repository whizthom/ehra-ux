import styles from "./WorkflowDiagram.module.css";

/**
 * Generic connected-step diagram. Give it an ordered list of steps and it
 * draws them as nodes joined by a line/arrow — horizontal on wide
 * screens, vertical on narrow ones. Used wherever the copy describes a
 * sequence (the "scattered tools → one platform" transformation, the
 * "today → tomorrow" vision shift) without needing a bespoke diagram
 * component for each one.
 */
export default function WorkflowDiagram({ steps, endGlow = false }) {
  return (
    <div className={styles.row}>
      {steps.map((step, i) => (
        <div className={styles.stepWrap} key={step.label}>
          <div
            className={`${styles.node} ${endGlow && i === steps.length - 1 ? styles.nodeEnd : ""}`}
          >
            {step.icon && (
              <i className={`ti ${step.icon}`} aria-hidden="true" />
            )}
            <span className={styles.nodeLabel}>{step.label}</span>
            {step.sublabel && (
              <span className={styles.nodeSub}>{step.sublabel}</span>
            )}
          </div>
          {i < steps.length - 1 && (
            <span className={styles.arrow} aria-hidden="true">
              <i className="ti ti-arrow-narrow-right" />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
