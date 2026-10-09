// Settings: photo, profile details, theme and sessions.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { AvatarUpload } from "@/components/settings/AvatarUpload";
import { LogoutEverywhere } from "@/components/settings/LogoutEverywhere";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { apiGet, getMe } from "@/lib/server-api";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/settings");
  if (me.status === "pending") redirect("/verify");
  const profile = await apiGet<Profile>("/api/profiles/me");
  return (
    <>
      <PageHero
        tone="steel" icon="personal" eyebrow="Make it yours"
        crumbs={<p className="breadcrumbs"><Link href={`/profile/${me.id}`}>{me.display_name}</Link> / Settings</p>}
        title={<>Your <span className="marker">settings</span></>}
        lead={`Signed in as ${me.email}${me.campus_label ? ` · ${me.campus_label}` : ""}.`}
      />
      <div className="wrap detail settings">
        <section className="paper">
          <h2>Profile photo</h2>
          <AvatarUpload userId={me.id} hasAvatar={profile.has_avatar} name={me.display_name} />
        </section>
        <section className="paper">
          <h2>About you</h2>
          <SettingsForm profile={profile} />
        </section>
        <section className="paper">
          <h2>Sessions</h2>
          <p className="muted">Lost a phone or used a shared computer? This logs you out everywhere, including here.</p>
          <LogoutEverywhere />
        </section>
      </div>
    </>
  );
}
