// Personal: an invitation for guests; for members their ideas, support, teams, events and activity.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { FeedList } from "@/components/FeedList";
import { Icon, type IconName } from "@/components/Icon";
import { IdeaList } from "@/components/IdeaList";
import { PageHero } from "@/components/PageHero";
import { Topics } from "@/components/Topics";
import { apiTry, getMe } from "@/lib/server-api";
import type { EventItem, FeedItem, IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Personal" };

const topics: [string, string, IconName][] = [
  ["Notifications", "Updates about your ideas, teams and events.", "mail"],
  ["Activity history", "Everything you did on the network, in order.", "clock"],
  ["Achievements", "Milestones such as your first idea that became an event.", "star"],
  ["Digital portfolio", "Your projects and teams, ready to share.", "camera"],
];

export default async function PersonalPage() {
  const me = await getMe();
  if (!me) {
    return (
      <>
        <PageHero
          tone="paper" icon="personal" eyebrow="Personal" note="your stuff, one place"
          title={<>Your corner of the <span className="marker">network</span></>}
          lead="Your ideas, the ideas you back, your teams and your events. All in one place, and only yours."
        >
          <Link className="btn btn-primary btn-large" href="/join">Join<Icon name="arrow" /></Link>
          <Link className="btn" href="/login?next=/personal">Log in</Link>
        </PageHero>
        <div className="wrap page-body">
          <section><Topics title="What this section covers" topics={topics} /></section>
        </div>
      </>
    );
  }
  if (me.status === "pending") {
    return (
      <PageHero
        tone="paper" icon="mail" eyebrow="Personal"
        title={<>Hi, <span className="marker">{me.display_name}</span></>}
        lead="Confirm your e-mail to pitch ideas, back them and join teams."
      >
        <Link className="btn btn-primary btn-large" href="/verify">Confirm your e-mail<Icon name="arrow" /></Link>
      </PageHero>
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
    <>
      <PageHero
        tone="paper" icon="personal" eyebrow={me.campus_label ?? "Personal"}
        title={<>Hi, <span className="marker">{me.display_name}</span></>}
        lead="Your ideas, the ones you back, your teams and your events."
      >
        <Link className="btn btn-primary btn-large" href="/ideas/new">Pitch an idea<Icon name="arrow" /></Link>
        <Link className="btn" href={`/profile/${me.id}`}>My profile</Link>
        <Link className="btn" href="/settings">Settings</Link>
      </PageHero>
      <div className="wrap page-body">
        <section>
          <div className="section-head"><div><h2>My ideas</h2></div></div>
          <IdeaList ideas={authored?.items ?? []} empty="You have not pitched anything yet." emptyAction={{ href: "/ideas/new", label: "Pitch an idea" }} />
        </section>
        <section>
          <div className="section-head"><div><h2>Ideas I back</h2></div></div>
          <IdeaList ideas={voted?.items ?? []} empty="You do not support any ideas yet." emptyAction={{ href: "/ideas?sort=closest", label: "See ideas close to review" }} />
        </section>
        <section>
          <div className="section-head"><div><h2>My teams</h2></div></div>
          <IdeaList ideas={teams?.items ?? []} empty="You are not in a team yet. Approved ideas look for people." emptyAction={{ href: "/ideas", label: "Browse ideas" }} />
        </section>
        <section>
          <div className="section-head"><div><h2>Events I&apos;m going to</h2></div></div>
          {going && going.items.length > 0 ? (
            <div className="event-grid">{going.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
          ) : (
            <EmptyState icon="events" action={{ href: "/events", label: "See what is coming up" }}>No events yet.</EmptyState>
          )}
        </section>
        {activity && activity.items.length > 0 && (
          <section>
            <div className="section-head"><div><h2>My activity</h2></div></div>
            <FeedList items={activity.items} />
          </section>
        )}
      </div>
    </>
  );
}
