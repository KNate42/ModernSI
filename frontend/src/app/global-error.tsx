// Last-resort error page when the root layout itself fails; it carries its own minimal styles in the palette (navy, butter, cream).
// This work made by Anfinogentov Nikita
"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#12243C", color: "#F0F0EA", fontFamily: "system-ui, sans-serif" }}>
        <title>ModernSI is unavailable</title>
        <div style={{ margin: 16, padding: 28, maxWidth: 480, border: "3px solid #FCEAA8", borderRadius: 22, background: "#183048", boxShadow: "6px 6px 0 #5A9CA4" }}>
          <h1 style={{ margin: "0 0 12px", fontSize: "2rem", lineHeight: 1.05, fontWeight: 800 }}>ModernSI is briefly unavailable</h1>
          <p style={{ margin: "0 0 24px", color: "#C9D6E4" }}>Please try again in a minute.</p>
          <button type="button" onClick={() => retry()} style={{ minHeight: 48, padding: "12px 24px", borderRadius: 999, border: "3px solid #F0F0EA", background: "#FCEAA8", color: "#12243C", font: "inherit", fontWeight: 800, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
