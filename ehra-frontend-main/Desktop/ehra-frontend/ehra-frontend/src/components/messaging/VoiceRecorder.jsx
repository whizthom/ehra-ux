import { useEffect, useRef, useState } from "react";
import { formatDuration } from "../../utils/messagingFormat";
import styles from "./MessageComposer.module.css";

// Record / stop / cancel / send a voice note (section 6). Uses the
// browser's native MediaRecorder — no extra dependency needed. Produces a
// webm/opus blob on Chrome/Edge/Firefox and falls back to whatever
// mime type the browser reports as supported (Safari uses mp4/aac).
const MAX_DURATION_SECONDS = 300; // 5 minutes
const WARNING_AT_SECONDS = MAX_DURATION_SECONDS - 30; // last 30s gets a visible warning

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

  // Auto-stops (and sends whatever was captured) once the cap is hit,
  // rather than letting someone record indefinitely and then discover
  // the failure only at upload time — MsgAttachmentServiceImpl's own
  // 20MB voice-note limit is what this cap is really protecting against,
  // since an unbounded recording eventually exceeds it regardless of
  // codec/bitrate.
  useEffect(() => {
    if (seconds >= MAX_DURATION_SECONDS) {
      handleSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const nearLimit = seconds >= WARNING_AT_SECONDS;

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
      <span
        className={`${styles.recordingTime} ${nearLimit ? styles.recordingTimeWarning : ""}`}
      >
        {formatDuration(seconds)}
      </span>
      <span className={styles.recordingHint}>
        {nearLimit
          ? `Max ${formatDuration(MAX_DURATION_SECONDS)} — sending soon`
          : "Recording…"}
      </span>
      <button className={styles.voiceSendBtn} onClick={handleSend} title="Send">
        <i className="ti ti-send" />
      </button>
    </div>
  );
}
