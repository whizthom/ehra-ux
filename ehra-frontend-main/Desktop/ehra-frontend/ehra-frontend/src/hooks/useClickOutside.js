import { useEffect } from "react";

// Closes a popup on a real "tap/click anywhere outside it" — not
// onMouseLeave, which every popup in the messaging UI was using before
// this. onMouseLeave doesn't fire at all on touch devices (mobile/tablet
// have no mouse), and even on desktop it closes a popup the instant the
// cursor drifts a pixel outside its bounds while aiming for a button near
// the edge — both of which make it a poor fit for "click outside to
// dismiss."
//
// `refs` may be one ref or an array of refs — pass the popup's own ref
// AND its trigger button's ref together (or wrap both in one shared
// container and pass that single ref) so clicking the trigger button
// itself isn't misread as "outside" and doesn't close-then-immediately
// reopen the popup on every toggle click.
export default function useClickOutside(refs, onOutside, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const list = Array.isArray(refs) ? refs : [refs];

    const handlePointerDown = (event) => {
      const isInside = list.some((ref) => ref.current && ref.current.contains(event.target));
      if (isInside) return;
      onOutside(event);
    };

    // mousedown (not click) so this fires before a trigger button's own
    // onClick handler runs on the SAME interaction, keeping ordering
    // predictable; touchstart covers mobile/tablet, where mousedown never
    // fires at all.
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [refs, onOutside, active]);
}