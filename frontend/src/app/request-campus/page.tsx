// Request to add a university to the network.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { RequestCampusForm } from "@/components/auth/RequestCampusForm";
import { FormShell } from "@/components/forms/FormShell";
import { firstParam } from "@/lib/query";

export const metadata: Metadata = { title: "Add your university" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RequestCampusPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <FormShell
      eyebrow="Campus network" tone="teal" icon="international" note="not on the list?"
      title={<>Add your <span className="marker">university</span></>}
      lead="ModernSI opens sign-up university by university. Tell us where you study. Once the admins add your e-mail domain, we write to you and you can join."
    >
      <RequestCampusForm initialEmail={firstParam(params.email) ?? ""} />
    </FormShell>
  );
}
