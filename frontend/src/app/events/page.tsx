// Upcoming and past events.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { Icon } from "@/components/Icon";
import { PageHero } from "@/components/PageHero";
import { ApiError } from "@/lib/errors";
import { firstParam, qs } from "@/lib/query";
import { apiGet, getMe } from "@/lib/server-api";
import type { EventItem, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Events" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EventsPage({ searchParams }: Props) {
  const params = await searchParams;
  const when = firstParam(params.when) === "past" ? "past" : "upcoming";
  const cursor = firstParam(params.cursor);
  const me = await getMe();
  let page: Page<EventItem>;
  try {
    page = await apiGet<Page<EventItem>>(`/api/events${qs({ when, cursor, limit: 24 })}`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "bad_cursor") redirect(`/events${qs({ when: when === "past" ? when : undefined })}`);
    throw error;
  }
  const base = when === "past" ? "/events?when=past" : "/events";
  const curator = me?.status === "active" && (me.role === "curator" || me.role === "admin");

  return (
    <>
      <PageHero
        tone="teal" icon="events" eyebrow="On the calendar" note="tap I'm in, bring a friend"
        title={<>What&apos;s <span className="marker">on</span></>}
        lead="Pick a night, say you are in, and walk in. Many of these started as a student idea."
      >
        {curator && <Link className="btn btn-primary btn-large" href="/events/new">Publish an event<Icon name="arrow" /></Link>}
        <Link className={curator ? "btn" : "btn btn-primary btn-large"} href="/ideas/new">Pitch an idea{!curator && <Icon name="arrow" />}</Link>
      </PageHero>
      <div className="wrap page-body">
        <div className="filters">
          <nav className="chips" aria-label="When">
            <span className="chips-label" aria-hidden="true">Show</span>
            <Link className="chip" href="/events" aria-current={when === "upcoming" ? "page" : undefined}>Upcoming</Link>
            <Link className="chip" href="/events?when=past" aria-current={when === "past" ? "page" : undefined}>Past</Link>
          </nav>
        </div>
        {page.items.length ? (
          <div className="event-grid">{page.items.map((event) => <EventCard key={event.id} event={event} level={2} />)}</div>
        ) : when === "past" ? (
          <EmptyState icon="events">No events have taken place yet.</EmptyState>
        ) : (
          <EmptyState icon="events" action={{ href: "/ideas", label: "See the ideas" }}>Quiet week. Nothing is scheduled yet. Events show up here as soon as an idea gathers its team.</EmptyState>
        )}
        <div className="pager">
          {cursor && <Link className="btn btn-small" href={base}>First page</Link>}
          {page.next_cursor && <Link className="btn btn-small" href={`${base}${base.includes("?") ? "&" : "?"}cursor=${page.next_cursor}`}>Next page<Icon name="arrow" /></Link>}
        </div>
      </div>
    </>
  );
}
