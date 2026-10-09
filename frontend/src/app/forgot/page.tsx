// Password reset, step one: ask for a code.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/ForgotForm";
import { FormShell } from "@/components/forms/FormShell";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <FormShell
      eyebrow="Password" tone="steel" icon="key"
      title={<>Forgot it? <span className="marker">No stress.</span></>}
      lead="Type your e-mail and we send you a 6-digit code. It works for 15 minutes."
      below={<>Remembered it? <Link href="/login">Log in</Link></>}
    >
      <ForgotForm />
    </FormShell>
  );
}
