// Review queue for Student Government and admins. Everyone else gets a 404.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdeaList } from "@/components/IdeaList";
import { PageHero } from "@/components/PageHero";
import { apiGet, getMe } from "@/lib/server-api";
import type { IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const me = await getMe();
  if (!me || me.status !== "active" || !(me.role === "student_gov" || me.role === "admin")) notFound();
  const page = await apiGet<Page<IdeaCard>>("/api/ideas?status=in_review&sort=new&limit=50");
  return (
    <>
      <PageHero
        tone="steel" icon="shield" eyebrow="Student Government"
        title={<>Review <span className="marker">queue</span></>}
        lead="These ideas reached their support goal. Approve them, ask for changes or say no with a note, so the author knows why."
      />
      <div className="wrap page-body">
        <IdeaList level={2} ideas={page.items} empty="Nothing is waiting for review right now. Enjoy the quiet." />
      </div>
    </>
  );
}
