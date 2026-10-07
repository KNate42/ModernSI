// International: what the section covers, the campus network, network-wide ideas and events.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { CampusList } from "@/components/CampusList";
import { EmptyState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { Icon, type IconName } from "@/components/Icon";
import { IdeaList } from "@/components/IdeaList";
import { PageHero } from "@/components/PageHero";
import { Topics } from "@/components/Topics";
import { apiGet, apiTry } from "@/lib/server-api";
import type { Campus, EventItem, IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "International" };

const topics: [string, string, IconName][] = [
  ["Learning portals", "Where each campus keeps its courses and grades, in one list.", "globe"],
  ["Exchange opportunities", "Semesters and summer schools at other campuses.", "international"],
  ["Scholarships", "Funding students can apply for, with deadlines.", "star"],
  ["Conferences", "Student conferences and calls for papers.", "forum"],
  ["International events", "Events open to every campus in the network.", "events"],
];

export default async function InternationalPage() {
  const [campuses, ideas, events] = await Promise.all([
    apiTry<Campus[]>("/api/campuses"),
    apiGet<Page<IdeaCard>>("/api/ideas?scope=network&sort=trending&limit=6"),
    apiTry<Page<EventItem>>("/api/events?network_only=true&limit=4"),
  ]);
  return (
    <>
      <PageHero
        tone="teal" icon="international" eyebrow="International" note="not the only one"
        title={<>One network, <span className="marker">many campuses</span></>}
        lead="Exchanges, scholarships and conferences that want you there, and students from other countries who are into the same things."
      >
        <Link className="btn btn-primary btn-large" href="/request-campus">Add your university<Icon name="arrow" /></Link>
      </PageHero>
      <div className="wrap page-body">
        <section>
          <Topics title="What this section covers" intro="These parts open one by one. The campus network, shared ideas and events below already work." topics={topics} />
        </section>
        <section>
          <div className="section-head">
            <div><p className="eyebrow">Working now</p><h2>Campus network</h2></div>
          </div>
          {campuses && campuses.length > 0 ? (
            <CampusList campuses={campuses} />
          ) : (
            <EmptyState icon="international" action={{ href: "/request-campus", label: "Ask us to add yours" }}>The first campuses are joining now.</EmptyState>
          )}
        </section>
        <section>
          <div className="section-head"><div><h2>Ideas for the whole network</h2></div></div>
          <IdeaList ideas={ideas.items} empty="No network-wide ideas yet." emptyAction={{ href: "/ideas/new", label: "Pitch one" }} />
        </section>
        {events && events.items.length > 0 && (
          <section>
            <div className="section-head"><div><h2>International events</h2></div></div>
            <div className="event-grid">{events.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
          </section>
        )}
      </div>
    </>
  );
}
