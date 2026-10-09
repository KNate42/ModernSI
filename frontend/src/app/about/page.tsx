// About ModernSI, with the independence statement.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = { title: "About" };

const steps = [
  ["Join", "Sign up with your university e-mail. The domain tells us which campus you belong to. Anyone can read."],
  ["Pitch", "Say what should happen in a sentence or two."],
  ["Get votes", "Other students back the idea. With enough votes it goes to Student Government."],
  ["Find your crew", "Approved ideas gather a team of volunteers."],
  ["Show up", "The team puts the idea on the calendar as an event, and people say they are in."],
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        tone="sky" icon="about" eyebrow="About" note="by students, for students"
        title={<>Made by students, <span className="marker">between classes</span></>}
        lead="ModernSI is an independent network where students from different campuses share what they know and turn their ideas into real activities."
      >
        <Link className="btn btn-primary btn-large" href="/join">Join with your uni e-mail<Icon name="arrow" /></Link>
      </PageHero>
      <div className="wrap page-body about">
        <section>
          <div className="section-head"><div><p className="eyebrow">From a thought to a night out</p><h2>How it works</h2></div></div>
          <ol className="about-steps">
            {steps.map(([title, text]) => <li key={title}><b>{title}</b><span>{text}</span></li>)}
          </ol>
        </section>
        <section className="about-grid">
          <div className="paper">
            <h2>Who can join</h2>
            <p>Students of universities whose e-mail domains are on the network. If yours is not, <Link href="/request-campus">ask us to add it</Link>.</p>
          </div>
          <div className="paper">
            <h2>Independence</h2>
            <p className="independence">ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.</p>
          </div>
        </section>
      </div>
    </>
  );
}
