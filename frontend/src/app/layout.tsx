// Root layout: font, theme (profile for users, localStorage for guests), intro flag, header and footer.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { IntroOverlay } from "@/components/intro/IntroOverlay";
import { apiTry, getMe } from "@/lib/server-api";
import type { Profile } from "@/lib/types";
import "./tokens.css";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ModernSI", template: "%s · ModernSI" },
  description: "An independent international student network where student ideas become campus events.",
  icons: { icon: "/icon.svg" },
};

// Runs before paint: applies a guest's saved theme and flags a first visit in this session for the intro.
const bootScript = `(function(){var d=document.documentElement;try{if(!d.dataset.theme){var t=localStorage.getItem("msi_theme");if(t==="light"||t==="dark")d.dataset.theme=t}}catch(e){}try{if(sessionStorage.getItem("msi_intro_seen")!=="1")d.dataset.intro="1"}catch(e){d.dataset.intro="1"}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const profile = me ? await apiTry<Profile>("/api/profiles/me") : null;
  const theme = profile && profile.theme !== "system" ? profile.theme : undefined;
  return (
    <html lang="en" className={manrope.variable} data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <IntroOverlay />
        <Header me={me} />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
