// Edit page for the author, while the idea is open or waiting for changes.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormShell } from "@/components/forms/FormShell";
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
    <FormShell
      eyebrow="Edit idea" tone="steel" icon="ideas"
      crumbs={<p className="breadcrumbs"><Link href={`/ideas/${id}`}>{idea.title}</Link> / Edit</p>}
      title={<>Make it <span className="marker">better</span></>}
      lead={idea.review_note ? "Student Government left you a note. Fix what it asks for, save, and send the idea back to review from its page." : "Change what you need, then save."}
    >
      {idea.review_note && (
        <figure className="review-note">
          <figcaption>Student Government says</figcaption>
          <blockquote>{idea.review_note}</blockquote>
        </figure>
      )}
      <IdeaForm idea={idea} campus={me.campus_label} />
    </FormShell>
  );
}
