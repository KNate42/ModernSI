// The route from idea to event: five stops along a drawn path that draws itself on wide screens and runs down the side on a phone.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { HandNote } from "@/components/HandNote";
import { countWord } from "./helpers";

const wideCurve = "M 110 215 C 232 215 232 365 355 365 C 477 365 477 215 600 215 C 722 215 722 365 845 365 C 967 365 967 215 1090 215 C 1136 215 1166 195 1186 141";
const tallCurve = "M 29 0 C 62 90 -4 170 29 250 C 62 330 -4 410 29 500 C 62 590 -4 670 29 750 C 62 830 -4 910 29 1000";
const burst = "50.0,3.0 60.0,12.5 73.0,10.2 77.3,22.7 90.9,26.4 85.8,40.4 98.0,50.0 86.3,59.7 90.3,73.3 77.6,77.6 73.0,89.9 59.9,86.9 50.0,97.7 40.4,85.6 26.1,91.4 23.1,76.9 10.0,73.1 12.2,60.1 3.6,50.0 13.6,40.2 8.4,26.0 23.8,23.8 26.3,9.0 40.0,12.8";

// the votes and the other campuses come from the API; without them the copy stays general
type Props = { threshold: number | null; campusCount: number };

export function Route({ threshold, campusCount }: Props) {
  const others = campusCount > 1 ? `the other ${countWord(campusCount - 1)}` : "the whole network";
  return (
    <section className="section path on-night" id="how" aria-labelledby="how-title">
      <div className="wrap">
        <div className="home-head">
          <div className="home-head-copy">
            <p className="tag-sticker" data-reveal>The map</p>
            <h2 className="section-title" id="how-title">How an idea becomes an event</h2>
          </div>
          <p className="section-lead">Five stops. No paperwork, no committee maze. Most of the work is saying it out loud.</p>
        </div>

        <div className="route" data-route>
          <svg className="route-wide" viewBox="0 0 1200 580" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path className="route-line" d={wideCurve} />
            <path className="route-head" d="M 1160 151 L 1188 137 L 1196 167" />
            <path className="route-dash" d={wideCurve} />
          </svg>
          <svg className="route-tall" viewBox="0 0 58 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path className="route-line" d={tallCurve} />
            <path className="route-dash" d={tallCurve} />
          </svg>
          <ol className="stops">
            <li className="stop stop-up">
              <span className="stop-dot">1</span>
              <div className="stop-card tilt">
                <h3>Pitch it</h3>
                <p>One sentence and your campus. Takes less time than choosing a coffee.</p>
                <Link className="stop-link" href="/ideas/new">Pitch yours</Link>
              </div>
              <HandNote arrow="stop" tone="night" className="stop-note">you are here</HandNote>
            </li>
            <li className="stop stop-down">
              <span className="stop-dot">2</span>
              <div className="stop-card tilt">
                <h3>{threshold ? `Get to ${threshold} votes` : "Get enough votes"}</h3>
                <p>Your campus can vote. So can {others}. Friends help, group chats help more.</p>
              </div>
            </li>
            <li className="stop stop-up">
              <span className="stop-dot">3</span>
              <div className="stop-card tilt">
                <h3>Student Government looks</h3>
                <p>They read it and decide. You can see exactly where it stands, no guessing.</p>
              </div>
            </li>
            <li className="stop stop-down">
              <span className="stop-dot">4</span>
              <div className="stop-card tilt">
                <h3>Find your crew</h3>
                <p>Volunteers join in, a date gets picked, somebody finds the room.</p>
              </div>
            </li>
            <li className="stop stop-up stop-last">
              <span className="stop-dot">
                <svg className="sticker-shape" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><polygon points={burst} /></svg>
                <b>5</b>
              </span>
              <div className="stop-card tilt">
                <h3>It&apos;s an event</h3>
                <p>It lands on the calendar, people RSVP, you show up. Yes, really you.</p>
                <Link className="stop-link" href="/events">See what&apos;s on</Link>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
