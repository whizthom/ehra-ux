import styles from "./MessageComposer.module.css";

const EMOJI_GRID = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "😘",
  "😉",
  "😎",
  "🤔",
  "😢",
  "😭",
  "😡",
  "😱",
  "🙏",
  "👍",
  "👎",
  "👏",
  "🙌",
  "💪",
  "❤️",
  "🎉",
  "🔥",
  "✅",
  "❌",
  "⚠️",
  "📌",
  "📎",
  "💯",
  "🤝",
];

export default function EmojiPicker({ onPick, onClose }) {
  return (
    <div className={styles.emojiPickerPanel} onMouseLeave={onClose}>
      <div className={styles.emojiGrid}>
        {EMOJI_GRID.map((e) => (
          <button key={e} type="button" onClick={() => onPick(e)}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
