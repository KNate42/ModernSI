// When an event starts, in the visitor's own timezone ("Today, 15:00"). The server writes UTC first and the browser redraws it.
// This work made by Anfinogentov Nikita
"use client";
import { useViewer } from "./clock";
import { whenText } from "./helpers";

export function EventWhen({ iso, serverNow, style }: { iso: string; serverNow: number; style: "card" | "chip" }) {
  const viewer = useViewer(serverNow);
  return <time dateTime={iso}>{whenText(iso, viewer, style)}</time>;
}
