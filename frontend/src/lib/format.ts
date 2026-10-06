// Human labels for API enums.
// This work made by Anfinogentov Nikita
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
  live: "On the Hub",
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
