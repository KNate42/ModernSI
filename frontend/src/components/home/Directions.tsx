// The four directions as doors with a gradient rim. Each tile is one link to its section.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

const doors: { slug: string; title: string; icon: IconName; text: string; items: string[] }[] = [
  { slug: "academic", title: "Academic", icon: "academic", text: "When is class, where is the room, what is due on Friday.", items: ["Schedule", "Courses", "Deadlines"] },
  { slug: "international", title: "International", icon: "international", text: "Exchanges, scholarships and conferences that want you there.", items: ["Exchange programs", "Scholarships", "Conferences"] },
  { slug: "community", title: "Community", icon: "community", text: "Clubs, volunteering and the people who run student life.", items: ["Speaking club", "Volunteering", "Student voice"] },
  { slug: "personal", title: "Personal", icon: "personal", text: "Your stuff in one place: what you did and what you earned.", items: ["Activity history", "Achievements", "Portfolio"] },
];

export function Directions() {
  return (
    <section className="section directions" aria-labelledby="doors-title">
      <div className="wrap">
        <div className="home-head">
          <div className="home-head-copy">
            <p className="tag-sticker" data-reveal>The grown-up stuff</p>
            <h2 className="section-title" id="doors-title">Four doors, <span className="marker">one account.</span></h2>
          </div>
          <p className="section-lead">Schedule, scholarships, clubs and a corner that is only yours. Pick a door.</p>
        </div>
        <ul className="direction-grid">
          {doors.map((door) => (
            <li key={door.slug} data-reveal>
              <Link className={`direction-tile direction-${door.slug} tilt`} href={`/${door.slug}`} aria-labelledby={`door-${door.slug}-title door-${door.slug}-text`}>
                <span className="direction-icon"><Icon name={door.icon} /></span>
                <h3 id={`door-${door.slug}-title`}>{door.title}</h3>
                <p id={`door-${door.slug}-text`}>{door.text}</p>
                <ul className="direction-items">{door.items.map((item) => <li key={item}>{item}</li>)}</ul>
                <span className="direction-go" aria-hidden="true"><Icon name="arrow" /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
