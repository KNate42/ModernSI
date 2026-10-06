// Public profile: name, campus, role, bio, languages, interests and links.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { roleLabels } from "@/lib/format";
import { isUuid } from "@/lib/query";
import { apiFind, apiTry, getMe } from "@/lib/server-api";
import type { Profile } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = isUuid(id) ? await apiTry<Profile>(`/api/profiles/${id}`) : null;
  return { title: profile?.display_name ?? "Profile" };
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [profile, me] = await Promise.all([apiFind<Profile>(`/api/profiles/${id}`), getMe()]);
  if (!profile) notFound();

  return (
    <div className="wrap detail">
      <div className="page-head profile-head">
        {profile.has_avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar avatar-lg" src={`/api/profiles/${profile.id}/avatar`} alt="" />
        ) : (
          <span className="avatar avatar-lg" aria-hidden="true">{profile.display_name.slice(0, 1).toUpperCase()}</span>
        )}
        <div>
          <h1>{profile.display_name}</h1>
          <p>
            {profile.campus_label ?? "ModernSI"}
            {profile.role !== "student" && <> · <span className="badge badge-accent">{roleLabels[profile.role]}</span></>}
            {" · "}joined <LocalTime iso={profile.joined_at} mode="date" />
          </p>
          {me?.id === profile.id && <p><Link className="btn btn-small" href="/settings">Edit profile</Link></p>}
        </div>
      </div>
      {!profile.extended && <p className="notice">Some profile details are unavailable right now. Try again in a few minutes.</p>}
      {profile.bio && <p className="prose" style={{ maxWidth: "65ch", fontSize: 18 }}>{profile.bio}</p>}
      {profile.languages.length > 0 && (
        <section className="settings-block">
          <h2>Languages</h2>
          <ul className="tags">{profile.languages.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}
      {profile.interests.length > 0 && (
        <section className="settings-block">
          <h2>Interests</h2>
          <ul className="tags">{profile.interests.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}
      {profile.links.length > 0 && (
        <section className="settings-block">
          <h2>Links</h2>
          <ul className="team-list">
            {profile.links.map((link) => (
              <li key={link}><a href={link} target="_blank" rel="nofollow ugc noopener noreferrer">{link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
