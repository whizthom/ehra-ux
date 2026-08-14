import styles from "./Avatar.module.css";

export default function Avatar({ name, src, size = 40 }) {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
    : "U";
  return (
    <div className={styles.avatar} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name || "avatar"} className={styles.img} />
      ) : (
        <span className={styles.initials}>{initials}</span>
      )}
    </div>
  );
}
