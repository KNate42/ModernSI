// Sends an edited idea back to Student Government.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useSubmit } from "../forms/useSubmit";

export function ResubmitButton({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const { pending, error, run } = useSubmit();

  function resubmit() {
    run(async () => {
      await api(`/api/ideas/${ideaId}/resubmit`, { method: "POST" });
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <button className="btn btn-primary" type="button" onClick={resubmit} disabled={pending}>Send back to review</button>
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </div>
  );
}
