// The next seven days, grouped by the visitor's own calendar day. Empty days offer "Pitch one"; an empty week says so once.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { useViewer } from "./clock";
import { addDays, clockText, dayKey } from "./helpers";
import { Icon } from "@/components/Icon";

export type WeekEvent = { id: string; title: string; startsAt: string; endsAt: string; place: string };

const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
const monthName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short" });
const at = (key: string) => new Date(`${key}T00:00:00Z`);

function rangeText(first: string, last: string): string {
  const sameMonth = monthName.format(at(first)) === monthName.format(at(last));
  const from = sameMonth ? `${Number(first.slice(8))}` : `${Number(first.slice(8))} ${monthName.format(at(first))}`;
  return `${from} to ${Number(last.slice(8))} ${monthName.format(at(last))}`;
}

export function WeekStrip({ events, nextId, serverNow }: { events: WeekEvent[]; nextId: string | null; serverNow: number }) {
  const viewer = useViewer(serverNow);
  const keys = Array.from({ length: 7 }, (_, index) => addDays(viewer.today, index));
  const byDay = new Map<string, WeekEvent[]>();
  for (const event of events) {
    // an event that already started on an earlier day is still on today
    let key = dayKey(new Date(event.startsAt), viewer.timeZone);
    if (key < viewer.today) key = viewer.today;
    if (keys.includes(key)) byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }
  const zone = viewer.local ? "" : " UTC";

  return (
    <section className="week-strip" id="events" aria-label="The next seven days" data-reveal>
      <header className="week-strip-head">
        <h3>Next 7 days</h3>
        <p>{rangeText(keys[0], keys[6])}</p>
      </header>
      {byDay.size === 0 ? (
        <div className="week-quiet">
          <p>Nothing is on in the next seven days.</p>
          <Link className="btn btn-small btn-teal" href="/ideas/new"><Icon name="plus" />Pitch one</Link>
        </div>
      ) : (
        <ol className="week-days">
          {keys.map((key, index) => {
            const day = at(key);
            const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
            const dayEvents = byDay.get(key) ?? [];
            const classes = ["week-day", index === 0 && "week-day-today", weekend && "week-day-weekend"].filter(Boolean).join(" ");
            return (
              <li key={key} className={classes}>
                <p className="week-day-name">
                  <span className="week-dow">{weekday.format(day)}</span>
                  <span className="week-num">{Number(key.slice(8))}</span>
                  {index === 0 && <span className="week-flag">Today</span>}
                </p>
                {dayEvents.length ? (
                  <ul className="week-events">
                    {dayEvents.map((event) => (
                      <li key={event.id}>
                        <Link className={event.id === nextId ? "week-event week-event-next" : "week-event"} href={`/events/${event.id}`}>
                          <time dateTime={event.startsAt}>{clockText(event.startsAt, viewer.timeZone)}{zone}</time>
                          <span className="week-event-title">{event.title}</span>
                          <span className="week-event-where"><Icon name="pin" />{event.place}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="week-empty">
                    <p>Nothing here yet.</p>
                    <Link className="btn btn-small btn-teal" href="/ideas/new"><Icon name="plus" />Pitch one</Link>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
