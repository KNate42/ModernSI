// Activity feed list: one sentence per record, time in the visitor's timezone, campus or "whole network".
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
    <ul className="feed">
      {rows.map(({ item, sentence }) => (
        <li key={item.id}>
          <span className="dot" aria-hidden="true" />
          <span>
            {sentence.before}
            {sentence.link && <Link href={sentence.link.href}>{sentence.link.text}</Link>}
            {sentence.after}
            <small><LocalTime iso={item.at} mode="relative" /> · {item.campus_label ?? "whole network"}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
