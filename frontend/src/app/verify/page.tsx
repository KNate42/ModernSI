// E-mail confirmation page for accounts that are signed in but not confirmed yet.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/auth/VerifyForm";
import { getMe } from "@/lib/server-api";

export const metadata: Metadata = { title: "Confirm your e-mail" };

export default async function VerifyPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/verify");
  if (me.status !== "pending") redirect("/personal");
  return (
    <div className="wrap auth">
      <p className="eyebrow">One more step</p>
      <h1>Confirm your e-mail</h1>
      <p className="lead-sm">We sent a 6-digit code to {me.email}. It works for 15 minutes.</p>
      <VerifyForm email={me.email} />
    </div>
  );
}
