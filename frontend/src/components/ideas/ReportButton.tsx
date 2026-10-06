// Reports an idea to the admins. One report per person per idea.
// This work made by Anfinogentov Nikita
"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Field } from "../forms/Field";
import { useSubmit } from "../forms/useSubmit";

export function ReportButton({ ideaId }: { ideaId: string }) {
  const { pending, error, run, fieldError } = useSubmit();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      await api(`/api/ideas/${ideaId}/report`, { method: "POST", json: { reason } });
      setSent(true);
    });
  }

  if (sent) return <p className="muted" role="status">Thanks, the admins will take a look.</p>;
  if (!open) return <button className="link-button" type="button" onClick={() => setOpen(true)}>Report this idea</button>;
  return (
    <form className="form" onSubmit={onSubmit}>
      <Field label="What is wrong with this idea?" multiline rows={3} required minLength={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} error={fieldError("reason")} />
      {error && !error.fields.length && <p className="field-error" role="alert">{error.message}</p>}
      <div className="actions">
        <button className="btn btn-small" type="submit" disabled={pending}>Send report</button>
        <button className="link-button" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
