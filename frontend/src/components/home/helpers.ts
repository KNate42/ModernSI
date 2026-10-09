// Small helpers of the homepage: counts, campus codes, country names and the time of day in the visitor's own timezone.
// This work made by Anfinogentov Nikita

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

// "nine campuses" reads better than "9 campuses" in the copy; big numbers stay digits
export function countWord(value: number): string {
  return words[value] ?? formatCount(value);
}

// three letters of the campus name for the luggage tag: Almaty becomes ALM
export function campusCode(label: string): string {
  const letters = Array.from(label.normalize("NFD").replace(/[^\p{L}]/gu, ""));
  const code = (letters.length ? letters : Array.from(label.trim())).slice(0, 3).join("");
  return code.toLocaleUpperCase("en-US");
}

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

// ---- the visitor's day ----
// The server does not know the visitor's timezone, so it renders in UTC and the browser redraws in local time.

export type Viewer = { timeZone: string; today: string; local: boolean };

// "2026-10-22" for the moment in the given timezone
export function dayKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function clockText(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

// "Fri 23 Oct" for a calendar day written as "2026-10-23" (the day itself has no timezone)
export function dayText(key: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).formatToParts(new Date(`${key}T00:00:00Z`));
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("weekday")} ${pick("day")} ${pick("month")}`;
}

// "Today, 15:00" on a card and "today at 15:00" inside a sentence
export function whenText(iso: string, viewer: Viewer, style: "card" | "chip"): string {
  const key = dayKey(new Date(iso), viewer.timeZone);
  const time = clockText(iso, viewer.timeZone);
  const zone = viewer.local ? "" : " UTC";
  let day: string;
  if (key === viewer.today) day = style === "card" ? "Today" : "today";
  else if (key === addDays(viewer.today, 1)) day = style === "card" ? "Tomorrow" : "tomorrow";
  else day = dayText(key);
  return style === "card" ? `${day}, ${time}${zone}` : `${day} at ${time}${zone}`;
}

// ---- countdown ----

// Whole minutes until the start (rounded up, so the first second does not already show one minute less),
// 0 while the event runs and -1 when it is over.
export function minutesUntil(startsAt: number, endsAt: number, now: number): number {
  if (now >= endsAt) return -1;
  if (now >= startsAt) return 0;
  return Math.ceil((startsAt - now) / 60_000);
}
