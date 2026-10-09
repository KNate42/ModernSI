// Form submission state: one request at a time, the API's message and per-field errors.
// This work made by Anfinogentov Nikita
"use client";
import { useRef, useState } from "react";
import { ApiError } from "@/lib/errors";

export function useSubmit() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function run(work: () => Promise<void>) {
    // a second click while the first request is in flight is ignored, so nothing is sent twice
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, "unknown", "Something went wrong. Please try again."));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function fieldError(name: string): string | undefined {
    return error?.fields.find((item) => item.field === name)?.message;
  }

  return { pending, error, run, fieldError, setError };
}
