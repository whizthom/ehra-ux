import styles from "./ChatWindow.module.css";
import { formatDayLabel } from "../../utils/messagingFormat";

export default function DateSeparator({ date }) {
  return (
    <div className={styles.dateSeparator}>
      <span>{formatDayLabel(date)}</span>
    </div>
  );
}
