// Event form page: for an idea with a full team (its author or a curator), or a free event (curators).
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EventForm } from "@/components/events/EventForm";
import { FormShell } from "@/components/forms/FormShell";
import { Notice } from "@/components/forms/Notice";
import { firstParam, isUuid, qs } from "@/lib/query";
import { apiFind, getMe } from "@/lib/server-api";
import type { IdeaDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Publish an event" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewEventPage({ searchParams }: Props) {
  const params = await searchParams;
  const ideaId = firstParam(params.idea);
  const me = await getMe();
  if (!me) redirect(`/login${qs({ next: `/events/new${qs({ idea: ideaId })}` })}`);
  if (me.status === "pending") redirect("/verify");
  const curator = me.role === "curator" || me.role === "admin";

  if (ideaId === undefined) {
    if (!curator) notFound();
    return (
      <FormShell
        eyebrow="On the calendar" tone="teal" icon="events"
        title={<>Publish an <span className="marker">event</span></>}
        lead="As a curator you can publish events that did not start as an idea. Set the time, the place and say what to bring."
      >
        <EventForm campus={me.campus_label} />
      </FormShell>
    );
  }

  if (!isUuid(ideaId)) notFound();
  const idea = await apiFind<IdeaDetail>(`/api/ideas/${ideaId}`);
  if (!idea || !(idea.is_author || curator)) notFound();
  const ready = idea.status === "forming_team" && idea.team_size >= idea.team_min;
  return (
    <FormShell
      eyebrow="Last step" tone="teal" icon="events"
      crumbs={<p className="breadcrumbs"><Link href={`/ideas/${idea.id}`}>{idea.title}</Link> / Put it on the calendar</p>}
      title={<>Put it on the <span className="marker">calendar</span></>}
      lead={ready ? "Set the time and the place. The team gets an e-mail as soon as the event is published." : undefined}
    >
      {ready ? (
        <EventForm idea={{ id: idea.id, title: idea.title }} campus={me.campus_label} />
      ) : (
        <Notice kind="info">
          {idea.status === "forming_team"
            ? `The team needs at least ${idea.team_min} people first; now it has ${idea.team_size}.`
            : "This idea is not gathering a team, so it cannot become a new event."}{" "}
          <Link href={`/ideas/${idea.id}`}>Back to the idea</Link>
        </Notice>
      )}
    </FormShell>
  );
}
