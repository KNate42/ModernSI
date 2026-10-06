// Asks the admins to add a university. The domain is filled in from the e-mail until the person edits it.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

export function RequestCampusForm({ initialEmail }: { initialEmail: string }) {
  const { pending, error, run, fieldError } = useSubmit();
  const [email, setEmail] = useState(initialEmail);
  const [university, setUniversity] = useState("");
  const [domain, setDomain] = useState(domainOf(initialEmail));
  const [domainEdited, setDomainEdited] = useState(false);
  const [sent, setSent] = useState<{ email: string; domain: string } | null>(null);

  function onEmail(value: string) {
    setEmail(value);
    if (!domainEdited) setDomain(domainOf(value));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      await api("/api/campuses/requests", { method: "POST", json: { domain, university_name: university, requester_email: email } });
      setSent({ email: email.trim(), domain: domain.trim().toLowerCase() });
    });
  }

  if (sent) {
    return <div className="notice" role="status">Thanks! We will write to {sent.email} as soon as {sent.domain} is on the network.</div>;
  }
  return (
    <form className="form" onSubmit={onSubmit}>
      {error?.code === "domain_already_allowed" ? (
        <div className="notice" role="status">
          <p style={{ margin: "0 0 8px" }}>Good news: {domain} is already on the network.</p>
          <Link href="/join">Create your account</Link>
        </div>
      ) : (
        <FormError error={error} />
      )}
      <Field label="Your university e-mail" type="email" autoComplete="email" required value={email} onChange={(event) => onEmail(event.target.value)} error={fieldError("requester_email")} />
      <Field label="University name" required minLength={2} maxLength={160} value={university} onChange={(event) => setUniversity(event.target.value)} error={fieldError("university_name")} />
      <Field
        label="E-mail domain" required hint="The part after @ in student addresses, for example uni.edu." value={domain}
        onChange={(event) => { setDomainEdited(true); setDomain(event.target.value); }} error={fieldError("domain")}
      />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Send request"}</button>
      </div>
    </form>
  );
}
