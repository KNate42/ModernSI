// Countdown to an event: "2 h 14 min", "Happening now" while it runs. Rendered by React, so it never touches the DOM by hand.
// This work made by Anfinogentov Nikita
"use client";
import { useSyncExternalStore } from "react";
import { minutesUntil } from "./helpers";

// One tick a second; React redraws only when the minute changes, because the snapshot is the whole number of minutes left.
function subscribe(notify: () => void) {
  const timer = setInterval(notify, 1000);
  return () => clearInterval(timer);
}

const readNow = () => Date.now();

// "h" and "min" carry their own spaces, so a screen reader hears "2 h 14 min" and not "2h14min"
function Duration({ minutes }: { minutes: number }) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) {
    return <>{days}<span className="countdown-unit"> d </span>{hours}<span className="countdown-unit"> h</span></>;
  }
  if (hours > 0) {
    return <>{hours}<span className="countdown-unit"> h </span>{minutes % 60}<span className="countdown-unit"> min</span></>;
  }
  return <>{minutes}<span className="countdown-unit"> min</span></>;
}

type Props = { startsAt: string; endsAt: string; serverNow: number; variant: "card" | "chip" };

export function Countdown({ startsAt, endsAt, serverNow, variant }: Props) {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  // the first render uses the server's clock, so the HTML and the hydrated page agree; the browser's clock takes over right after
  const left = useSyncExternalStore(subscribe, () => minutesUntil(start, end, readNow()), () => minutesUntil(start, end, serverNow));
  const status = left === 0 ? "Happening now" : left < 0 ? "Just finished" : null;

  if (variant === "chip") {
    return (
      <span className="next-chip-count">
        {status ?? <>Starts in <Duration minutes={left} /></>}
      </span>
    );
  }
  return (
    <>
      {!status && <p className="next-up-count-label">Starts in</p>}
      <p className="countdown" role="timer">
        {status ? <span className="countdown-now">{status}</span> : <Duration minutes={left} />}
      </p>
    </>
  );
}
