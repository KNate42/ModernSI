// One idea: description, status, support, review, team and the events it became.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { Progress } from "@/components/Progress";
import { DecisionForm } from "@/components/ideas/DecisionForm";
import { ReportButton } from "@/components/ideas/ReportButton";
import { ResubmitButton } from "@/components/ideas/ResubmitButton";
import { TeamButton } from "@/components/ideas/TeamButton";
import { VoteButton } from "@/components/ideas/VoteButton";
import { categoryLabels, scopeText, statusLabels } from "@/lib/format";
import { isUuid, qs } from "@/lib/query";
import { apiFind, apiTry, getMe } from "@/lib/server-api";
import type { EventItem, IdeaDetail, Me, Page } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const idea = isUuid(id) ? await apiTry<IdeaDetail>(`/api/ideas/${id}`) : null;
  return { title: idea?.title ?? "Idea" };
}

function StatusPanel({ idea, me }: { idea: IdeaDetail; me: Me | null }) {
  const active = me?.status === "active";
  const loginLink = `/login${qs({ next: `/ideas/${idea.id}` })}`;
  const curator = me?.role === "curator" || me?.role === "admin";
  const reviewer = me?.role === "student_gov" || me?.role === "admin";

  if (idea.status === "open") {
    if (active && !idea.is_author) {
      return <VoteButton ideaId={idea.id} voted={idea.my_vote} count={idea.vote_count} threshold={idea.vote_threshold} />;
    }
    return (
      <div className="stack">
        <Progress value={idea.vote_count} max={idea.vote_threshold} label="Support" />
        <p className="count muted"><b>{idea.vote_count} of {idea.vote_threshold}</b> students support this idea</p>
        <p className="muted">Open for support until <LocalTime iso={idea.expires_at} mode="date" />.</p>
        {!me && <Link className="btn btn-primary" href={loginLink}>Log in to support it</Link>}
        {me?.status === "pending" && <Link className="btn btn-primary" href="/verify">Confirm your e-mail to support it</Link>}
        {idea.is_author && <p className="muted">This is your idea. Share the link so other students can support it.</p>}
      </div>
    );
  }
  if (idea.status === "in_review") {
    return (
      <div className="stack">
        <p>Student Government is reviewing this idea.</p>
        {reviewer && <DecisionForm ideaId={idea.id} />}
      </div>
    );
  }
  if (idea.status === "needs_changes" || idea.status === "rejected") {
    return (
      <div className="stack">
        <p>{idea.status === "rejected" ? "Student Government decided not to take this idea further." : "Student Government asked for changes."}</p>
        {idea.review_note && <blockquote className="note">{idea.review_note}</blockquote>}
        {idea.status === "needs_changes" && idea.is_author && <ResubmitButton ideaId={idea.id} />}
      </div>
    );
  }
  if (idea.status === "forming_team") {
    const ready = idea.team_size >= idea.team_min;
    return (
      <div className="stack">
        <p>Approved! Now it needs a team to make it happen.</p>
        {active ? (
          <TeamButton ideaId={idea.id} inTeam={idea.in_team} size={idea.team_size} min={idea.team_min} canLeave={!idea.is_author} />
        ) : (
          <>
            <Progress value={idea.team_size} max={idea.team_min} label="Team" />
            <p className="count muted"><b>{idea.team_size} of {idea.team_min}</b> people in the team</p>
            {!me && <Link className="btn btn-primary" href={loginLink}>Log in to join the team</Link>}
            {me?.status === "pending" && <Link className="btn btn-primary" href="/verify">Confirm your e-mail to join</Link>}
          </>
        )}
        {active && (idea.is_author || curator) && (ready
          ? <Link className="btn btn-primary" href={`/events/new?idea=${idea.id}`}>Put it on the Hub</Link>
          : <p className="muted">When {idea.team_min} people are in the team, you can put it on the Hub as an event.</p>)}
      </div>
    );
  }
  if (idea.status === "live") return <p>This idea is on the Hub as an event.</p>;
  if (idea.status === "done") return <p>This idea became an event that has already taken place.</p>;
  return <p>This idea did not collect enough support in time.</p>;
}

export default async function IdeaPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [idea, me] = await Promise.all([apiFind<IdeaDetail>(`/api/ideas/${id}`), getMe()]);
  if (!idea) notFound();
  const hasEvents = idea.status === "live" || idea.status === "done";
  const [upcoming, past] = hasEvents
    ? await Promise.all([
        apiTry<Page<EventItem>>(`/api/events${qs({ idea: id, when: "upcoming" })}`),
        apiTry<Page<EventItem>>(`/api/events${qs({ idea: id, when: "past" })}`),
      ])
    : [null, null];
  const events = [...(upcoming?.items ?? []), ...(past?.items ?? [])];
  const showTeam = ["forming_team", "live", "done"].includes(idea.status);
  const active = me?.status === "active";

  return (
    <div className="wrap detail">
      <div className="page-head">
        <p className="breadcrumbs"><Link href="/ideas">Ideas</Link> / {categoryLabels[idea.category]}</p>
        <div className="badges">
          <span className="badge">{categoryLabels[idea.category]} · {scopeText(idea.scope, idea.campus_label)}</span>
          <span className="badge badge-accent">{statusLabels[idea.status]}</span>
        </div>
        <h1>{idea.title}</h1>
        <p>{idea.summary}</p>
      </div>
      {idea.is_hidden && (
        <p className="notice notice-error">An admin has hidden this idea from the network. Only you and the admins can see it.</p>
      )}
      <div className="grid-2">
        <article>
          {idea.body_html ? (
            <div className="prose" dangerouslySetInnerHTML={{ __html: idea.body_html }} />
          ) : (
            <p className="muted">The author has not added more details.</p>
          )}
          <p className="byline">
            Proposed by <Link href={`/profile/${idea.author.id}`}>{idea.author.display_name}</Link>
            {idea.author.campus_label ? ` · ${idea.author.campus_label}` : ""} · <LocalTime iso={idea.created_at} mode="date" />
          </p>
          {showTeam && idea.team.length > 0 && (
            <>
              <h2 style={{ fontSize: 22, marginTop: 32 }}>Team</h2>
              <ul className="team-list" aria-label="Team">
                {idea.team.map((member) => (
                  <li key={member.id}>
                    <span className="avatar" aria-hidden="true">{member.display_name.slice(0, 1).toUpperCase()}</span>
                    <Link href={`/profile/${member.id}`}>{member.display_name}</Link>
                    {member.campus_label && <span className="muted">· {member.campus_label}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {events.length > 0 && (
            <>
              <h2 style={{ fontSize: 22, marginTop: 32 }}>On the Hub</h2>
              <ul className="team-list">
                {events.map((event) => (
                  <li key={event.id}><Link href={`/events/${event.id}`}>{event.title}</Link> <span className="muted">· <LocalTime iso={event.starts_at} /></span></li>
                ))}
              </ul>
            </>
          )}
        </article>
        <aside className="card aside stack">
          <StatusPanel idea={idea} me={me} />
          {idea.can_edit && <Link className="btn" href={`/ideas/${idea.id}/edit`}>Edit idea</Link>}
          {active && !idea.is_author && <ReportButton ideaId={idea.id} />}
        </aside>
      </div>
    </div>
  );
}
