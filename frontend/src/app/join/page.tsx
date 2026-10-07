// Sign-up page. Signed-in visitors are sent on.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JoinForm } from "@/components/auth/JoinForm";
import { FormShell } from "@/components/forms/FormShell";
import { getMe } from "@/lib/server-api";

export const metadata: Metadata = { title: "Join" };

export default async function JoinPage() {
  const me = await getMe();
  if (me) redirect(me.status === "pending" ? "/verify" : "/personal");
  return (
    <FormShell
      eyebrow="Join the network" tone="teal" icon="community" note="free, takes 30 seconds"
      title={<>Join with your <span className="marker">uni e-mail</span></>}
      lead="Anyone can read ModernSI. Members pitch ideas, back the good ones and join teams. Your e-mail domain tells us which campus you belong to."
      below={<>Already a member? <Link href="/login">Log in</Link></>}
    >
      <JoinForm />
    </FormShell>
  );
}
