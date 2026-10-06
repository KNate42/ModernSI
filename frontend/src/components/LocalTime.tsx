// Shows a time in the visitor's timezone. The server renders UTC first; the browser swaps in local time.
// This work made by Anfinogentov Nikita
"use client";
import { useSyncExternalStore } from "react";

type Mode = "datetime" | "date" | "relative";

function format(iso: string, mode: Mode, timeZone?: string): string {
  const date = new Date(iso);
  if (mode === "relative") {
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return "just now";
  }
  const options: Intl.DateTimeFormatOptions =
    mode === "date"
      ? { day: "numeric", month: "short", year: "numeric", timeZone }
      : { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone };
  return new Intl.DateTimeFormat("en-GB", options).format(date) + (timeZone === "UTC" && mode === "datetime" ? " UTC" : "");
}

// false while rendering on the server and during hydration, true afterwards: no mismatch, no state in an effect
const subscribe = () => () => undefined;

export function LocalTime({ iso, mode = "datetime" }: { iso: string; mode?: Mode }) {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  const text = inBrowser ? format(iso, mode) : mode === "relative" ? format(iso, "date", "UTC") : format(iso, mode, "UTC");
  return <time dateTime={iso} suppressHydrationWarning>{text}</time>;
}
