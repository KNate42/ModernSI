// Community: what the section covers, student ideas, events and the review queue for Student Government.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { Icon, type IconName } from "@/components/Icon";
import { IdeaList } from "@/components/IdeaList";
import { PageHero } from "@/components/PageHero";
import { Topics } from "@/components/Topics";
import { apiGet, apiTry, getMe } from "@/lib/server-api";
import type { EventItem, IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Community" };

const topics: [string, string, IconName][] = [
  ["Speaking Club", "Regular conversation practice across campuses.", "forum"],
  ["Volunteering", "Projects that need hands, on campus and around it.", "community"],
  ["Student Government", "Who represents students and what they decide.", "shield"],
  ["Student Voice", "Ideas and feedback from students, gathered in one place.", "ideas"],
  ["Campus events", "What is happening on each campus.", "events"],
];

export default async function CommunityPage() {
  const [me, ideas, events] = await Promise.all([
    getMe(),
    apiGet<Page<IdeaCard>>("/api/ideas?sort=trending&limit=6"),
    apiTry<Page<EventItem>>("/api/events?limit=4"),
  ]);
  const reviewer = me?.status === "active" && (me.role === "student_gov" || me.role === "admin");
  return (
    <>
      <PageHero
        tone="steel" icon="community" eyebrow="Community" note="you are in good company"
        title={<>Student ideas, <span className="marker">real initiatives</span></>}
        lead="Clubs, volunteering and the people who run student life. You pitch, the network backs it, Student Government decides and a crew turns it into an event."
      >
        <Link className="btn btn-primary btn-large" href="/ideas/new">Pitch an idea<Icon name="arrow" /></Link>
        {reviewer && <Link className="btn" href="/review">Review queue</Link>}
      </PageHero>
      <div className="wrap page-body">
        <section>
          <Topics title="What this section covers" intro="These parts open one by one. Student Voice works today as ideas and events, below." topics={topics} />
        </section>
        <section>
          <div className="section-head">
            <div><p className="eyebrow">Working now</p><h2>Trending ideas</h2></div>
            <Link className="btn" href="/ideas">All ideas<Icon name="arrow" /></Link>
          </div>
          <IdeaList ideas={ideas.items} empty="No ideas yet." emptyAction={{ href: "/ideas/new", label: "Pitch the first one" }} />
        </section>
        {events && events.items.length > 0 && (
          <section>
            <div className="section-head">
              <div><h2>Coming up</h2></div>
              <Link className="btn" href="/events">All events<Icon name="arrow" /></Link>
            </div>
            <div className="event-grid">{events.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
          </section>
        )}
      </div>
    </>
  );
}
