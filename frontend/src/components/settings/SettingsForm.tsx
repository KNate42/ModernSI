// Profile settings: bio, languages, interests, links and theme. The theme applies at once.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { Profile } from "@/lib/types";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

type Theme = Profile["theme"];

function split(value: string, separator: RegExp): string[] {
  return value.split(separator).map((item) => item.trim()).filter(Boolean);
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  try {
    if (theme === "system") localStorage.removeItem("msi_theme");
    else localStorage.setItem("msi_theme", theme);
  } catch {
    // storage blocked: the profile still keeps the choice
  }
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { pending, error, run } = useSubmit();
  const [bio, setBio] = useState(profile.bio);
  const [languages, setLanguages] = useState(profile.languages.join(", "));
  const [interests, setInterests] = useState(profile.interests.join(", "));
  const [links, setLinks] = useState(profile.links.join("\n"));
  const [theme, setTheme] = useState<Theme>(profile.theme);
  const [saved, setSaved] = useState(false);

  // list fields come back as "links.0", "languages.3" and so on
  const listError = (name: string) => error?.fields.find((item) => item.field === name || item.field.startsWith(`${name}.`))?.message;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    run(async () => {
      await api("/api/profiles/me", {
        method: "PUT",
        json: { bio, languages: split(languages, /,/), interests: split(interests, /,/), links: split(links, /\s+/), theme },
      });
      applyTheme(theme);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      {!profile.extended && <p className="notice">Profile details cannot be edited right now. Try again in a few minutes.</p>}
      <fieldset disabled={!profile.extended} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 18 }}>
        <FormError error={error} />
        {saved && <p className="notice" role="status">Saved.</p>}
        <Field label="About me" multiline rows={4} maxLength={500} hint="Up to 500 characters." value={bio} onChange={(event) => setBio(event.target.value)} error={listError("bio")} />
        <Field label="Languages you speak" hint="Separate with commas, up to 10." value={languages} onChange={(event) => setLanguages(event.target.value)} error={listError("languages")} />
        <Field label="Interests" hint="Separate with commas, up to 15." value={interests} onChange={(event) => setInterests(event.target.value)} error={listError("interests")} />
        <Field label="Links" multiline rows={3} hint="One per line, up to 5: portfolio, code, social profiles." value={links} onChange={(event) => setLinks(event.target.value)} error={listError("links")} />
        <div className="field">
          <fieldset>
            <legend>Theme</legend>
            {(["system", "light", "dark"] as Theme[]).map((value) => (
              <label key={value} className="radio">
                <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} />
                {value === "system" ? "Follow my device" : value === "light" ? "Light" : "Dark"}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
        </div>
      </fieldset>
    </form>
  );
}
