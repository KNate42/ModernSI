// Proposal form page. Only confirmed members can propose.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IdeaForm } from "@/components/ideas/IdeaForm";
import { getMe } from "@/lib/server-api";

export const metadata: Metadata = { title: "Propose an idea" };

export default async function NewIdeaPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/ideas/new");
  if (me.status === "pending") redirect("/verify");
  return (
    <div className="wrap auth">
      <p className="eyebrow">Student ideas → real initiatives</p>
      <h1>Propose an idea</h1>
      <p className="lead-sm">
        Describe what you want to happen and who it is for. Other students support it with their votes; with enough support,
        Student Government reviews it and a team forms around it.
      </p>
      <IdeaForm campus={me.campus_label} />
    </div>
  );
}
