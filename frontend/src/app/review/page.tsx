// Review queue for Student Government and admins. Everyone else gets a 404.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdeaList } from "@/components/IdeaList";
import { apiGet, getMe } from "@/lib/server-api";
import type { IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const me = await getMe();
  if (!me || me.status !== "active" || !(me.role === "student_gov" || me.role === "admin")) notFound();
  const page = await apiGet<Page<IdeaCard>>("/api/ideas?status=in_review&sort=new&limit=50");
  return (
    <div className="wrap detail">
      <div className="page-head">
        <p className="eyebrow">Student Government</p>
        <h1>Review queue</h1>
        <p>Ideas that reached their support goal. Approve them, ask for changes or reject them with a note for the author.</p>
      </div>
      <IdeaList ideas={page.items} empty="Nothing is waiting for review right now." />
    </div>
  );
}
