// "I'm in" / "Cancel my spot" with the live count.
// This work made by Anfinogentov Nikita
"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { useSubmit } from "../forms/useSubmit";

type RsvpResult = { going_count: number; i_am_going: boolean };

export function RsvpButton({ eventId, going, count }: { eventId: string; going: boolean; count: number }) {
  const { pending, error, run } = useSubmit();
  const [state, setState] = useState({ going, count });

  function toggle() {
    run(async () => {
      const result = await api<RsvpResult>(`/api/events/${eventId}/rsvp`, { method: state.going ? "DELETE" : "POST" });
      setState({ going: result.i_am_going, count: result.going_count });
    });
  }

  return (
    <div className="stack">
      <p className="count muted"><b>{state.count} going</b></p>
      <button className={state.going ? "btn" : "btn btn-primary"} type="button" onClick={toggle} disabled={pending} aria-busy={pending}>
        {state.going ? "Cancel my spot" : "I'm in"}
      </button>
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </div>
  );
}
