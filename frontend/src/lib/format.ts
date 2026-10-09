// Human labels for API enums.
// This work made by Anfinogentov Nikita
import type { IconName } from "@/components/Icon";
import type { Category, IdeaStatus, Role, Scope } from "./types";

export const categoryLabels: Record<Category, string> = {
  event: "Event",
  academic: "Academic initiative",
  club: "Club",
  research: "Research project",
  volunteering: "Volunteering",
  campus_life: "Campus life",
};

export const statusLabels: Record<IdeaStatus, string> = {
  open: "Collecting support",
  in_review: "In review",
  needs_changes: "Needs changes",
  rejected: "Not approved",
  forming_team: "Gathering a team",
  live: "On the calendar",
  done: "Done",
  expired: "Expired",
};

export const roleLabels: Record<Role, string> = {
  student: "Student",
  student_gov: "Student Government",
  curator: "Curator",
  admin: "Admin",
};

export function scopeText(scope: Scope, campus: string | null): string {
  return scope === "network" ? "whole network" : campus ?? "own campus";
}

// the icon of a category: it fills the corner of the idea page, next to the title
export const categoryIcons: Record<Category, IconName> = {
  event: "events",
  academic: "academic",
  research: "ideas",
  club: "users",
  volunteering: "community",
  campus_life: "pin",
};

// groups of categories share one of the three cool tints of the palette, so a list of ideas reads as a coloured set, not a grey table
export type Tint = "teal" | "sky" | "steel";
export const categoryTints: Record<Category, Tint> = {
  event: "sky",
  academic: "steel",
  research: "steel",
  club: "teal",
  volunteering: "teal",
  campus_life: "sky",
};
