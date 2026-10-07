// Idea card for lists: category, status, progress and author.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { categoryLabels, categoryTints, scopeText, statusLabels } from "@/lib/format";
import type { IdeaCard as IdeaCardData } from "@/lib/types";
import { Progress } from "./Progress";

export function supportText(idea: IdeaCardData): string {
  if (idea.status === "open") return `${idea.vote_count} of ${idea.vote_threshold} votes`;
  if (idea.status === "forming_team") return `Team ${idea.team_size} of ${idea.team_min}`;
  return `${idea.vote_count} ${idea.vote_count === 1 ? "supporter" : "supporters"}`;
}

// level is the heading level of the title: 2 under the page title, 3 under a section heading
export function IdeaCard({ idea, level = 3 }: { idea: IdeaCardData; level?: 2 | 3 }) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <Link className={`card idea-card tint-${categoryTints[idea.category]}`} href={`/ideas/${idea.id}`}>
      <span className="idea-card-top">
        <span className="badge">{categoryLabels[idea.category]} · {scopeText(idea.scope, idea.campus_label)}</span>
        <span className={`badge badge-accent status-${idea.status}`}>{statusLabels[idea.status]}</span>
      </span>
      <Heading>{idea.title}</Heading>
      <p className="idea-summary">{idea.summary}</p>
      {idea.status === "open" && <Progress value={idea.vote_count} max={idea.vote_threshold} label="Support" />}
      {idea.status === "forming_team" && <Progress value={idea.team_size} max={idea.team_min} label="Team" />}
      <div className="meta">
        <span>{idea.author.display_name}{idea.author.campus_label ? ` · ${idea.author.campus_label}` : ""}</span>
        <span>{supportText(idea)}</span>
      </div>
    </Link>
  );
}
