// The idea wall on the teal band: the idea closest to review is the big sticker, the next ones follow. Shape, colour and icon belong to the slot.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import type { IdeaCard } from "@/lib/types";
import { HandNote } from "@/components/HandNote";
import { formatCount } from "./helpers";
import { Icon, type IconName } from "@/components/Icon";

const slotIcons: IconName[] = ["bowl", "book", "forum", "moon", "waves", "code"];
const slotButtons = ["btn-night", "btn-teal", "btn-teal", "btn-butter", "btn-teal", "btn-butter"];
const segmentLimit = 50;

// the 50 segments of the meter come from a mask, one per vote up to 50; a bigger goal shares the same 50 segments
function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const segments = Math.min(Math.max(max, 1), segmentLimit);
  return (
    <progress className="votes-meter" value={Math.min(value, max)} max={max} style={{ "--threshold": segments } as React.CSSProperties} aria-label={label}>
      {value}
    </progress>
  );
}

function votesLeft(idea: IdeaCard): string {
  const left = Math.max(idea.vote_threshold - idea.vote_count, 0);
  return `${left} more ${left === 1 ? "vote" : "votes"} and it goes to review.`;
}

function Sticker({ idea, slot }: { idea: IdeaCard; slot: number }) {
  const where = idea.scope === "network" ? "Whole network" : idea.campus_label ?? "Own campus";
  const nearly = idea.vote_count >= idea.vote_threshold * 0.8;
  return (
    <li className="wall-item" data-slot={slot} data-reveal>
      <article className="sticker tilt" data-slot={slot}>
        {nearly && <span className="stamp">Almost there!</span>}
        <div className="sticker-top">
          <span className="badge-icon"><Icon name={slotIcons[slot - 1]} /></span>
          <span className="where"><Icon name={idea.scope === "network" ? "globe" : "pin"} />{where}</span>
        </div>
        <h3 className="sticker-title"><Link href={`/ideas/${idea.id}`}>{idea.title}</Link></h3>
        {slot === 1 && <p className="sticker-blurb">{idea.summary}</p>}
        <div className="votes">
          <p className="votes-count"><b>{idea.vote_count}</b><span>of {idea.vote_threshold} votes</span></p>
          <Meter value={idea.vote_count} max={idea.vote_threshold} label={`${idea.vote_count} of ${idea.vote_threshold} votes`} />
          {slot === 1 && <p className="votes-left">{votesLeft(idea)}</p>}
        </div>
        <Link className={`btn ${slotButtons[slot - 1]} btn-small sticker-back`} href={`/ideas/${idea.id}`} aria-label={`Back it: ${idea.title}`}>Back it</Link>
      </article>
    </li>
  );
}

// With no ideas yet the wall shows how it works with one drawn example. It is marked as an example and carries no numbers.
function Example() {
  return (
    <li className="wall-item" data-slot="1" data-reveal>
      <article className="sticker tilt" data-slot="1">
        <span className="stamp">How it works · example</span>
        <div className="sticker-top">
          <span className="badge-icon"><Icon name="bowl" /></span>
          <span className="where"><Icon name="globe" />Whole network</span>
        </div>
        <h3 className="sticker-title">International Food Festival</h3>
        <p className="sticker-blurb">One evening, one table per country. Bring a dish from home and the story behind it.</p>
        <svg className="sticker-art" viewBox="0 0 300 170" aria-hidden="true" focusable="false">
          <path className="s-night" fill="none" strokeWidth="3" strokeLinecap="round" d="M6 14Q80 54 150 26T294 16" />
          <g className="s-night" strokeWidth="2.5" strokeLinejoin="round">
            <path className="f-accent" d="M26 30l22 8-14 20z" /><path className="f-royal" d="M70 42l22 3-10 22z" /><path className="f-teal" d="M116 40l22-3-6 24z" />
            <path className="f-night" d="M162 30l22-6v26z" /><path className="f-accent" d="M208 24l22-5 2 25z" /><path className="f-royal" d="M252 20h22l-8 22z" />
          </g>
          <g className="s-night" strokeWidth="3" strokeLinejoin="round">
            <path className="f-royal" d="M22 104h76c0 30-17 50-38 50S22 134 22 104Z" />
            <path className="f-teal" d="M112 104h76c0 30-17 50-38 50s-38-20-38-50Z" />
            <path className="f-accent" d="M202 104h76c0 30-17 50-38 50s-38-20-38-50Z" />
          </g>
          <g className="f-cream s-night" strokeWidth="3"><ellipse cx="60" cy="104" rx="38" ry="9" /><ellipse cx="150" cy="104" rx="38" ry="9" /><ellipse cx="240" cy="104" rx="38" ry="9" /></g>
          <ellipse className="f-butter" cx="60" cy="103" rx="26" ry="5" /><ellipse className="f-teal" cx="150" cy="103" rx="26" ry="5" /><ellipse className="f-accent" cx="240" cy="103" rx="26" ry="5" />
          <g className="s-night" fill="none" strokeWidth="3" strokeLinecap="round"><path d="M50 90c-8-10 8-12 0-24M68 90c-8-10 8-12 0-24M140 90c-8-10 8-12 0-24M158 90c-8-10 8-12 0-24M230 90c-8-10 8-12 0-24M248 90c-8-10 8-12 0-24" /></g>
        </svg>
        <div className="votes">
          <progress className="votes-meter" value={4} max={5} style={{ "--threshold": segmentLimit } as React.CSSProperties} aria-label="Example: most of the votes it needs are in" />
        </div>
        <Link className="btn btn-night btn-small sticker-back" href="/ideas/new">Pitch the first idea</Link>
      </article>
    </li>
  );
}

type Props = { ideas: IdeaCard[]; closest: IdeaCard | null; ideasToEvents: number | null };

export function IdeaWall({ ideas, closest, ideasToEvents }: Props) {
  // slot 1 is the idea closest to review, the other slots follow in trending order
  const first = closest ?? ideas[0] ?? null;
  const wall = first ? [first, ...ideas.filter((idea) => idea.id !== first.id)].slice(0, 6) : [];
  const threshold = first?.vote_threshold;
  const lead = [
    ideasToEvents ? `${formatCount(ideasToEvents)} ${ideasToEvents === 1 ? "idea has" : "ideas have"} already turned into real events.` : "",
    wall.length
      ? `These are the ones climbing towards ${threshold} votes right now. Give one a nudge, or stick up your own.`
      : "Nobody has pitched yet, so here is how it works, with an example. Yours could sit right here.",
  ].filter(Boolean).join(" ");
  return (
    <section className="section wall on-teal" aria-labelledby="wall-title">
      <div className="wrap">
        <div className="home-head">
          <div className="home-head-copy">
            <p className="tag-sticker" data-reveal>The idea wall</p>
            <h2 className="section-title" id="wall-title">Ideas that <span className="marker">actually happen.</span></h2>
          </div>
          <div className="home-head-side">
            <p className="section-lead">{lead}</p>
            <HandNote arrow="wall" tone="teal">{threshold ? `${threshold} votes and it goes to review` : "enough votes and it goes to review"}</HandNote>
          </div>
        </div>
        <ul className="wall-grid" data-count={wall.length || 1}>
          {wall.length ? wall.map((idea, index) => <Sticker key={idea.id} idea={idea} slot={index + 1} />) : <Example />}
          <li className="wall-item wall-item-yours" data-reveal>
            <article className="sticker sticker-yours tilt">
              <span className="plus" aria-hidden="true"><Icon name="plus" /></span>
              <div className="sticker-yours-copy">
                <h3 className="sticker-title">Your idea goes here.</h3>
                <p>One sentence and a campus is enough. Somebody out there is already thinking &ldquo;finally&rdquo;.</p>
              </div>
              <Link className="btn btn-night" href="/ideas/new">Pitch it<Icon name="arrow" /></Link>
            </article>
          </li>
        </ul>
      </div>
    </section>
  );
}
