// Event form page: for an idea with a full team (its author or a curator), or a free event (curators).
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EventForm } from "@/components/events/EventForm";
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
      <div className="wrap auth">
        <p className="eyebrow">On the Hub</p>
        <h1>Publish an event</h1>
        <p className="lead-sm">As a curator you can publish events that did not start as an idea.</p>
        <EventForm campus={me.campus_label} />
      </div>
    );
  }

  if (!isUuid(ideaId)) notFound();
  const idea = await apiFind<IdeaDetail>(`/api/ideas/${ideaId}`);
  if (!idea || !(idea.is_author || curator)) notFound();
  const ready = idea.status === "forming_team" && idea.team_size >= idea.team_min;
  return (
    <div className="wrap auth">
      <p className="breadcrumbs"><Link href={`/ideas/${idea.id}`}>{idea.title}</Link> / Put it on the Hub</p>
      <h1>Put it on the Hub</h1>
      {ready ? (
        <>
          <p className="lead-sm">Set the time and the place. The team gets an e-mail as soon as the event is published.</p>
          <EventForm idea={{ id: idea.id, title: idea.title }} campus={me.campus_label} />
        </>
      ) : (
        <p className="notice">
          {idea.status === "forming_team"
            ? `The team needs at least ${idea.team_min} people first; now it has ${idea.team_size}.`
            : "This idea is not gathering a team, so it cannot become a new event."}{" "}
          <Link href={`/ideas/${idea.id}`}>Back to the idea</Link>
        </p>
      )}
    </div>
  );
}
