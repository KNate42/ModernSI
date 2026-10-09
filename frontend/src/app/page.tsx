// Homepage: sticker headline, idea ticker, "Just show up", idea wall, the route, four directions, the live feed, campus tags and the finale.
// Every block runs on live API data and hides itself (or shows its honest empty state) when the data is missing.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { CampusTags } from "@/components/home/CampusTags";
import { Directions } from "@/components/home/Directions";
import { FeedNotes } from "@/components/home/FeedNotes";
import { Finale } from "@/components/home/Finale";
import { Hero } from "@/components/home/Hero";
import { IdeaWall } from "@/components/home/IdeaWall";
import { Reveal } from "@/components/home/Reveal";
import { Ribbons } from "@/components/home/Ribbons";
import { Route } from "@/components/home/Route";
import { ShowUp } from "@/components/home/ShowUp";
import { qs } from "@/lib/query";
import { apiTry, getMe } from "@/lib/server-api";
import type { Campus, EventItem, FeedItem, IdeaCard, Page, Stats } from "@/lib/types";
import "./home.css";

export const metadata: Metadata = { title: { absolute: "ModernSI | Nothing happening? Start something." } };

// the ticker needs a few titles to be worth a band
const tickerMinimum = 3;

// the server's clock goes to the countdown and the week strip, so they render the same on the server and in the first browser pass
const now = () => Date.now();

export default async function Home() {
  const serverNow = now();
  const [me, stats, trending, closest, events, feed, campuses] = await Promise.all([
    getMe(),
    apiTry<Stats>("/api/stats"),
    apiTry<Page<IdeaCard>>(`/api/ideas${qs({ sort: "trending", status: "open", limit: 12 })}`),
    apiTry<Page<IdeaCard>>("/api/ideas?sort=closest&limit=1"),
    apiTry<Page<EventItem>>("/api/events?limit=50"),
    apiTry<Page<FeedItem>>("/api/feed?limit=12"),
    apiTry<Campus[]>("/api/campuses"),
  ]);
  const ideas = trending?.items ?? [];
  const closestIdea = closest?.items[0] ?? null;
  const upcoming = events ? events.items : null;
  const campusList = campuses ?? [];
  const threshold = closestIdea?.vote_threshold ?? ideas[0]?.vote_threshold ?? null;

  return (
    <div className="home">
      <Reveal />
      <Hero me={me} stats={stats} next={upcoming?.[0] ?? null} campusCount={campusList.length} serverNow={serverNow} />
      {ideas.length >= tickerMinimum && <Ribbons ideas={ideas.map((idea) => idea.title)} campuses={campusList.map((campus) => campus.campus_label)} />}
      <ShowUp me={me} events={upcoming} serverNow={serverNow} />
      <IdeaWall ideas={ideas} closest={closestIdea} ideasToEvents={stats?.show_counters ? stats.ideas_to_events : null} />
      <Route threshold={threshold} campusCount={campusList.length} />
      <Directions />
      <FeedNotes items={feed?.items ?? []} />
      {campusList.length > 0 && <CampusTags campuses={campusList} />}
      <Finale me={me} stats={stats} />
    </div>
  );
}
