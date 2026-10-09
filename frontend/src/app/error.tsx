// Error boundary for pages: a clear message and a retry button instead of a blank screen.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { useEffect } from "react";
import { PageHero } from "@/components/PageHero";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PageHero
      tone="sky" icon="alert" eyebrow="Something went wrong" note="not your fault"
      title={<>This page could <span className="marker">not load</span></>}
      lead="The server may be busy or briefly offline. Try again in a moment."
    >
      <button className="btn btn-primary btn-large" type="button" onClick={() => retry()}>Try again</button>
      <Link className="btn" href="/">Back to the homepage</Link>
    </PageHero>
  );
}
