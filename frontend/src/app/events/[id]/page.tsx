// One event: time in the visitor's timezone, place, description, the idea it came from, RSVP.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { placeText } from "@/components/EventCard";
import { LocalTime } from "@/components/LocalTime";
import { RsvpButton } from "@/components/events/RsvpButton";
import { isUuid, qs } from "@/lib/query";
import { apiFind, apiTry, getMe } from "@/lib/server-api";
import type { EventItem } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = isUuid(id) ? await apiTry<EventItem>(`/api/events/${id}`) : null;
  return { title: event?.title ?? "Event" };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [event, me] = await Promise.all([apiFind<EventItem>(`/api/events/${id}`), getMe()]);
  if (!event) notFound();

  return (
    <div className="wrap detail">
      <div className="page-head">
        <p className="breadcrumbs"><Link href="/events">Events</Link> / {event.is_past ? "Past" : "Upcoming"}</p>
        <p className="event-when"><LocalTime iso={event.starts_at} /> – <LocalTime iso={event.ends_at} /></p>
        <h1>{event.title}</h1>
        <p>{placeText(event)}</p>
      </div>
      <div className="grid-2">
        <article>
          {event.description_html ? (
            <div className="prose" dangerouslySetInnerHTML={{ __html: event.description_html }} />
          ) : (
            <p className="muted">The organisers have not added a description.</p>
          )}
          {event.online_url && (
            <p><a href={event.online_url} target="_blank" rel="nofollow ugc noopener noreferrer">Join online</a></p>
          )}
          {event.idea_id && event.idea_title && (
            <p className="byline">Born from the student idea <Link href={`/ideas/${event.idea_id}`}>{event.idea_title}</Link>.</p>
          )}
          <p className="byline">Published by <Link href={`/profile/${event.created_by.id}`}>{event.created_by.display_name}</Link>.</p>
        </article>
        <aside className="card aside stack">
          {event.is_past ? (
            <p>This event has ended. {event.going_count} {event.going_count === 1 ? "person was" : "people were"} going.</p>
          ) : me?.status === "active" ? (
            <RsvpButton eventId={event.id} going={event.i_am_going} count={event.going_count} />
          ) : (
            <>
              <p className="count muted"><b>{event.going_count} going</b></p>
              {me ? (
                <Link className="btn btn-primary" href="/verify">Confirm your e-mail to join</Link>
              ) : (
                <Link className="btn btn-primary" href={`/login${qs({ next: `/events/${event.id}` })}`}>Log in to join</Link>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
