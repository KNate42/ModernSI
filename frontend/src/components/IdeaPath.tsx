// Where an idea is on its way to an event: Pitched, Support, Review, Team, On the calendar. The current step is marked for screen readers too.
// This work made by Anfinogentov Nikita
import type { IdeaStatus } from "@/lib/types";
import { Icon } from "./Icon";

const steps = ["Pitched", "Support", "Review", "Team", "On the calendar"];

// the index of the current step; an idea that is done has passed all of them
const current: Record<IdeaStatus, number> = { open: 1, in_review: 2, needs_changes: 2, rejected: 2, forming_team: 3, live: 4, done: 5, expired: 1 };
const stopped: Partial<Record<IdeaStatus, string>> = { needs_changes: "changes needed", rejected: "not approved", expired: "not enough support in time" };

export function IdeaPath({ status }: { status: IdeaStatus }) {
  const at = current[status];
  return (
    <ol className="idea-path" aria-label="Where this idea is on its way to an event">
      {steps.map((label, index) => {
        const state = index < at ? "passed" : index === at ? (stopped[status] ? "stuck" : "here") : "ahead";
        return (
          <li key={label} className={`idea-path-step is-${state}`} aria-current={index === at ? "step" : undefined}>
            <span className="idea-path-dot" aria-hidden="true">{state === "passed" ? <Icon name="check" /> : index + 1}</span>
            <span className="idea-path-label">
              {label}
              {index === at && stopped[status] && <span className="visually-hidden"> ({stopped[status]})</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
