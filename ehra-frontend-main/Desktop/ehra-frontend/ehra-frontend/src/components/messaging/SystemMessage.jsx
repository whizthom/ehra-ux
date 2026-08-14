export default function SystemMessage({ message }) {
  return (
    <div style={{ textAlign: "center", padding: "6px 0" }}>
      <div
        style={{
          display: "inline-block",
          background: "var(--bg-surface-alt)",
          padding: "6px 12px",
          borderRadius: 999,
          color: "var(--text-secondary)",
        }}
      >
        {message.body}
      </div>
    </div>
  );
}
