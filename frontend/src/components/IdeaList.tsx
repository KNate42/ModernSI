// A grid of idea cards with its own empty state.
// This work made by Anfinogentov Nikita
import type { IdeaCard as IdeaCardData } from "@/lib/types";
import { IdeaCard } from "./IdeaCard";

export function IdeaList({ ideas, empty }: { ideas: IdeaCardData[]; empty: React.ReactNode }) {
  if (!ideas.length) return <div className="empty">{empty}</div>;
  return (
    <div className="cards">
      {ideas.map((idea) => <IdeaCard key={idea.id} idea={idea} />)}
    </div>
  );
}
