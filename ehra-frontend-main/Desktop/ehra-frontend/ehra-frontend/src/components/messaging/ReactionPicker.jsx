import styles from "./ReactionPicker.module.css";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function ReactionPicker({ onPick, onClose }) {
  return (
    <div className={styles.wrap} onMouseLeave={onClose}>
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          className={styles.emojiBtn}
          onClick={() => onPick(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
