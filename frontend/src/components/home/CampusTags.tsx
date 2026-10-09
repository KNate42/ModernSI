// Campuses as luggage tags: a three-letter code, the name, the country and how many students. The last tag asks for a new campus.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import type { Campus } from "@/lib/types";
import { campusCode, countWord, countryName, formatCount } from "./helpers";
import { Icon } from "@/components/Icon";

export function CampusTags({ campuses }: { campuses: Campus[] }) {
  const count = campuses.length;
  return (
    <section className="section luggage" id="campuses" aria-labelledby="campuses-title">
      <div className="wrap">
        <div className="home-head">
          <div className="home-head-copy">
            <p className="tag-sticker" data-reveal>{count === 1 ? "One campus so far" : `${countWord(count)[0].toUpperCase()}${countWord(count).slice(1)} campuses, one network`}</p>
            <h2 className="section-title" id="campuses-title">Which campus is <span className="marker">yours?</span></h2>
          </div>
          <p className="section-lead">
            Grab your tag. You are never the only one on your campus who wants something to happen
            {count > 1 ? `, and the other ${countWord(count - 1)} are looking for people too.` : ", and the next campus is waiting for people like you."}
          </p>
        </div>
        <ul className="tag-grid">
          {campuses.map((campus) => (
            <li key={`${campus.campus_label}-${campus.country_code}`} className="tag-slot">
              <div className="tag" data-reveal>
                <span className="tag-body" /><span className="tag-hole" />
                <span className="tag-route">Campus</span>
                <span className="tag-code">{campusCode(campus.campus_label)}</span>
                <span className="tag-city">{campus.campus_label}</span>
                <span className="tag-country">{countryName(campus.country_code)}</span>
                <span className="tag-students"><b>{formatCount(campus.students)}</b> {campus.students === 1 ? "student" : "students"}</span>
                <span className="tag-bars" />
              </div>
            </li>
          ))}
          <li className="tag-slot tag-slot-add">
            <Link className="tag tag-add" href="/request-campus" data-reveal>
              <span className="tag-body" /><span className="tag-hole" />
              <span className="tag-plus" aria-hidden="true"><Icon name="plus" /></span>
              <span className="tag-city">Not on the list?</span>
              <span className="tag-country">Ask us to add your campus.</span>
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
