// Homepage: hero, the four directions, student ideas, events, the live feed and the campus network.
// Every live block hides itself when its data is missing or the store behind it is down.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { CampusList } from "@/components/CampusList";
import { EventCard } from "@/components/EventCard";
import { FeedList } from "@/components/FeedList";
import { HeroNet } from "@/components/HeroNet";
import { Pillars } from "@/components/Pillars";
import { Progress } from "@/components/Progress";
import { Steps } from "@/components/Steps";
import { categoryLabels, scopeText } from "@/lib/format";
import { qs } from "@/lib/query";
import { apiTry, getMe } from "@/lib/server-api";
import type { Campus, EventItem, FeedItem, IdeaCard, Page, Stats } from "@/lib/types";

function number(value: number): string {
  return value.toLocaleString("en-US");
}

function Counters({ stats, signedIn }: { stats: Stats | null; signedIn: boolean }) {
  if (!stats) return null;
  if (!stats.show_counters) {
    return (
      <p className="starting">
        The network is just starting — your campus could be the first.{!signedIn && <> <Link href="/join">Join now</Link></>}
      </p>
    );
  }
  return (
    <div className="stats" aria-label="Network in numbers">
      <div className="stat"><b>{number(stats.students)}</b><span>{stats.students === 1 ? "student" : "students"}</span></div>
      <div className="stat"><b>{number(stats.campuses)}</b><span>{stats.campuses === 1 ? "campus" : "campuses"}</span></div>
      <div className="stat"><b>{number(stats.ideas_to_events)}</b><span>{stats.ideas_to_events === 1 ? "idea became an event" : "ideas became events"}</span></div>
    </div>
  );
}

function Spotlight({ idea }: { idea: IdeaCard }) {
  return (
    <article className="card spotlight">
      <p className="eyebrow">Closest to review</p>
      <span className="tag">{categoryLabels[idea.category]} · {scopeText(idea.scope, idea.campus_label)}</span>
      <h3>{idea.title}</h3>
      <p className="muted">{idea.summary}</p>
      <Progress value={idea.vote_count} max={idea.vote_threshold} label="Support" />
      <p className="muted"><b style={{ color: "var(--fg)" }}>{idea.vote_count} of {idea.vote_threshold}</b> students support this idea</p>
      <Link className="btn" href={`/ideas/${idea.id}`}>Support it</Link>
    </article>
  );
}

// shown when there are no ideas yet: the festival from the concept slide, clearly marked as an example
function Example() {
  return (
    <article className="card spotlight">
      <span className="tag">How it works · example</span>
      <h3>International Food Festival</h3>
      <p className="muted">One evening, one table per country. Students cook a dish from home and share the story behind it.</p>
      <div className="progress" aria-hidden="true"><i style={{ width: "80%" }} /></div>
      <p className="muted">
        Students support an idea with their votes. With enough support, Student Government reviews it, a team forms around it,
        and it lands on the Hub as an event.
      </p>
      <Link className="btn btn-primary" href="/ideas/new">Propose the first idea</Link>
    </article>
  );
}

function Trending({ ideas }: { ideas: IdeaCard[] }) {
  return (
    <div className="card">
      <h3>Trending this week</h3>
      <ul className="idea-list">
        {ideas.map((idea) => (
          <li key={idea.id}>
            <Link href={`/ideas/${idea.id}`}>
              <span>{idea.title}<small>{categoryLabels[idea.category]} · {scopeText(idea.scope, idea.campus_label)}</small></span>
              <span className="votes">{idea.vote_count}<span className="sr-only"> votes</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <Link className="link-more" href="/ideas?sort=trending">All ideas →</Link>
    </div>
  );
}

export default async function Home() {
  const [me, stats, trending, closest, events, feed, campuses] = await Promise.all([
    getMe(),
    apiTry<Stats>("/api/stats"),
    apiTry<Page<IdeaCard>>(`/api/ideas${qs({ sort: "trending", status: ["open", "in_review", "forming_team", "live"], limit: 6 })}`),
    apiTry<Page<IdeaCard>>("/api/ideas?sort=closest&limit=1"),
    apiTry<Page<EventItem>>("/api/events?limit=4"),
    apiTry<Page<FeedItem>>("/api/feed?limit=12"),
    apiTry<Campus[]>("/api/campuses"),
  ]);
  const ideas = trending?.items ?? [];
  const spotlight = closest?.items[0] ?? null;
  const threshold = spotlight?.vote_threshold ?? ideas[0]?.vote_threshold;
  const upcoming = events?.items ?? [];
  const feedItems = feed?.items ?? [];
  const campusList = campuses ?? [];

  return (
    <>
      <section className="hero">
        <HeroNet />
        <div className="wrap">
          <p className="eyebrow">An independent international student network</p>
          <h1>One hub. Every campus.</h1>
          <p className="lead">A digital ecosystem built around the student experience.</p>
          <div className="actions">
            {me ? (
              <Link className="btn btn-primary" href="/ideas/new">Propose an idea</Link>
            ) : (
              <Link className="btn btn-primary" href="/join">Join with your university email</Link>
            )}
            <Link className="btn" href="/ideas">Explore ideas</Link>
          </div>
          <Counters stats={stats} signedIn={Boolean(me)} />
        </div>
      </section>

      <section id="pillars">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">What lives here</p>
              <h2>Four directions, one account</h2>
            </div>
          </div>
          <Pillars />
        </div>
      </section>

      <section id="ideas">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Student ideas → real initiatives</p>
              <h2>Your idea can become a campus activity</h2>
              <p className="muted">Propose it, gather support, and Student Government takes it from there.</p>
            </div>
            <Link className="btn btn-primary" href="/ideas/new">Propose an idea</Link>
          </div>
          <Steps threshold={threshold} />
          {ideas.length === 0 ? (
            <div className="ideas-grid solo"><Example /></div>
          ) : (
            <div className={spotlight ? "ideas-grid" : "ideas-grid solo"}>
              {spotlight && <Spotlight idea={spotlight} />}
              <Trending ideas={ideas} />
            </div>
          )}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section id="events">
          <div className="wrap">
            <div className="section-head">
              <div><p className="eyebrow">On the Hub</p><h2>Coming up</h2></div>
              <Link className="btn" href="/events">All events</Link>
            </div>
            <div className="events">{upcoming.map((event) => <EventCard key={event.id} event={event} />)}</div>
          </div>
        </section>
      )}

      {feedItems.length >= 3 && (
        <section id="feed">
          <div className="wrap">
            <div className="section-head">
              <div><p className="eyebrow">Live across the network</p><h2>What just happened</h2></div>
            </div>
            <FeedList items={feedItems} />
          </div>
        </section>
      )}

      {campusList.length > 0 && (
        <section id="campuses">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="eyebrow">Campus network</p>
                <h2>Students from {campusList.length} {campusList.length === 1 ? "campus" : "campuses"}</h2>
              </div>
              <Link className="btn" href="/request-campus">Add your university</Link>
            </div>
            <CampusList campuses={campusList} />
          </div>
        </section>
      )}
    </>
  );
}
