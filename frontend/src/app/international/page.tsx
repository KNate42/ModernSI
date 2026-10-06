// International: what the section covers, the campus network, network-wide ideas and events.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { CampusList } from "@/components/CampusList";
import { EventCard } from "@/components/EventCard";
import { IdeaList } from "@/components/IdeaList";
import { Topics } from "@/components/Topics";
import { apiGet, apiTry } from "@/lib/server-api";
import type { Campus, EventItem, IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "International" };

const topics: [string, string][] = [
  ["Learning portals", "The learning platforms each campus uses, in one list."],
  ["Exchange opportunities", "Semesters and summer schools at other campuses."],
  ["Scholarships", "Funding students can apply for, with deadlines."],
  ["Conferences", "Student conferences and calls for papers."],
  ["International events", "Events open to every campus in the network."],
];

export default async function InternationalPage() {
  const [campuses, ideas, events] = await Promise.all([
    apiTry<Campus[]>("/api/campuses"),
    apiGet<Page<IdeaCard>>("/api/ideas?scope=network&sort=trending&limit=6"),
    apiTry<Page<EventItem>>("/api/events?network_only=true&limit=4"),
  ]);
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">International</p>
        <h1>One network, many campuses</h1>
        <p>Students from different universities and countries, sharing what they know and building things together.</p>
      </div>
      <section>
        <Topics title="What this section covers" intro="These parts open one by one. The campus network, shared ideas and events below already work." topics={topics} />
      </section>
      <section>
        <div className="section-head">
          <div><p className="eyebrow">Working now</p><h2>Campus network</h2></div>
          <Link className="btn" href="/request-campus">Add your university</Link>
        </div>
        {campuses && campuses.length > 0 ? (
          <CampusList campuses={campuses} />
        ) : (
          <p className="empty">The first campuses are joining now. <Link href="/request-campus">Ask us to add yours</Link>.</p>
        )}
      </section>
      <section>
        <div className="section-head"><div><h2>Ideas for the whole network</h2></div></div>
        <IdeaList ideas={ideas.items} empty={<>No network-wide ideas yet. <Link href="/ideas/new">Propose one</Link>.</>} />
      </section>
      {events && events.items.length > 0 && (
        <section>
          <div className="section-head"><div><h2>International events</h2></div></div>
          <div className="events">{events.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
        </section>
      )}
    </div>
  );
}
