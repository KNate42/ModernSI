// Light/dark switch in the footer. Guests keep the choice in localStorage; signed-in users also save it to their profile.
// This work made by Anfinogentov Nikita
"use client";
import { useSyncExternalStore } from "react";
import { api } from "@/lib/client-api";
import type { Profile } from "@/lib/types";
import { Icon } from "./Icon";

// The theme lives on <html data-theme> (set by the head script and by this switch) or in the system setting,
// so I read it as an external store: no state to keep in sync and no hydration mismatch (the server snapshot is "light").
function subscribe(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const system = matchMedia("(prefers-color-scheme: dark)");
  system.addEventListener("change", notify);
  return () => {
    observer.disconnect();
    system.removeEventListener("change", notify);
  };
}

function isDark() {
  const chosen = document.documentElement.dataset.theme;
  return chosen ? chosen === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeToggle({ signedIn }: { signedIn: boolean }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  async function toggle() {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
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
    <button className="theme-toggle" type="button" role="switch" aria-checked={dark} onClick={toggle}>
      <span className="theme-icon theme-icon-light">
        <Icon name="sun" />
      </span>
      <span className="theme-icon theme-icon-dark">
        <Icon name="moon" />
      </span>
      <span className="theme-label">Dark theme</span>
      <span className="theme-track" aria-hidden="true"><span className="theme-knob" /></span>
    </button>
  );
}
