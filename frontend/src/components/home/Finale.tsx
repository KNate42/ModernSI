// The finale on the dark panel: one line, one red button and, when the counters show, the number the visitor would get.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import type { Me, Stats } from "@/lib/types";
import { HandNote } from "@/components/HandNote";
import { formatCount } from "./helpers";
import { Icon } from "@/components/Icon";

const burst = "50.0,3.0 58.6,12.2 69.9,8.6 74.1,19.8 86.9,20.5 83.4,33.9 96.8,39.3 87.6,50.0 95.4,60.4 85.2,66.9 86.0,78.7 73.8,79.9 70.7,93.0 58.2,86.0 50.0,97.8 41.5,87.1 30.0,91.6 25.6,80.6 13.7,78.9 16.0,66.4 3.2,60.7 13.0,50.0 3.8,39.5 15.3,33.3 14.1,21.4 25.7,19.6 29.7,7.8 41.7,13.7";

export function Finale({ me, stats }: { me: Me | null; stats: Stats | null }) {
  return (
    <section className="section finale on-night" aria-labelledby="finale-title">
      <div className="wrap">
        <h2 className="finale-title" id="finale-title">Your campus is small. <span className="marker">Your ideas aren&apos;t.</span></h2>
        <div className="finale-row">
          {me ? (
            <Link className="btn btn-main btn-large" href="/ideas/new"><span>Pitch an idea</span><Icon name="arrow" /></Link>
          ) : (
            <Link className="btn btn-main btn-large" href="/join"><span>Join with your uni <span className="nowrap">e-mail</span></span><Icon name="arrow" /></Link>
          )}
          <HandNote arrow="finale" tone="night" className="finale-note">{me ? "one sentence is enough" : "no spam, no portal vibes"}</HandNote>
          {!me && stats?.show_counters && (
            <p className="finale-burst tilt" data-reveal>
              <svg className="sticker-shape" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><polygon points={burst} /></svg>
              <span>You&apos;d be<b>#{formatCount(stats.students + 1)}</b></span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
