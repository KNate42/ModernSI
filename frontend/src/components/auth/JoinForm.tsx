// Sign-up form. An unknown university domain leads to the campus request instead of a dead end.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { qs } from "@/lib/query";
import { Field } from "../forms/Field";
import { Notice } from "../forms/Notice";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

export function JoinForm() {
  const router = useRouter();
  const { pending, error, run, fieldError } = useSubmit();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      await api("/api/auth/register", { method: "POST", json: { email, display_name: name, password } });
      router.push("/verify");
      router.refresh();
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      {error?.code === "domain_not_allowed" ? (
        <Notice kind="error" role="alert">
          <p>Your university is not on ModernSI yet.</p>
          <Link href={`/request-campus${qs({ email: email.trim() })}`}>Ask us to add it</Link>
        </Notice>
      ) : (
        <FormError error={error} />
      )}
      <Field label="University e-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} error={fieldError("email")} />
      <Field label="Your name" autoComplete="name" required minLength={2} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} error={fieldError("display_name")} />
      <Field label="Password" type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters." value={password} onChange={(event) => setPassword(event.target.value)} error={fieldError("password")} />
      <div className="actions">
        <button className="btn btn-primary btn-large" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Creating…" : "Create account"}</button>
      </div>
    </form>
  );
}
