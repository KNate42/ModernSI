// Pitch form page. Only confirmed members can pitch.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormShell } from "@/components/forms/FormShell";
import { IdeaForm } from "@/components/ideas/IdeaForm";
import { getMe } from "@/lib/server-api";

export const metadata: Metadata = { title: "Pitch an idea" };

const tips = [
  "Name it the way you would say it out loud.",
  "One or two sentences in the summary. That is what everyone sees in the lists.",
  "Say who it is for: your campus or the whole network.",
];

export default async function NewIdeaPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/ideas/new");
  if (me.status === "pending") redirect("/verify");
  return (
    <FormShell
      eyebrow="Pitch it" icon="ideas" tips={tips}
      title={<>Pitch an <span className="marker">idea</span></>}
      lead="Say what should happen and who it is for. Other students back it with their votes. With enough votes Student Government takes a look, and a crew forms around it."
    >
      <IdeaForm campus={me.campus_label} />
    </FormShell>
  );
}
