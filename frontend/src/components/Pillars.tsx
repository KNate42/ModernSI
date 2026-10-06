// The four directions from the concept slide, each leading to its section.
// This work made by Anfinogentov Nikita
import Link from "next/link";

export const pillars = [
  { href: "/academic", title: "Academic", items: ["Schedule", "Courses", "Professors", "Resources", "Deadlines"] },
  { href: "/international", title: "International", items: ["Learning portals", "Exchange opportunities", "Scholarships", "Conferences", "International events"] },
  { href: "/community", title: "Community", items: ["Speaking Club", "Volunteering", "Student Government", "Student Voice", "Campus events"] },
  { href: "/personal", title: "Personal", items: ["Notifications", "Activity history", "Achievements", "Digital portfolio"] },
];

export function Pillars() {
  return (
    <div className="pillars">
      {pillars.map((pillar) => (
        <Link key={pillar.href} className="card pillar" href={pillar.href}>
          <div className="node" />
          <h3>{pillar.title}</h3>
          <ul>{pillar.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </Link>
      ))}
    </div>
  );
}
