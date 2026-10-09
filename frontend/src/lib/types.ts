// Shapes returned by the ModernSI API (mirrors backend schemas).
// This work made by Anfinogentov Nikita

export type Role = "student" | "student_gov" | "curator" | "admin";
export type Category = "event" | "academic" | "club" | "research" | "volunteering" | "campus_life";
export type Scope = "campus" | "network";
export type IdeaStatus = "open" | "in_review" | "needs_changes" | "rejected" | "forming_team" | "live" | "done" | "expired";

export type Author = { id: string; display_name: string; campus_label: string | null };

export type Me = Author & { email: string; role: Role; status: "pending" | "active" | "blocked" };

export type IdeaCard = {
  id: string; title: string; summary: string; category: Category; scope: Scope; campus_label: string | null;
  status: IdeaStatus; vote_count: number; vote_threshold: number; team_size: number; team_min: number;
  author: Author; created_at: string; expires_at: string;
};

export type IdeaDetail = IdeaCard & {
  body_md: string; body_html: string; review_note: string | null; is_hidden: boolean;
  my_vote: boolean; in_team: boolean; is_author: boolean; can_edit: boolean; team: Author[];
};

export type Page<T> = { items: T[]; next_cursor: string | null };

export type EventItem = {
  id: string; title: string; description_md: string; description_html: string; starts_at: string; ends_at: string;
  location_text: string | null; online_url: string | null; campus_label: string | null; going_count: number;
  idea_id: string | null; idea_title: string | null; created_by: Author; i_am_going: boolean; is_past: boolean;
};

export type FeedKind = "user_verified" | "idea_created" | "idea_reached_review" | "idea_decided" | "team_formed" | "event_published";

export type FeedItem = {
  id: string; kind: FeedKind; at: string; actor_id: string | null; idea_id: string | null; event_id: string | null;
  campus_label: string | null; data: Record<string, string | null>;
};

export type Stats = { students: number; campuses: number; ideas_to_events: number; show_counters: boolean };

export type Campus = { campus_label: string; country_code: string; students: number };

export type Profile = {
  id: string; display_name: string; campus_label: string | null; role: Role; joined_at: string; bio: string;
  languages: string[]; interests: string[]; links: string[]; theme: "system" | "light" | "dark"; has_avatar: boolean; extended: boolean;
};
