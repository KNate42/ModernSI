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

export function IdeaCard({ idea }: { idea: IdeaCardData }) {
  return (
    <Link className={`card idea-card tint-${categoryTints[idea.category]}`} href={`/ideas/${idea.id}`}>
      <span className="badge">{categoryLabels[idea.category]} · {scopeText(idea.scope, idea.campus_label)}</span>{" "}
      <span className="badge badge-accent">{statusLabels[idea.status]}</span>
      <h3>{idea.title}</h3>
      <p>{idea.summary}</p>
      {idea.status === "open" && <Progress value={idea.vote_count} max={idea.vote_threshold} label="Support" />}
      <div className="meta">
        <span>{idea.author.display_name}{idea.author.campus_label ? ` · ${idea.author.campus_label}` : ""}</span>
        <span>{supportText(idea)}</span>
      </div>
    </Link>
  );
}
