// Password reset, step one: ask for a code.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/ForgotForm";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <div className="wrap auth">
      <p className="eyebrow">Password</p>
      <h1>Reset your password</h1>
      <p className="lead-sm">Enter your e-mail and we will send a 6-digit reset code.</p>
      <ForgotForm />
      <p className="below">Remembered it? <Link href="/login">Log in</Link></p>
    </div>
  );
}
