// Community: what the section covers, student ideas, events and the review queue for Student Government.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { IdeaList } from "@/components/IdeaList";
import { Topics } from "@/components/Topics";
import { apiGet, apiTry, getMe } from "@/lib/server-api";
import type { EventItem, IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Community" };

const topics: [string, string][] = [
  ["Speaking Club", "Regular conversation practice across campuses."],
  ["Volunteering", "Projects that need hands, on campus and around it."],
  ["Student Government", "Who represents students and what they decide."],
  ["Student Voice", "Ideas and feedback from students, gathered in one place."],
  ["Campus events", "What is happening on each campus."],
];

export default async function CommunityPage() {
  const [me, ideas, events] = await Promise.all([
    getMe(),
    apiGet<Page<IdeaCard>>("/api/ideas?sort=trending&limit=6"),
    apiTry<Page<EventItem>>("/api/events?limit=4"),
  ]);
  const reviewer = me?.status === "active" && (me.role === "student_gov" || me.role === "admin");
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">Community</p>
        <h1>Student ideas, real initiatives</h1>
        <p>Students propose, the network supports, Student Government reviews, and teams turn ideas into events.</p>
      </div>
      <section>
        <Topics title="What this section covers" intro="These parts open one by one. Student Voice works today as ideas and events, below." topics={topics} />
      </section>
      <section>
        <div className="section-head">
          <div><p className="eyebrow">Working now</p><h2>Trending ideas</h2></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {reviewer && <Link className="btn" href="/review">Review queue</Link>}
            <Link className="btn btn-primary" href="/ideas/new">Propose an idea</Link>
          </div>
        </div>
        <IdeaList ideas={ideas.items} empty={<>No ideas yet. <Link href="/ideas/new">Propose the first one</Link>.</>} />
        <Link className="link-more" href="/ideas">All ideas →</Link>
      </section>
      {events && events.items.length > 0 && (
        <section>
          <div className="section-head">
            <div><h2>Coming up</h2></div>
            <Link className="btn" href="/events">All events</Link>
          </div>
          <div className="events">{events.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
        </section>
      )}
    </div>
  );
}
