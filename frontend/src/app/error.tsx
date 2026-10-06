// Error boundary for pages: a clear message and a retry button instead of a blank screen.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="wrap page-head">
      <p className="eyebrow">Something went wrong</p>
      <h1>This page could not load</h1>
      <p>The hub may be busy or briefly offline. Try again in a moment.</p>
      <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn btn-primary" type="button" onClick={() => retry()}>Try again</button>
        <Link className="btn" href="/">Back to the hub</Link>
      </p>
    </div>
  );
}
