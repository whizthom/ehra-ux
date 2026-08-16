import styles from "./ChatWindow.module.css";

export default function TypingIndicator({ users }) {
  if (!users || users.length === 0) return null;
  const text =
    users.length === 1
      ? `${users[0].name} is typing…`
      : users.length === 2
        ? `${users[0].name} and ${users[1].name} are typing…`
        : `${users[0].name} and ${users.length - 1} others are typing…`;
  return (
    <div className={styles.typingRow}>
      <span className={styles.typingBubble}>
        <span className={styles.typingDots}>
          <i />
          <i />
          <i />
        </span>
        {text}
      </span>
    </div>
  );
}
