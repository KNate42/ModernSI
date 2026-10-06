// Turns a feed record into a short sentence with at most one link.
// This work made by Anfinogentov Nikita
import type { FeedItem } from "./types";

export type FeedLink = { href: string; text: string };
export type FeedSentence = { before: string; link?: FeedLink; after: string };

// with a link the title is clickable; without one (an old record) the title is plain text
function around(before: string, link: FeedLink | undefined, fallback: string, after: string): FeedSentence {
  return link ? { before, link, after } : { before: before + fallback + after, after: "" };
}

const decisionText: Record<string, string> = {
  approve: "Student Government approved ",
  needs_changes: "Student Government asked for changes to ",
  reject: "Student Government reviewed ",
};

export function feedSentence(item: FeedItem): FeedSentence | null {
  const data = item.data ?? {};
  const ideaTitle = data.idea_title ?? "an idea";
  const idea = item.idea_id && data.idea_title ? { href: `/ideas/${item.idea_id}`, text: data.idea_title } : undefined;
  switch (item.kind) {
    case "user_verified":
      return { before: `${data.display_name ?? "A student"} joined the network`, after: "" };
    case "idea_created":
      return around(`${data.actor_name ?? "A student"} proposed `, idea, ideaTitle, "");
    case "idea_reached_review":
      return around("", idea, data.idea_title ?? "An idea", " reached its support goal and went to review");
    case "idea_decided":
      return around(decisionText[data.decision ?? ""] ?? "Student Government reviewed ", idea, ideaTitle, "");
    case "team_formed":
      return around("The team for ", idea, ideaTitle, " is complete");
    case "event_published": {
      const event = item.event_id && data.event_title ? { href: `/events/${item.event_id}`, text: data.event_title } : undefined;
      return around("", event, data.event_title ?? "A new event", " is now on the Hub");
    }
    default:
      return null;
  }
}
