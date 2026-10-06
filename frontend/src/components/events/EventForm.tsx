// Event form. Times are typed on the visitor's own clock and sent to the API as absolute instants.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { EventItem, Scope } from "@/lib/types";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

// "2026-10-07T18:30" from <input type="datetime-local"> has no timezone; Date reads it as local time
export function toInstant(localValue: string): string {
  return new Date(localValue).toISOString();
}

export function EventForm({ idea, campus }: { idea?: { id: string; title: string }; campus: string | null }) {
  const router = useRouter();
  const { pending, error, run, fieldError } = useSubmit();
  const [title, setTitle] = useState(idea?.title ?? "");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [place, setPlace] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<Scope>("network");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      const created = await api<EventItem>("/api/events", {
        method: "POST",
        json: {
          title, description_md: description, starts_at: toInstant(starts), ends_at: toInstant(ends),
          location_text: place.trim() || null, online_url: link.trim() || null, idea_id: idea?.id ?? null, scope,
        },
      });
      router.push(`/events/${created.id}`);
      router.refresh();
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <FormError error={error} />
      <Field label="Title" required minLength={5} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} error={fieldError("title")} />
      <div className="row">
        <Field label="Starts" type="datetime-local" required value={starts} onChange={(event) => setStarts(event.target.value)} error={fieldError("starts_at")} />
        <Field label="Ends" type="datetime-local" required value={ends} onChange={(event) => setEnds(event.target.value)} error={fieldError("ends_at")} />
      </div>
      <p className="hint">Times are in your timezone; everyone else sees them in theirs.</p>
      <Field label="Place" maxLength={200} hint="A room, a building or an address. Leave empty for an online event." value={place} onChange={(event) => setPlace(event.target.value)} error={fieldError("location_text")} />
      <Field label="Online link" type="url" hint="Starts with https://. Leave empty for an in-person event." value={link} onChange={(event) => setLink(event.target.value)} error={fieldError("online_url")} />
      {!idea && (
        <div className="field">
          <fieldset>
            <legend>Who is it for</legend>
            <label className="radio"><input type="radio" name="scope" value="network" checked={scope === "network"} onChange={() => setScope("network")} /> Whole network</label>
            <label className="radio"><input type="radio" name="scope" value="campus" checked={scope === "campus"} onChange={() => setScope("campus")} /> My campus{campus ? ` (${campus})` : ""}</label>
          </fieldset>
        </div>
      )}
      <Field
        label="Description" multiline rows={6} maxLength={5000} hint="Optional. Markdown works."
        value={description} onChange={(event) => setDescription(event.target.value)} error={fieldError("description_md")}
      />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Publishing…" : "Publish event"}</button>
      </div>
    </form>
  );
}
