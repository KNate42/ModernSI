// Join / leave the team of an approved idea, with the live team size.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Progress } from "../Progress";
import { useSubmit } from "../forms/useSubmit";

type TeamResult = { team_size: number; in_team: boolean; status: string };

// quiet: the page has a more important crimson button (put it on the calendar), so joining is a plain one
export function TeamButton({ ideaId, inTeam, size, min, canLeave, quiet = false }: { ideaId: string; inTeam: boolean; size: number; min: number; canLeave: boolean; quiet?: boolean }) {
  const router = useRouter();
  const { pending, error, run } = useSubmit();
  const [state, setState] = useState({ inTeam, size });

  function toggle() {
    run(async () => {
      const result = await api<TeamResult>(`/api/ideas/${ideaId}/team`, { method: state.inTeam ? "DELETE" : "POST" });
      setState({ inTeam: result.in_team, size: result.team_size });
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <Progress value={state.size} max={min} label="Team" />
      <p className="count muted"><b>{state.size} of {min}</b> people in the team</p>
      {(!state.inTeam || canLeave) && (
        <button className={state.inTeam || quiet ? "btn" : "btn btn-primary"} type="button" onClick={toggle} disabled={pending} aria-busy={pending}>
          {state.inTeam ? "Leave the team" : "Join the team"}
        </button>
      )}
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </div>
  );
}
