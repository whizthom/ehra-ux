import { useEffect, useRef, useState } from "react";

export default function VoiceRecorder({ onSend, onCancel }) {
  const [rec, setRec] = useState(null);
  const mediaRef = useRef(null);

  useEffect(() => {
    let media;
    async function start() {
      try {
        media = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(media);
        mediaRef.current = { media, mr, chunks: [] };
        mr.ondataavailable = (e) => mediaRef.current.chunks.push(e.data);
        mr.onstop = () => {
          const blob = new Blob(mediaRef.current.chunks, {
            type: "audio/webm",
          });
          onSend(blob, Math.round(mediaRef.current.chunks.length || 1));
        };
        mr.start();
        setRec(true);
      } catch (e) {
        setRec(false);
      }
    }
    start();
    return () => {
      if (mediaRef.current) {
        mediaRef.current.mr?.stop();
        mediaRef.current.media?.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <div>Recording…</div>
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => {
            if (mediaRef.current?.mr?.state === "recording")
              mediaRef.current.mr.stop();
          }}
        >
          Stop & Send
        </button>
        <button
          onClick={() => {
            onCancel();
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
