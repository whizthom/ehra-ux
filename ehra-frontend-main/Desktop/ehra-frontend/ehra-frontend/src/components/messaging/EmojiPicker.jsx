export default function EmojiPicker({ onSelect }) {
  return (
    <div style={{ padding: 8 }}>
      <button type="button" onClick={() => onSelect("👍")}>
        👍
      </button>
      <button type="button" onClick={() => onSelect("😂")}>
        😂
      </button>
      <button type="button" onClick={() => onSelect("🎉")}>
        🎉
      </button>
    </div>
  );
}
