// The first screen: the sticker headline, one red button, the drawn polaroids and the live counters of the network.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import type { EventItem, Me, Stats } from "@/lib/types";
import { Countdown } from "./Countdown";
import { EventWhen } from "./EventWhen";
import { HandNote } from "@/components/HandNote";
import { Polaroid } from "./Polaroids";
import { countWord, formatCount } from "./helpers";
import { Icon } from "@/components/Icon";

const burst = "50.0,3.0 58.6,12.2 69.9,8.6 74.1,19.8 86.9,20.5 83.4,33.9 96.8,39.3 87.6,50.0 95.4,60.4 85.2,66.9 86.0,78.7 73.8,79.9 70.7,93.0 58.2,86.0 50.0,97.8 41.5,87.1 30.0,91.6 25.6,80.6 13.7,78.9 16.0,66.4 3.2,60.7 13.0,50.0 3.8,39.5 15.3,33.3 14.1,21.4 25.7,19.6 29.7,7.8 41.7,13.7";
const seal = "50.0,3.0 56.2,6.6 62.9,6.0 68.1,10.3 75.5,10.3 77.5,18.2 86.3,18.5 85.8,27.0 92.3,30.7 92.3,37.6 95.6,43.4 93.2,50.0 97.2,56.8 90.2,61.8 93.5,69.8 86.2,73.3 84.9,80.2 78.9,83.3 75.1,89.0 67.7,88.8 63.5,96.0 56.0,91.6 50.0,97.4 43.8,93.1 37.1,94.1 31.8,89.9 24.7,89.4 22.3,81.9 13.6,81.5 14.4,72.9 7.4,69.5 7.9,62.4 4.5,56.5 6.5,50.0 3.1,43.3 9.7,38.2 6.3,30.1 14.1,26.9 14.9,19.6 21.1,16.7 25.1,11.2 32.1,10.8 36.5,4.2 44.0,8.5";

// the numbers of the network: stickers once there are enough students, one honest plate before that, nothing when the API is down
function Counters({ stats }: { stats: Stats | null }) {
  if (!stats) return null;
  if (!stats.show_counters) {
    return <p className="starting-plate tilt" data-reveal>The network is just starting. Your campus could be the first.</p>;
  }
  return (
    <ul className="stat-stickers" aria-label="The network in numbers">
      <li className="stat-sticker stat-burst tilt" data-reveal>
        <svg className="sticker-shape" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><polygon points={burst} /></svg>
        <span><b>{formatCount(stats.students)}</b><i>{stats.students === 1 ? "student" : "students"}</i></span>
      </li>
      <li className="stat-sticker stat-seal tilt" data-reveal>
        <svg className="sticker-shape" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><polygon points={seal} /></svg>
        <span><b>{formatCount(stats.campuses)}</b><i>{stats.campuses === 1 ? "campus" : "campuses"}</i></span>
      </li>
      {stats.ideas_to_events > 0 && (
        <li className="stat-sticker stat-label tilt" data-reveal>
          <span><b>{formatCount(stats.ideas_to_events)}</b><i>{stats.ideas_to_events === 1 ? "idea that became a real event" : "ideas that became real events"}</i></span>
        </li>
      )}
    </ul>
  );
}

type Props = { me: Me | null; stats: Stats | null; next: EventItem | null; campusCount: number; serverNow: number };

export function Hero({ me, stats, next, campusCount, serverNow }: Props) {
  const students = campusCount > 1 ? `students of ${countWord(campusCount)} micro-campuses` : "micro-campus students";
  return (
    <section className="hero" aria-label="Welcome">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="tag-sticker" data-reveal>By students, for small campuses</p>
          <h1 className="hero-title">
            <span className="hero-title-top">
              Nothing happening?
              <svg className="hero-underline" viewBox="0 0 320 14" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d="M3 8C30 2 50 12 82 6S130 3 160 8s52 5 82-1 54 3 75-1" />
              </svg>
            </span>{" "}
            <span className="hero-title-main"><span className="marker-box">Start something.</span></span>
          </h1>
          <p className="hero-lead">
            ModernSI is where {students} pitch ideas, vote the good ones up and turn them into real events.
            You, your friends and a university <span className="nowrap">e-mail.</span> That&apos;s the whole recipe.
          </p>
          <div className="hero-actions">
            {me ? (
              <Link className="btn btn-main btn-large" href="/ideas/new"><span>Pitch an idea</span><Icon name="arrow" /></Link>
            ) : (
              <Link className="btn btn-main btn-large" href="/join"><span>Join with your uni <span className="nowrap">e-mail</span></span><Icon name="arrow" /></Link>
            )}
            <HandNote arrow="hero" className="hand-note-hero">{me ? "one sentence is enough" : "free, takes 30 seconds"}</HandNote>
          </div>
          {next && (
            <Link className="next-chip tilt" href="#week">
              <Icon name="events" />
              <span className="next-chip-text">
                <strong>Next up:</strong> {next.title}, <EventWhen iso={next.starts_at} serverNow={serverNow} style="chip" />.{" "}
                <Countdown startsAt={next.starts_at} endsAt={next.ends_at} serverNow={serverNow} variant="chip" />
              </span>
            </Link>
          )}
        </div>

        <div className="collage">
          <Polaroid variant="food" />
          <Polaroid variant="study" />
          <Counters stats={stats} />
        </div>
      </div>
    </section>
  );
}
