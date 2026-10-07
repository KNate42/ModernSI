// Activity feed list: one sentence per record on a sticky note, with the campus or "whole network" and the time in the visitor's timezone.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { feedSentence } from "@/lib/feed-text";
import type { FeedItem } from "@/lib/types";
import { LocalTime } from "./LocalTime";

export function FeedList({ items }: { items: FeedItem[] }) {
  const rows = items.flatMap((item) => {
    const sentence = feedSentence(item);
    return sentence ? [{ item, sentence }] : [];
  });
  return (
    <ul className="activity">
      {rows.map(({ item, sentence }) => (
        <li key={item.id} className="activity-item">
          <div className="activity-meta">
            <span className="activity-campus">{item.campus_label ?? "Whole network"}</span>
            <span className="activity-time"><LocalTime iso={item.at} mode="relative" /></span>
          </div>
          <p>
            {sentence.before}
            {sentence.link && <Link href={sentence.link.href}>{sentence.link.text}</Link>}
            {sentence.after}
          </p>
        </li>
      ))}
    </ul>
  );
}
