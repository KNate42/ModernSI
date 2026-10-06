// Last-resort error page when the root layout itself fails; it carries its own minimal styles.
// This work made by Anfinogentov Nikita
"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#16123B", color: "#F0EDFF", fontFamily: "system-ui, sans-serif" }}>
        <title>ModernSI is unavailable</title>
        <div style={{ padding: 24, maxWidth: 480 }}>
          <h1>ModernSI is briefly unavailable</h1>
          <p style={{ color: "#B9B3E6" }}>Please try again in a minute.</p>
          <button type="button" onClick={() => retry()} style={{ padding: "12px 20px", borderRadius: 999, border: 0, background: "#8D70FF", color: "#12103A", fontWeight: 700 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
