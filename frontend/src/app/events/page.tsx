// Upcoming and past events.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EventCard } from "@/components/EventCard";
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
    <div className="wrap detail">
      <div className="page-head section-head">
        <div>
          <p className="eyebrow">On the Hub</p>
          <h1>Events</h1>
          <p>Events across the network. Many of them started as a student idea.</p>
        </div>
        {curator && <Link className="btn btn-primary" href="/events/new">Publish an event</Link>}
      </div>
      <nav className="chips" aria-label="When">
        <Link className="chip" href="/events" aria-current={when === "upcoming" ? "page" : undefined}>Upcoming</Link>
        <Link className="chip" href="/events?when=past" aria-current={when === "past" ? "page" : undefined}>Past</Link>
      </nav>
      {page.items.length ? (
        <div className="cards">{page.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
      ) : (
        <p className="empty">
          {when === "past" ? "No events have taken place yet." : <>Nothing is scheduled yet. Events appear here when <Link href="/ideas">ideas</Link> gather a team.</>}
        </p>
      )}
      <div className="pager">
        {cursor && <Link href={base}>← First page</Link>}
        {page.next_cursor && <Link href={`${base}${base.includes("?") ? "&" : "?"}cursor=${page.next_cursor}`}>Next page →</Link>}
      </div>
    </div>
  );
}
