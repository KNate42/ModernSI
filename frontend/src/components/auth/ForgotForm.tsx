// Asks for a password reset code. The answer is the same whether or not the address has an account.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { qs } from "@/lib/query";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

export function ForgotForm() {
  const { pending, error, run, fieldError } = useSubmit();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      await api("/api/auth/password/forgot", { method: "POST", json: { email } });
      setSentTo(email.trim());
    });
  }

  if (sentTo) {
    return (
      <div className="notice" role="status">
        <p style={{ margin: "0 0 8px" }}>If {sentTo} has an account, a reset code is on its way. It works for 15 minutes.</p>
        <Link href={`/reset${qs({ email: sentTo })}`}>Enter the code</Link>
      </div>
    );
  }
  return (
    <form className="form" onSubmit={onSubmit}>
      <FormError error={error} />
      <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} error={fieldError("email")} />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset code"}</button>
      </div>
    </form>
  );
}
