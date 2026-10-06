// Login form. Unconfirmed accounts go to the code page; everyone else to a safe "next" path.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { safeNext } from "@/lib/query";
import type { Me } from "@/lib/types";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

export function LoginForm({ next, reset }: { next?: string; reset: boolean }) {
  const router = useRouter();
  const { pending, error, run, fieldError } = useSubmit();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      const me = await api<Me>("/api/auth/login", { method: "POST", json: { email, password } });
      router.push(me.status === "pending" ? "/verify" : safeNext(next));
      router.refresh();
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      {reset && !error && <div className="notice" role="status">Your password is changed. Log in with the new one.</div>}
      <FormError error={error} />
      <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} error={fieldError("email")} />
      <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} error={fieldError("password")} />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Logging in…" : "Log in"}</button>
      </div>
    </form>
  );
}
