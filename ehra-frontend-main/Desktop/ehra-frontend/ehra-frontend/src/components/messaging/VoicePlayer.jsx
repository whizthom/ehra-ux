import { useRef, useState } from "react";
import { formatDuration } from "../../utils/messagingFormat";
import styles from "./MessageBubble.module.css";

export default function VoicePlayer({ url, durationSeconds }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  return (
    <div className={styles.voicePlayer}>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const d = e.currentTarget.duration || durationSeconds || 1;
          setProgress(e.currentTarget.currentTime / d);
        }}
      />
      <button className={styles.voicePlayBtn} onClick={toggle}>
        {/* Tabler's webfont only ships a dedicated "-filled" class for
            icons that have a genuinely separate filled artwork (like
            circle-check-filled) — player-play/player-pause don't have
            one, so "ti-player-play-filled" simply doesn't exist as a
            class and resolved to no glyph at all, leaving just the
            colored circle with nothing inside it. Plain ti-player-play /
            ti-player-pause are the real, guaranteed-to-exist names. */}
        <i className={playing ? "ti ti-player-pause" : "ti ti-player-play"} />
      </button>
      <div className={styles.voiceWave}>
        <div
          className={styles.voiceWaveFill}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className={styles.voiceDuration}>
        {formatDuration(durationSeconds)}
      </span>
    </div>
  );
}
