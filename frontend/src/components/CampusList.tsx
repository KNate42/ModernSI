// Campuses as little tags with their country codes and student counts, biggest campus first (the API already sorts them).
// This work made by Anfinogentov Nikita
import type { Campus } from "@/lib/types";

export function CampusList({ campuses }: { campuses: Campus[] }) {
  return (
    <ul className="campus-chips">
      {campuses.map((campus) => (
        <li key={`${campus.campus_label}-${campus.country_code}`} className="campus-chip">
          <span className="campus-chip-name">{campus.campus_label}</span>
          <small>{campus.country_code}</small>
          <span className="campus-chip-count">{campus.students} {campus.students === 1 ? "student" : "students"}</span>
        </li>
      ))}
    </ul>
  );
}
