// Student Government's decision on an idea in review. Rejecting or asking for changes needs a note.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

type Decision = "approve" | "needs_changes" | "reject";

export function DecisionForm({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const { pending, error, run } = useSubmit();
  const [note, setNote] = useState("");
  const [needNote, setNeedNote] = useState(false);

  function decide(decision: Decision) {
    if (decision !== "approve" && !note.trim()) {
      setNeedNote(true);
      return;
    }
    setNeedNote(false);
    run(async () => {
      await api(`/api/ideas/${ideaId}/decision`, { method: "POST", json: { decision, note: note.trim() || null } });
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <h2>Your decision</h2>
      <FormError error={error} />
      <Field
        label="Note for the author" multiline rows={4} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)}
        hint="The author gets it by e-mail." error={needNote ? "Write a note so the author knows what to change." : undefined}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button className="btn btn-primary" type="button" disabled={pending} onClick={() => decide("approve")}>Approve</button>
        <button className="btn" type="button" disabled={pending} onClick={() => decide("needs_changes")}>Ask for changes</button>
        <button className="btn" type="button" disabled={pending} onClick={() => decide("reject")}>Reject</button>
      </div>
    </div>
  );
}
