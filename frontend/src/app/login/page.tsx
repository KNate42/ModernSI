// Login page. ?next= brings people back where they were; ?reset=1 confirms a password change.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { FormShell } from "@/components/forms/FormShell";
import { firstParam, safeNext } from "@/lib/query";
import { getMe } from "@/lib/server-api";

export const metadata: Metadata = { title: "Log in" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = firstParam(params.next);
  const me = await getMe();
  if (me) redirect(me.status === "pending" ? "/verify" : safeNext(next));
  return (
    <FormShell
      eyebrow="Welcome back" icon="personal"
      title={<>Good to see you <span className="marker">again</span></>}
      lead="Log in with the university e-mail you signed up with."
      below={<><Link href="/forgot">Forgot your password?</Link> · New here? <Link href="/join">Create an account</Link></>}
    >
      <LoginForm next={next} reset={firstParam(params.reset) === "1"} />
    </FormShell>
  );
}
