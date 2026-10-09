// The form-level error notice. Field errors are shown next to their fields as well. A new error scrolls itself into view,
// because the form may be long and the button that was pressed is far below the notice.
// This work made by Anfinogentov Nikita
"use client";
import { useEffect, useRef } from "react";
import type { ApiError } from "@/lib/errors";
import { Notice } from "./Notice";

export function FormError({ error }: { error: ApiError | null }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) box.current?.scrollIntoView({ block: "nearest" });
  }, [error]);
  if (!error) return null;
  return (
    <Notice kind="error" role="alert" ref={box}>
      {error.fields.length ? "A few fields need a fix. The notes are right under them." : error.message}
    </Notice>
  );
}
