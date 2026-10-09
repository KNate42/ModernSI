// Event card shaped like a ticket: a date leaf on the left, then when, what, where and how many are going.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import type { EventItem } from "@/lib/types";
import { Icon } from "./Icon";
import { LocalTime } from "./LocalTime";

export function placeText(event: EventItem): string {
  const where = event.location_text ?? "Online";
  return `${where} · ${event.campus_label ?? "whole network"}`;
}

// level is the heading level of the title: 2 under the page title, 3 under a section heading
export function EventCard({ event, level = 3 }: { event: EventItem; level?: 2 | 3 }) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <Link className="card event" href={`/events/${event.id}`}>
      <span className="event-leaf" aria-hidden="true">
        <LocalTime iso={event.starts_at} mode="month" />
        <LocalTime iso={event.starts_at} mode="day" />
      </span>
      <span className="event-body">
        <LocalTime iso={event.starts_at} />
        <Heading>{event.title}</Heading>
        <p className="event-where"><Icon name="pin" />{placeText(event)}</p>
        <p className="event-going">{event.going_count} going</p>
      </span>
    </Link>
  );
}
