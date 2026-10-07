// A grid of idea cards with its own empty state.
// This work made by Anfinogentov Nikita
import type { IdeaCard as IdeaCardData } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { IdeaCard } from "./IdeaCard";

type Action = { href: string; label: string };

export function IdeaList({ ideas, empty, emptyAction, level = 3 }: { ideas: IdeaCardData[]; empty: React.ReactNode; emptyAction?: Action; level?: 2 | 3 }) {
  if (!ideas.length) return <EmptyState icon="ideas" action={emptyAction}>{empty}</EmptyState>;
  return (
    <div className="cards">
      {ideas.map((idea) => <IdeaCard key={idea.id} idea={idea} level={level} />)}
    </div>
  );
}
