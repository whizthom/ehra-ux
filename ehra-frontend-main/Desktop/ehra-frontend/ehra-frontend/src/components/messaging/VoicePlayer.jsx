export default function VoicePlayer({ url, durationSeconds }) {
  return (
    <div className="voicePlayer">
      <audio controls src={url} />
      <span className="voiceDuration">
        {durationSeconds ? Math.round(durationSeconds) + "s" : ""}
      </span>
    </div>
  );
}
