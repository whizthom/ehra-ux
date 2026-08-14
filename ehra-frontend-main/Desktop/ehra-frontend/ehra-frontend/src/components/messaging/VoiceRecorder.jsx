import { useEffect, useRef, useState } from "react";
import { formatDuration } from "../../utils/messagingFormat";
import styles from "./MessageComposer.module.css";

// Record / stop / cancel / send a voice note (section 6). Uses the
// browser's native MediaRecorder — no extra dependency needed. Produces a
// webm/opus blob on Chrome/Edge/Firefox and falls back to whatever
// mime type the browser reports as supported (Safari uses mp4/aac).
export default function VoiceRecorder({ onCancel, onSend }) {
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
          window.MediaRecorder?.isTypeSupported?.(t),
        );
        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType } : undefined,
        );
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start();
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      } catch {
        setError("Microphone access was denied or unavailable.");
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopRecording = () =>
    new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
        return;
      }
      recorder.onstop = () =>
        resolve(
          new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          }),
        );
      recorder.stop();
    });

  const handleCancel = async () => {
    clearInterval(timerRef.current);
    await stopRecording();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCancel();
  };

  const handleSend = async () => {
    clearInterval(timerRef.current);
    const blob = await stopRecording();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (blob.size > 0) onSend(blob, seconds);
    else onCancel();
  };

  if (error) {
    return (
      <div className={styles.voiceRecorderBar}>
        <span className={styles.voiceError}>{error}</span>
        <button className={styles.voiceCancelBtn} onClick={onCancel}>
          <i className="ti ti-x" />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.voiceRecorderBar}>
      <button
        className={styles.voiceCancelBtn}
        onClick={handleCancel}
        title="Cancel"
      >
        <i className="ti ti-trash" />
      </button>
      <span className={styles.recordingDot} />
      <span className={styles.recordingTime}>{formatDuration(seconds)}</span>
      <span className={styles.recordingHint}>Recording…</span>
      <button className={styles.voiceSendBtn} onClick={handleSend} title="Send">
        <i className="ti ti-send" />
      </button>
    </div>
  );
}
