// Edit page for the author, while the idea is open or waiting for changes.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IdeaForm } from "@/components/ideas/IdeaForm";
import { isUuid } from "@/lib/query";
import { apiFind, getMe } from "@/lib/server-api";
import type { IdeaDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Edit idea" };

type Props = { params: Promise<{ id: string }> };

export default async function EditIdeaPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const me = await getMe();
  if (!me) redirect(`/login?next=/ideas/${id}/edit`);
  const idea = await apiFind<IdeaDetail>(`/api/ideas/${id}`);
  if (!idea) notFound();
  if (!idea.can_edit) redirect(`/ideas/${id}`);
  return (
    <div className="wrap auth">
      <p className="breadcrumbs"><Link href={`/ideas/${id}`}>{idea.title}</Link> / Edit</p>
      <h1>Edit idea</h1>
      {idea.review_note && <blockquote className="note" style={{ margin: "16px 0 24px" }}>{idea.review_note}</blockquote>}
      <IdeaForm idea={idea} campus={me.campus_label} />
    </div>
  );
}
