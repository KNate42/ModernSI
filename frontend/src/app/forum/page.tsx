// Forum: what it is for, the community rules, and where discussions happen today.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = { title: "Forum" };

const rules = [
  "Be kind and assume good intent. People write from many countries and in their second or third language.",
  "Use English in shared spaces, so every campus can follow.",
  "Share your own words, photos and work. Do not post course materials, paid content or anything you do not have the rights to. Link to the source instead.",
  "Do not publish other people's personal data: contacts, documents, grades.",
  "No advertising, spam or fundraising for third parties.",
  "Report what breaks these rules with the report link on the idea page. The admins review every report.",
];

export default function ForumPage() {
  return (
    <>
      <PageHero
        tone="steel" icon="forum" eyebrow="Forum" note="start with an idea"
        title={<>Talk it <span className="marker">out</span></>}
        lead="Students from every campus, one conversation about studying, life abroad and what to build next. Today it happens around ideas: each one collects votes, an answer from Student Government and a crew."
      >
        <Link className="btn btn-primary btn-large" href="/ideas">Discuss an idea<Icon name="arrow" /></Link>
      </PageHero>
      <div className="wrap page-body">
        <section>
          <div className="section-head"><div><p className="eyebrow">House rules</p><h2>Community rules</h2></div></div>
          <ol className="rules">
            {rules.map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
        </section>
      </div>
    </>
  );
}
