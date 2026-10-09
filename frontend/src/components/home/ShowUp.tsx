// "Just show up": the next event with a countdown and an I'm in button, Quick access, and the next seven days. Quiet when nothing is planned.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { qs } from "@/lib/query";
import type { EventItem, Me } from "@/lib/types";
import { Countdown } from "./Countdown";
import { EventWhen } from "./EventWhen";
import { Going } from "./Going";
import { HandNote } from "@/components/HandNote";
import { RsvpIn } from "./RsvpIn";
import { WeekStrip } from "./WeekStrip";
import { Icon, type IconName } from "@/components/Icon";

const quickLinks: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: "/academic", icon: "calendar", title: "My schedule", text: "Classes, rooms, deadlines" },
  { href: "/events", icon: "events", title: "Events", text: "What's on at your campus" },
  { href: "/international", icon: "compass", title: "Opportunities", text: "Exchanges, scholarships, conferences" },
];

function QuickAccess() {
  return (
    <nav className="quick-access tilt" aria-label="Quick access" data-reveal>
      <h3 className="quick-title">Quick access</h3>
      <ul>
        {quickLinks.map((item) => (
          <li key={item.href}>
            <Link className="quick-row" href={item.href}>
              <span className="quick-icon"><Icon name={item.icon} /></span>
              <span className="quick-text"><strong>{item.title}</strong><span>{item.text}</span></span>
              <Icon name="arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NextUp({ event, me, serverNow }: { event: EventItem; me: Me | null; serverNow: number }) {
  const place = `${event.campus_label ?? "Whole network"}, ${event.location_text ?? "Online"}`;
  const active = me?.status === "active";
  // a guest comes back to this event after logging in; an unconfirmed account confirms the e-mail first
  const joinHref = me ? "/verify" : `/login${qs({ next: `/events/${event.id}` })}`;
  return (
    <article className="next-up on-night" aria-label="Next up" data-reveal>
      <div className="next-up-main">
        <p className="next-up-label">Next up</p>
        <h3 className="next-up-title"><Link href={`/events/${event.id}`}>{event.title}</Link></h3>
        <ul className="meta-list">
          <li><Icon name="clock" /><span><EventWhen iso={event.starts_at} serverNow={serverNow} style="card" /></span></li>
          <li><Icon name="pin" /><span>{place}</span></li>
        </ul>
      </div>
      <div className="next-up-count">
        <Countdown startsAt={event.starts_at} endsAt={event.ends_at} serverNow={serverNow} variant="card" />
      </div>
      <div className="next-up-action">
        {active ? (
          <RsvpIn eventId={event.id} going={event.i_am_going} count={event.going_count} />
        ) : (
          <>
            <Link className="btn btn-butter btn-large" href={joinHref}>I&apos;m in</Link>
            <Going count={event.going_count} />
          </>
        )}
        <HandNote arrow="card" tone="night">{active ? "one tap, no forms" : "log in, then one tap"}</HandNote>
      </div>
    </article>
  );
}

function QuietWeek() {
  return (
    <article className="quiet-week on-night" aria-label="Quiet week" data-reveal>
      <div className="quiet-copy">
        <p className="next-up-label">Nothing planned yet</p>
        <h3 className="next-up-title">Quiet week. Start something.</h3>
        <p>No events are on the calendar right now. Pitch one, get your campus to back it, and the first chair is yours.</p>
      </div>
      <Link className="btn btn-butter btn-large" href="/ideas/new">Pitch an idea</Link>
    </article>
  );
}

type Props = { me: Me | null; events: EventItem[] | null; serverNow: number };

export function ShowUp({ me, events, serverNow }: Props) {
  const next = events?.[0] ?? null;
  // a day looks a bit different in every timezone, so the server sends a generous eight days and the browser keeps its own seven
  const horizon = serverNow + 8 * 86_400_000;
  const week = (events ?? [])
    .filter((event) => Date.parse(event.starts_at) < horizon)
    .map((event) => ({ id: event.id, title: event.title, startsAt: event.starts_at, endsAt: event.ends_at, place: event.campus_label ?? "Whole network" }));
  return (
    <section className="section show-up" id="week" aria-labelledby="week-title">
      <div className="wrap show-up-grid">
        <div className="home-head-copy show-up-copy">
          <p className="tag-sticker" data-reveal>This week and next</p>
          <h2 className="section-title" id="week-title">Just <span className="marker-box">show up.</span></h2>
          <p className="section-lead">
            {events && !next
              ? "Nothing is on the calendar right now. Pitch something, and when it happens, just show up."
              : "Tap I'm in so we know how many chairs to find. Then walk in, say hi, leave when you want. Nobody checks."}
          </p>
        </div>
        {next && <NextUp event={next} me={me} serverNow={serverNow} />}
        {events && !next && <QuietWeek />}
        <QuickAccess />
        {next && <WeekStrip events={week} nextId={next.id} serverNow={serverNow} />}
      </div>
    </section>
  );
}
