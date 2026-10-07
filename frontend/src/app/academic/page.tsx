// Academic: what the section covers, plus academic and research ideas and their events.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { Icon, type IconName } from "@/components/Icon";
import { IdeaList } from "@/components/IdeaList";
import { PageHero } from "@/components/PageHero";
import { Topics } from "@/components/Topics";
import { qs } from "@/lib/query";
import { apiGet, apiTry } from "@/lib/server-api";
import type { EventItem, IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Academic" };

const topics: [string, string, IconName][] = [
  ["Schedule", "Class times across campuses, with changes in one place.", "calendar"],
  ["Courses", "Course pages where students share what to expect.", "book"],
  ["Professors", "Office hours and how to reach teaching staff.", "users"],
  ["Resources", "Study guides students write and share themselves.", "link"],
  ["Deadlines", "Submissions and exam dates you should not miss.", "clock"],
];

export default async function AcademicPage() {
  const categories = ["academic", "research"];
  const [ideas, events] = await Promise.all([
    apiGet<Page<IdeaCard>>(`/api/ideas${qs({ category: categories, sort: "trending", limit: 6 })}`),
    apiTry<Page<EventItem>>(`/api/events${qs({ category: categories, limit: 4 })}`),
  ]);
  return (
    <>
      <PageHero
        tone="sky" icon="academic" eyebrow="Academic" note="study with people"
        title={<>Study together, <span className="marker">across campuses</span></>}
        lead="When is class, where is the room, what is due on Friday. Studying is easier with people who have done it before, and with a few ideas of your own."
      >
        <Link className="btn btn-primary btn-large" href="/ideas/new">Pitch an academic idea<Icon name="arrow" /></Link>
      </PageHero>
      <div className="wrap page-body">
        <section>
          <Topics title="What this section covers" intro="These parts open one by one. Academic ideas and events below already work." topics={topics} />
        </section>
        <section>
          <div className="section-head">
            <div><p className="eyebrow">Working now</p><h2>Academic and research ideas</h2></div>
            <Link className="btn" href="/ideas?category=academic">All academic ideas</Link>
          </div>
          <IdeaList ideas={ideas.items} empty="No academic ideas yet." emptyAction={{ href: "/ideas/new", label: "Pitch the first one" }} />
        </section>
        {events && events.items.length > 0 && (
          <section>
            <div className="section-head"><div><h2>Academic events</h2></div></div>
            <div className="event-grid">{events.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
          </section>
        )}
      </div>
    </>
  );
}
