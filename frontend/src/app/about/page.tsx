// About ModernSI, with the independence statement.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">About</p>
        <h1>What ModernSI is</h1>
        <p>An independent network where students from different campuses share experience and knowledge, and turn their ideas into real activities.</p>
      </div>
      <section className="prose" style={{ maxWidth: "70ch" }}>
        <h2>How it works</h2>
        <p>
          Students join with their university e-mail; the e-mail domain shows which campus they belong to. Anyone can read
          ideas and events. Members propose ideas and support each other&apos;s. When an idea gathers enough support,
          Student Government reviews it. Approved ideas gather a team, and the team puts the idea on the Hub as an event.
        </p>
        <h2>Who can join</h2>
        <p>
          Students of universities whose e-mail domains are on the network. If yours is not, <Link href="/request-campus">ask us to add it</Link>.
        </p>
        <h2>Independence</h2>
        <p>ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.</p>
      </section>
    </div>
  );
}
