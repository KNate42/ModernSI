// E-mail confirmation: the 6-digit code, plus a way to get a new one.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

export function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const confirm = useSubmit();
  const resend = useSubmit();
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    confirm.run(async () => {
      await api("/api/auth/verify", { method: "POST", json: { code: code.trim() } });
      router.push("/personal");
      router.refresh();
    });
  }

  function onResend() {
    setResent(false);
    resend.run(async () => {
      await api("/api/auth/verify/resend", { method: "POST" });
      setResent(true);
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <FormError error={confirm.error ?? resend.error} />
      {resent && <div className="notice" role="status">We sent a new code to {email}.</div>}
      <Field label="Confirmation code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} error={confirm.fieldError("code")} />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={confirm.pending}>{confirm.pending ? "Checking…" : "Confirm"}</button>
        <button className="link-button" type="button" onClick={onResend} disabled={resend.pending}>Send a new code</button>
      </div>
    </form>
  );
}
