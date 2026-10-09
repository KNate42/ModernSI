// Pitch or edit an idea. While an idea collects votes its category is fixed, so the select is locked.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { api } from "@/lib/client-api";
import { categoryLabels } from "@/lib/format";
import type { Category, IdeaDetail, Scope } from "@/lib/types";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

export function IdeaForm({ idea, campus }: { idea?: IdeaDetail; campus: string | null }) {
  const router = useRouter();
  const id = useId();
  const { pending, error, run, fieldError } = useSubmit();
  const [title, setTitle] = useState(idea?.title ?? "");
  const [summary, setSummary] = useState(idea?.summary ?? "");
  const [category, setCategory] = useState<Category | "">(idea?.category ?? "");
  const [scope, setScope] = useState<Scope>(idea?.scope ?? "network");
  const [body, setBody] = useState(idea?.body_md ?? "");
  const categoryLocked = idea?.status === "open";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      const json = { title, summary, body_md: body, scope, ...(categoryLocked ? {} : { category }) };
      const saved = idea
        ? await api<IdeaDetail>(`/api/ideas/${idea.id}`, { method: "PATCH", json })
        : await api<IdeaDetail>("/api/ideas", { method: "POST", json });
      router.push(`/ideas/${saved.id}`);
      router.refresh();
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <FormError error={error} />
      <Field label="Title" required minLength={5} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} error={fieldError("title")} />
      <Field
        label="Short summary" multiline rows={3} required minLength={10} maxLength={280} hint="One or two sentences. This is what people see in lists."
        value={summary} onChange={(event) => setSummary(event.target.value)} error={fieldError("summary")}
      />
      <div className="field">
        <label htmlFor={`${id}-category`}>Category</label>
        <select
          id={`${id}-category`} className="select" required disabled={categoryLocked} value={category}
          onChange={(event) => setCategory(event.target.value as Category)} aria-describedby={categoryLocked ? `${id}-locked` : undefined}
        >
          <option value="" disabled>Choose a category</option>
          {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {categoryLocked && <p id={`${id}-locked`} className="hint">The category stays fixed while the idea collects support.</p>}
        {fieldError("category") && <p className="field-error">{fieldError("category")}</p>}
      </div>
      <div className="field">
        <fieldset>
          <legend>Who is it for</legend>
          <label className="radio"><input type="radio" name="scope" value="network" checked={scope === "network"} onChange={() => setScope("network")} /> Whole network</label>
          <label className="radio"><input type="radio" name="scope" value="campus" checked={scope === "campus"} onChange={() => setScope("campus")} /> My campus{campus ? ` (${campus})` : ""}</label>
        </fieldset>
      </div>
      <Field
        label="Details" multiline rows={8} maxLength={10000} hint="Optional. Markdown works: **bold**, lists, links."
        value={body} onChange={(event) => setBody(event.target.value)} error={fieldError("body_md")}
      />
      <div className="actions">
        <button className="btn btn-primary btn-large" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : idea ? "Save changes" : "Pitch it"}</button>
      </div>
    </form>
  );
}
