// The "I'm in" button of the next event: the same RSVP calls as the event page, restyled for the night card.
// This work made by Anfinogentov Nikita
"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { useSubmit } from "../forms/useSubmit";
import { Going } from "./Going";

type RsvpResult = { going_count: number; i_am_going: boolean };

export function RsvpIn({ eventId, going, count }: { eventId: string; going: boolean; count: number }) {
  const { pending, error, run } = useSubmit();
  const [state, setState] = useState({ going, count });

  function toggle() {
    run(async () => {
      const result = await api<RsvpResult>(`/api/events/${eventId}/rsvp`, { method: state.going ? "DELETE" : "POST" });
      setState({ going: result.i_am_going, count: result.going_count });
    });
  }

  return (
    <>
      <button className={state.going ? "btn btn-ghost btn-large" : "btn btn-butter btn-large"} type="button" onClick={toggle} disabled={pending} aria-busy={pending}>
        {state.going ? "Cancel my spot" : "I'm in"}
      </button>
      <Going count={state.count} you={state.going} />
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </>
  );
}
