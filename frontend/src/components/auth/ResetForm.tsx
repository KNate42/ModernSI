// Sets a new password with the code from the e-mail, then sends the person to log in.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

export function ResetForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const { pending, error, run, fieldError } = useSubmit();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      await api("/api/auth/password/reset", { method: "POST", json: { email, code: code.trim(), password } });
      router.push("/login?reset=1");
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <FormError error={error} />
      <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} error={fieldError("email")} />
      <Field label="Reset code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} error={fieldError("code")} />
      <Field label="New password" type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters." value={password} onChange={(event) => setPassword(event.target.value)} error={fieldError("password")} />
      <div className="actions">
        <button className="btn btn-primary btn-large" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : "Set new password"}</button>
      </div>
    </form>
  );
}
