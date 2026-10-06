// Academic: what the section covers, plus academic and research ideas and their events.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { IdeaList } from "@/components/IdeaList";
import { Topics } from "@/components/Topics";
import { qs } from "@/lib/query";
import { apiGet, apiTry } from "@/lib/server-api";
import type { EventItem, IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Academic" };

const topics: [string, string][] = [
  ["Schedule", "Class times across campuses, with changes in one place."],
  ["Courses", "Course pages where students share what to expect."],
  ["Professors", "Office hours and how to reach teaching staff."],
  ["Resources", "Study guides students write and share themselves."],
  ["Deadlines", "Submissions and exam dates you should not miss."],
];

export default async function AcademicPage() {
  const categories = ["academic", "research"];
  const [ideas, events] = await Promise.all([
    apiGet<Page<IdeaCard>>(`/api/ideas${qs({ category: categories, sort: "trending", limit: 6 })}`),
    apiTry<Page<EventItem>>(`/api/events${qs({ category: categories, limit: 4 })}`),
  ]);
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">Academic</p>
        <h1>Study together across campuses</h1>
        <p>The academic side of the network: how studying works on each campus, and what students build together beyond classes.</p>
      </div>
      <section>
        <Topics title="What this section covers" intro="These parts open one by one. Academic ideas and events below already work." topics={topics} />
      </section>
      <section>
        <div className="section-head">
          <div><p className="eyebrow">Working now</p><h2>Academic and research ideas</h2></div>
          <Link className="btn btn-primary" href="/ideas/new">Propose an idea</Link>
        </div>
        <IdeaList ideas={ideas.items} empty={<>No academic ideas yet. <Link href="/ideas/new">Propose the first one</Link>.</>} />
      </section>
      {events && events.items.length > 0 && (
        <section>
          <div className="section-head"><div><h2>Academic events</h2></div></div>
          <div className="events">{events.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
        </section>
      )}
    </div>
  );
}
