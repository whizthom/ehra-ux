import { Component } from "react";

// The app previously had NO error boundary anywhere — a single uncaught
// render error on any page (see InvitationLanding's old unguarded
// `businessName.split(" ")`, which threw whenever a token matched no
// invitation and the backend's error response didn't carry the expected
// {valid, businessName} shape) unmounted the ENTIRE React tree, leaving a
// blank white page with no way to recover short of manually retyping the
// URL. This wraps the whole app so that class of bug degrades to a
// friendly, recoverable screen instead.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Swap for real error reporting (Sentry, etc.) when one is wired up.
    console.error("Unhandled error caught by ErrorBoundary:", error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 32,
          textAlign: "center",
          background: "#0b1f1a",
          fontFamily:
            '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(240, 149, 149, 0.12)",
            border: "0.5px solid rgba(240, 149, 149, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
          }}
        >
          ⚠️
        </div>
        <h1
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontWeight: 550,
            fontSize: 22,
            color: "#fff",
            margin: 0,
          }}
        >
          Something went wrong
        </h1>
        <p style={{ color: "#8fa8a0", fontSize: 14, maxWidth: 380, margin: 0 }}>
          This page hit an unexpected error. Reloading usually fixes it — if it
          keeps happening, please let us know what you were doing.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            marginTop: 8,
            height: 44,
            padding: "0 22px",
            background: "#0f6e56",
            border: "none",
            borderRadius: 10,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Reload page
        </button>
      </div>
    );
  }
}
