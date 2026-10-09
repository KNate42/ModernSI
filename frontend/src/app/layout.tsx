// Root layout: self-hosted fonts, theme (profile for users, localStorage for guests), motion and intro flags, header, footer and phone bar.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource/caveat/latin-400.css";
import "@fontsource/caveat/latin-700.css";
import "@fontsource/caveat/cyrillic-400.css";
import "@fontsource/caveat/cyrillic-700.css";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PageState } from "@/components/PageState";
import { PhoneBar } from "@/components/PhoneBar";
import { IntroOverlay } from "@/components/intro/IntroOverlay";
import { applyPageState } from "@/lib/boot";
import { apiTry, getMe } from "@/lib/server-api";
import type { Profile } from "@/lib/types";
import "./tokens.css";
import "./globals.css";
import "./pages.css";

export const metadata: Metadata = {
  title: { default: "ModernSI", template: "%s · ModernSI" },
  description: "ModernSI is the independent student network where micro-campus students pitch ideas, vote them up and turn them into real events.",
  icons: { icon: "/icon.svg" },
};

// Runs before paint, like the head script of the mock: applies a guest's saved theme, picks the motion mode (?still=1 and the system
// setting give the calm one) and flags a first visit in this session (or ?intro) for the intro. The theme and the motion mode come from
// applyPageState, which PageState runs again if a client render wipes them.
// There I also guard against a page that never hydrates: after 4 s it falls back to the calm state and drops the intro.
const bootScript = `(${applyPageState.toString()})();(function(){var d=document.documentElement;var q=new URLSearchParams(location.search);try{if(q.has("intro")||sessionStorage.getItem("msi_intro_seen")!=="1")d.dataset.intro="1"}catch(e){d.dataset.intro="1"}setTimeout(function(){if(window.msiStarted)return;d.dataset.motion="still";delete d.dataset.intro},4000)})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const profile = me ? await apiTry<Profile>("/api/profiles/me") : null;
  const theme = profile && profile.theme !== "system" ? profile.theme : undefined;
  return (
    <html lang="en" data-theme={theme} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <PageState />
        <IntroOverlay />
        <a className="skip-link" href="#main">Skip to content</a>
        <Header me={me} />
        <main id="main">{children}</main>
        <Footer signedIn={Boolean(me)} />
        <PhoneBar signedIn={Boolean(me)} />
      </body>
    </html>
  );
}
