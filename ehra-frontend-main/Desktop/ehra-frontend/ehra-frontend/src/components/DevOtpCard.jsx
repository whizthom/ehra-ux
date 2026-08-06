// Provider-independent OTP rebuild: shown ONLY when the backend's
// otp.provider is "mock" (com.Ehra.otp.impl.MockOtpService) — the `code`
// prop is `confirmationResult.developmentOtp` from ../firebase-lazy,
// which is undefined against any real provider (Termii and beyond), so
// this component renders nothing at all in production. See
// PhoneOtpSendResponseDTO#developmentOtp on the backend for where it
// originates.
//
// Deliberately does NOT auto-fill or auto-submit the code into the
// verification input below it — the person still has to type it in
// manually, exactly like a real SMS flow, so testing this locally
// actually exercises the same code path (and builds the same muscle
// memory / understanding of how OTP works) as production does.
export default function DevOtpCard({ code }) {
  if (!code) {
    return null;
  }

  return (
    <div
      style={{
        border: "1px dashed #f0ad4e",
        background: "#fffaf0",
        borderRadius: 10,
        padding: "14px 16px",
        margin: "0 0 16px",
        fontSize: 13.5,
        lineHeight: 1.5,
        color: "#7a4a00",
      }}
      role="status"
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        🧪 Development Mode
      </div>
      <div style={{ marginBottom: 8 }}>
              Normally this verification code would be sent to your phone.
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.15em",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          margin: "4px 0 8px",
        }}
      >
        {code}
      </div>
      <div>Please type this code into the verification box below.</div>
    </div>
  );
}
