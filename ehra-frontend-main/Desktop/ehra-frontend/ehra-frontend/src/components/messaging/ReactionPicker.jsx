export default function ReactionPicker({ onPick, onClose }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: 6,
        background: "var(--bg-card,#fff)",
        borderRadius: 8,
      }}
    >
      {["👍", "❤️", "👏", "😂", "😮"].map((e) => (
        <button
          key={e}
          onClick={() => {
            onPick(e);
          }}
        >
          {e}
        </button>
      ))}
      <button onClick={onClose}>x</button>
    </div>
  );
}
