import styles from "./Avatar.module.css";

function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function Avatar({
  name,
  src,
  size = 44,
  online,
  showPresence = false,
}) {
  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt="" className={styles.img} />
      ) : (
        <div className={styles.fallback} style={{ fontSize: size * 0.4 }}>
          {initialsOf(name)}
        </div>
      )}
      {showPresence && (
        <span
          className={`${styles.presenceDot} ${online ? styles.online : styles.offline}`}
        />
      )}
    </div>
  );
}
