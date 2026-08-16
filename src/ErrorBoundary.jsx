import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Shows up in the browser console so it's easy to diagnose from DevTools.
    console.error("Manga Store crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F3EFE4",
            color: "#17181C",
            fontFamily: "system-ui, sans-serif",
            padding: 24,
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 480 }}>
            <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#6b665b", marginBottom: 16 }}>
              The store hit an error instead of loading. Open your browser's DevTools
              (F12) → Console tab to see the details, or reload the page.
            </p>
            <pre
              style={{
                fontSize: 12,
                textAlign: "left",
                background: "#fff",
                border: "1px solid #d9d3c4",
                borderRadius: 4,
                padding: 12,
                overflowX: "auto",
              }}
            >
              {String(this.state.error && this.state.error.message)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                background: "#C1272D",
                color: "#F3EFE4",
                border: "none",
                padding: "10px 20px",
                borderRadius: 3,
                fontWeight: 700,
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
