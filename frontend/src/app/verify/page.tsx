// E-mail confirmation page for accounts that are signed in but not confirmed yet.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/auth/VerifyForm";
import { FormShell } from "@/components/forms/FormShell";
import { getMe } from "@/lib/server-api";

export const metadata: Metadata = { title: "Confirm your e-mail" };

export default async function VerifyPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/verify");
  if (me.status !== "pending") redirect("/personal");
  return (
    <FormShell
      eyebrow="One more step" icon="mail"
      title={<>Check your <span className="marker">inbox</span></>}
      lead={<>We sent a 6-digit code to <span className="break-anywhere">{me.email}</span>. It works for 15 minutes.</>}
    >
      <VerifyForm email={me.email} />
    </FormShell>
  );
}
