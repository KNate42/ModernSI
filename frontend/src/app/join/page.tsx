// Sign-up page. Signed-in visitors are sent on.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JoinForm } from "@/components/auth/JoinForm";
import { getMe } from "@/lib/server-api";

export const metadata: Metadata = { title: "Join" };

export default async function JoinPage() {
  const me = await getMe();
  if (me) redirect(me.status === "pending" ? "/verify" : "/personal");
  return (
    <div className="wrap auth">
      <p className="eyebrow">Join the network</p>
      <h1>Create your account</h1>
      <p className="lead-sm">Sign up with your university e-mail. Anyone can read ModernSI; members propose ideas, vote and join teams.</p>
      <JoinForm />
      <p className="below">Already a member? <Link href="/login">Log in</Link></p>
    </div>
  );
}
