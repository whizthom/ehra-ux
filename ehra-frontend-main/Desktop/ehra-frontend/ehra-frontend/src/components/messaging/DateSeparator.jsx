import styles from "./ChatWindow.module.css";

// Receives the ALREADY-COMPUTED label (see ChatWindow.jsx's `grouped`,
// which calls formatDayLabel(message.createdAt) once per date change) —
// deliberately not a raw date reformatted here a second time. This used
// to take a `date` prop and call formatDayLabel(date) itself, but the
// caller was passing it the label STRING ("TODAY"), not a real date,
// since a date-type group item has no `.message` to read a real
// createdAt off of. formatDayLabel("TODAY") -> `new Date("TODAY")` ->
// Invalid Date -> "" — so every separator in an open conversation was
// silently rendering as a blank pill, even though the underlying
// day-grouping logic itself was correct the whole time.
export default function DateSeparator({ label }) {
  return (
    <div className={styles.dateSeparator}>
      <span>{label}</span>
    </div>
  );
}
