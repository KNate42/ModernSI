// Browser clock for the homepage: the visitor's timezone and day as an external store, so nothing mismatches while hydrating.
// This work made by Anfinogentov Nikita
import { useSyncExternalStore } from "react";
import { dayKey, type Viewer } from "./helpers";

// the day can only change at midnight, so a slow tick is enough (the snapshot is a string, equal strings cause no render)
function subscribe(notify: () => void) {
  const timer = setInterval(notify, 30_000);
  return () => clearInterval(timer);
}

function browserSnapshot(): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return `${timeZone}|${dayKey(new Date(), timeZone)}`;
}

// What the server saw: UTC and the moment of the render. The first client render uses the same, then the real values replace it.
function serverSnapshot(serverNow: number): string {
  return `UTC|${dayKey(new Date(serverNow), "UTC")}`;
}

// false on the server and while hydrating, true afterwards
const never = () => () => undefined;

export function useViewer(serverNow: number): Viewer {
  const snapshot = useSyncExternalStore(subscribe, browserSnapshot, () => serverSnapshot(serverNow));
  const local = useSyncExternalStore(never, () => true, () => false);
  const [timeZone, today] = snapshot.split("|");
  return { timeZone, today, local };
}
