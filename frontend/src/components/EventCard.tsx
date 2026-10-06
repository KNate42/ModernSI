// Event card: when, what, where, how many are going.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import type { EventItem } from "@/lib/types";
import { LocalTime } from "./LocalTime";

export function placeText(event: EventItem): string {
  const where = event.location_text ?? "Online";
  return `${where} · ${event.campus_label ?? "whole network"}`;
}

export function EventCard({ event }: { event: EventItem }) {
  return (
    <Link className="card event" href={`/events/${event.id}`}>
      <LocalTime iso={event.starts_at} />
      <h3>{event.title}</h3>
      <p className="muted">{placeText(event)}</p>
      <p className="going">{event.going_count} going</p>
    </Link>
  );
}
