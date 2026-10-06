// Personal: an invitation for guests; for members their ideas, support, teams, events and activity.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { FeedList } from "@/components/FeedList";
import { IdeaList } from "@/components/IdeaList";
import { Topics } from "@/components/Topics";
import { apiTry, getMe } from "@/lib/server-api";
import type { EventItem, FeedItem, IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Personal" };

const topics: [string, string][] = [
  ["Notifications", "Updates about your ideas, teams and events."],
  ["Activity history", "Everything you did on the network, in order."],
  ["Achievements", "Milestones such as your first idea that became an event."],
  ["Digital portfolio", "Your projects and teams, ready to share."],
];

export default async function PersonalPage() {
  const me = await getMe();
  if (!me) {
    return (
      <div className="wrap">
        <div className="page-head">
          <p className="eyebrow">Personal</p>
          <h1>Your corner of the network</h1>
          <p>Your ideas, the ideas you support, your teams and your events, in one place.</p>
          <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/join">Join</Link>
            <Link className="btn" href="/login?next=/personal">Log in</Link>
          </p>
        </div>
        <section><Topics title="What this section covers" topics={topics} /></section>
      </div>
    );
  }
  if (me.status === "pending") {
    return (
      <div className="wrap">
        <div className="page-head">
          <p className="eyebrow">Personal</p>
          <h1>Hi, {me.display_name}</h1>
          <p>Confirm your e-mail to propose ideas, support them and join teams.</p>
          <p><Link className="btn btn-primary" href="/verify">Confirm your e-mail</Link></p>
        </div>
      </div>
    );
  }

  const [authored, voted, teams, going, activity] = await Promise.all([
    apiTry<Page<IdeaCard>>("/api/ideas?mine=authored&limit=12"),
    apiTry<Page<IdeaCard>>("/api/ideas?mine=voted&limit=12"),
    apiTry<Page<IdeaCard>>("/api/ideas?mine=team&limit=12"),
    apiTry<Page<EventItem>>("/api/events?going=true&limit=8"),
    apiTry<Page<FeedItem>>("/api/feed?mine=true&limit=12"),
  ]);
  return (
    <div className="wrap">
      <div className="page-head section-head">
        <div>
          <p className="eyebrow">Personal</p>
          <h1>Hi, {me.display_name}</h1>
          <p>{me.campus_label ? `${me.campus_label} · ` : ""}Your ideas, support, teams and events.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn" href={`/profile/${me.id}`}>My profile</Link>
          <Link className="btn" href="/settings">Settings</Link>
        </div>
      </div>
      <section>
        <div className="section-head">
          <div><h2>My ideas</h2></div>
          <Link className="btn btn-primary" href="/ideas/new">Propose an idea</Link>
        </div>
        <IdeaList ideas={authored?.items ?? []} empty={<>You have not proposed anything yet. <Link href="/ideas/new">Propose an idea</Link>.</>} />
      </section>
      <section>
        <div className="section-head"><div><h2>Ideas I support</h2></div></div>
        <IdeaList ideas={voted?.items ?? []} empty={<>You do not support any ideas yet. <Link href="/ideas?sort=closest">See ideas close to review</Link>.</>} />
      </section>
      <section>
        <div className="section-head"><div><h2>My teams</h2></div></div>
        <IdeaList ideas={teams?.items ?? []} empty={<>You are not in a team yet. Approved ideas look for people on the <Link href="/ideas">ideas page</Link>.</>} />
      </section>
      <section>
        <div className="section-head"><div><h2>Events I&apos;m going to</h2></div></div>
        {going && going.items.length > 0 ? (
          <div className="events">{going.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
        ) : (
          <p className="empty">No events yet. <Link href="/events">See what is coming up</Link>.</p>
        )}
      </section>
      {activity && activity.items.length > 0 && (
        <section>
          <div className="section-head"><div><h2>My activity</h2></div></div>
          <FeedList items={activity.items} />
        </section>
      )}
    </div>
  );
}
