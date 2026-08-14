export default function TypingIndicator({ who }) {
  return (
    <div
      style={{
        fontSize: 13,
        color: "var(--text-secondary)",
        padding: "6px 12px",
      }}
    >
      {who} is typing…
    </div>
  );
}
