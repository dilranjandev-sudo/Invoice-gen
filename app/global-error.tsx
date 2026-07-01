"use client";

import { useEffect } from "react";

// Catches errors in the root layout itself. Must render its own <html>/<body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      const last = Number(sessionStorage.getItem("pr_last_retry_g") || "0");
      if (Date.now() - last > 6000) {
        sessionStorage.setItem("pr_last_retry_g", String(Date.now()));
        const t = setTimeout(() => reset(), 1500);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, [reset]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f7f8fa",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Reconnecting…</div>
          <p style={{ marginTop: 6, fontSize: 14, color: "#64748b" }}>One moment — retrying automatically.</p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              background: "#2563eb",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
