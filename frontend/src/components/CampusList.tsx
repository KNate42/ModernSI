// Campus labels with their country codes, biggest campus first (the API already sorts them).
// This work made by Anfinogentov Nikita
import type { Campus } from "@/lib/types";

export function CampusList({ campuses }: { campuses: Campus[] }) {
  return (
    <div className="campuses">
      {campuses.map((campus) => (
        <span key={`${campus.campus_label}-${campus.country_code}`} className="campus">
          {campus.campus_label} <small>{campus.country_code}</small>
        </span>
      ))}
    </div>
  );
}
