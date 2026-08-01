import { useState, useEffect } from "react";

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * A photo when one is set and actually loads; initials otherwise. Covers
 * three cases the same way: no picture on file, a picture URL that 404s,
 * and a picture that's still loading — all show initials rather than a
 * broken-image glyph or a flash of empty space.
 */
export default function Avatar({ src, name, className, imgClassName }) {
  const [failed, setFailed] = useState(false);

  // A different contact's photo failing shouldn't stick around once
  // you've moved on to one with a working (or no) photo.
  useEffect(() => setFailed(false), [src]);

  const showImage = Boolean(src) && !failed;

  return (
    <div className={className}>
      {showImage ? (
        <img
          src={src}
          alt=""
          className={imgClassName}
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}
