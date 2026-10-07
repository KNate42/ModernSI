// "Meanwhile, on the other campuses": the latest records of the network feed as paper notes. Needs at least three to show up.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { feedSentence } from "@/lib/feed-text";
import type { FeedItem } from "@/lib/types";

export function FeedNotes({ items }: { items: FeedItem[] }) {
  const notes = items.flatMap((item) => {
    const sentence = feedSentence(item);
    return sentence ? [{ item, sentence }] : [];
  }).slice(0, 6);
  if (notes.length < 3) return null;
  return (
    <section className="section network" aria-labelledby="feed-title">
      <div className="wrap">
        <div className="home-head">
          <div className="home-head-copy">
            <p className="tag-sticker" data-reveal>Live from the feed</p>
            <h2 className="section-title" id="feed-title">Meanwhile, on the other <span className="marker">campuses</span></h2>
          </div>
          <p className="section-lead">Small campus does not mean quiet campus. Here is what just happened around the network.</p>
        </div>
        <ul className="feed-grid">
          {notes.map(({ item, sentence }) => (
            <li key={item.id} className="feed-note" data-reveal>
              <p className="feed-meta">
                <span className="feed-campus">{item.campus_label ?? "Whole network"}</span>
                <span className="feed-time"><LocalTime iso={item.at} mode="relative" /></span>
              </p>
              <p>
                {sentence.before}
                {sentence.link && <Link href={sentence.link.href}>{sentence.link.text}</Link>}
                {sentence.after}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
