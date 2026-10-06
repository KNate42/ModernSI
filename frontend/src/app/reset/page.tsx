// Password reset, step two: the code and a new password.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/auth/ResetForm";
import { firstParam } from "@/lib/query";

export const metadata: Metadata = { title: "Set a new password" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ResetPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <div className="wrap auth">
      <p className="eyebrow">Password</p>
      <h1>Set a new password</h1>
      <p className="lead-sm">Enter the code from the e-mail and choose a new password. Every device will be logged out.</p>
      <ResetForm initialEmail={firstParam(params.email) ?? ""} />
      <p className="below">No code yet? <Link href="/forgot">Send one</Link></p>
    </div>
  );
}
