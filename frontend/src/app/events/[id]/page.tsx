// One event: time in the visitor's timezone, place, description, the idea it came from, RSVP.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { placeText } from "@/components/EventCard";
import { Icon } from "@/components/Icon";
import { LocalTime } from "@/components/LocalTime";
import { PageHero } from "@/components/PageHero";
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
    <>
      <PageHero
        tone="teal"
        crumbs={<p className="breadcrumbs"><Link href="/events">Events</Link> / {event.is_past ? "Past" : "Upcoming"}</p>}
        art={
          <span className="date-leaf">
            <LocalTime iso={event.starts_at} mode="month" />
            <LocalTime iso={event.starts_at} mode="day" />
          </span>
        }
        title={event.title}
        lead={<span className="event-hero-lines"><span className="event-when"><LocalTime iso={event.starts_at} /> – <LocalTime iso={event.ends_at} /></span><span className="event-hero-place"><Icon name="pin" />{placeText(event)}</span></span>}
      />
      <div className="wrap detail">
        <div className="grid-2">
          <aside className="card aside stack ticket-aside">
            {event.is_past ? (
              <>
                <h2>It happened</h2>
                <p>This event has ended. {event.going_count} {event.going_count === 1 ? "person was" : "people were"} going.</p>
              </>
            ) : me?.status === "active" ? (
              <>
                <h2>Your spot</h2>
                <RsvpButton eventId={event.id} going={event.i_am_going} count={event.going_count} />
              </>
            ) : (
              <>
                <h2>Your spot</h2>
                <p className="count muted"><b>{event.going_count} going</b></p>
                {me ? (
                  <Link className="btn btn-primary" href="/verify">Confirm your e-mail to join</Link>
                ) : (
                  <Link className="btn btn-primary" href={`/login${qs({ next: `/events/${event.id}` })}`}>Log in to join</Link>
                )}
              </>
            )}
          </aside>
          <article className="paper">
            {event.description_html ? (
              <div className="prose" dangerouslySetInnerHTML={{ __html: event.description_html }} />
            ) : (
              <p className="muted">The organisers have not added details yet.</p>
            )}
            {event.online_url && (
              <p className="paper-action">
                <a className="btn btn-teal" href={event.online_url} target="_blank" rel="nofollow ugc noopener noreferrer"><Icon name="link" />Join online</a>
              </p>
            )}
            {event.idea_id && event.idea_title && (
              <p className="byline">Born from the student idea <Link href={`/ideas/${event.idea_id}`}>{event.idea_title}</Link>.</p>
            )}
            <p className="byline">Published by <Link href={`/profile/${event.created_by.id}`}>{event.created_by.display_name}</Link>.</p>
          </article>
        </div>
      </div>
    </>
  );
}
