// Password reset, step two: the code and a new password.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/auth/ResetForm";
import { FormShell } from "@/components/forms/FormShell";
import { firstParam } from "@/lib/query";

export const metadata: Metadata = { title: "Set a new password" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ResetPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <FormShell
      eyebrow="Password" tone="steel" icon="key"
      title={<>Pick a new <span className="marker">password</span></>}
      lead="Enter the code from the e-mail and choose a new password. Every device will be logged out."
      below={<>No code yet? <Link href="/forgot">Send one</Link></>}
    >
      <ResetForm initialEmail={firstParam(params.email) ?? ""} />
    </FormShell>
  );
}
