// Support / withdraw support, with the live count. The API's answer is the source of truth for the count.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { IdeaStatus } from "@/lib/types";
import { Progress } from "../Progress";
import { useSubmit } from "../forms/useSubmit";

type VoteResult = { vote_count: number; status: IdeaStatus; my_vote: boolean };

export function VoteButton({ ideaId, voted, count, threshold }: { ideaId: string; voted: boolean; count: number; threshold: number }) {
  const router = useRouter();
  const { pending, error, run } = useSubmit();
  const [state, setState] = useState({ voted, count });

  function toggle() {
    run(async () => {
      const result = await api<VoteResult>(`/api/ideas/${ideaId}/vote`, { method: state.voted ? "DELETE" : "POST" });
      setState({ voted: result.my_vote, count: result.vote_count });
      // reaching the threshold moves the idea to review; the rest of the page has to follow
      if (result.status !== "open") router.refresh();
    });
  }

  return (
    <div className="stack">
      <Progress value={state.count} max={threshold} label="Support" />
      <p className="count muted"><b>{state.count} of {threshold}</b> students support this idea</p>
      <button className={state.voted ? "btn" : "btn btn-primary"} type="button" onClick={toggle} disabled={pending} aria-busy={pending}>
        {state.voted ? "Withdraw support" : "Support this idea"}
      </button>
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </div>
  );
}
