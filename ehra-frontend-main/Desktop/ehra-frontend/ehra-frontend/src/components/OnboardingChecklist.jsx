import { useEffect, useMemo, useState } from "react";
import { getEmailStatus } from "../api/phoneAuthApi";
import styles from "./OnboardingChecklist.module.css";

const DISMISS_KEY = (identityId) =>
  `ehra:onboardingChecklist:hidden:${identityId}`;

/**
 * "Complete your workspace" — persistent (not a one-time toast like
 * WelcomeCard) until every item is done, then it hides itself for good.
 * Phone verification, business creation, and registration itself are
 * always true by the time this can even render (Ehra's registration
 * flow enforces all three before an Identity/Business exist at all) —
 * they're listed anyway so the person sees real, completed progress
 * immediately rather than starting from 0%.
 *
 * Reuses data Dashboard has already fetched (businessProfile, employees,
 * myProfile) rather than issuing new calls for those — only email
 * verification status is fetched here, since Dashboard doesn't otherwise
 * need it.
 */
export default function OnboardingChecklist({
  identityId,
  businessProfile,
  employees,
  profilePictureUrl,
}) {
  const [emailVerified, setEmailVerified] = useState(false);
  const [hidden, setHidden] = useState(
    () =>
      identityId != null &&
      window.localStorage.getItem(DISMISS_KEY(identityId)) === "1",
  );

  useEffect(() => {
    if (hidden) return;
    getEmailStatus()
      .then((status) => setEmailVerified(Boolean(status?.emailVerified)))
      .catch(() => {});
  }, [hidden]);

  const items = useMemo(
    () => [
      { key: "phone", label: "Verify Phone", done: true },
      { key: "business", label: "Create Business", done: true },
      { key: "registration", label: "Complete Registration", done: true },
      { key: "email", label: "Verify Email", done: emailVerified },
      {
        key: "profilePicture",
        label: "Upload Profile Picture",
        done: Boolean(profilePictureUrl),
      },
      {
        key: "businessLogo",
        label: "Upload Business Logo",
        done: Boolean(businessProfile?.logo),
      },
      {
        key: "firstEmployee",
        label: "Add First Employee",
        done: (employees?.length || 0) > 0,
      },
    ],
    [emailVerified, profilePictureUrl, businessProfile, employees],
  );

  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const complete = doneCount === items.length;

  useEffect(() => {
    if (complete && identityId != null) {
      window.localStorage.setItem(DISMISS_KEY(identityId), "1");
    }
  }, [complete, identityId]);

  if (hidden || complete) return null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Welcome to Ehra!</h3>
          <p className={styles.subtitle}>Complete your workspace</p>
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          aria-label="Hide checklist"
          onClick={() => {
            setHidden(true);
            if (identityId != null) {
              window.localStorage.setItem(DISMISS_KEY(identityId), "1");
            }
          }}
        >
          <i className="ti ti-x" />
        </button>
      </div>

      <div className={styles.progressRow}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.progressPct}>{pct}%</span>
      </div>

      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.key} className={styles.item}>
            <i
              className={
                item.done
                  ? "ti ti-square-rounded-check"
                  : "ti ti-square-rounded"
              }
              style={{ color: item.done ? "#0f6e56" : "#9aada8" }}
            />
            <span className={item.done ? styles.itemDone : undefined}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
