// Light/dark switch. Guests keep the choice in localStorage; signed-in users also save it to their profile.
// This work made by Anfinogentov Nikita
"use client";
import { api } from "@/lib/client-api";
import type { Profile } from "@/lib/types";

export function ThemeToggle({ signedIn }: { signedIn: boolean }) {
  async function toggle() {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("msi_theme", next);
    } catch {
      // storage blocked: the choice lasts until reload
    }
    if (!signedIn) return;
    try {
      const profile = await api<Profile>("/api/profiles/me");
      const { bio, languages, interests, links } = profile;
      await api("/api/profiles/me", { method: "PUT", json: { bio, languages, interests, links, theme: next } });
    } catch {
      // unconfirmed accounts cannot save a profile yet; the local choice still applies
    }
  }

  return (
    <button className="icon-btn" type="button" onClick={toggle} aria-label="Switch colour theme">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
    </button>
  );
}
