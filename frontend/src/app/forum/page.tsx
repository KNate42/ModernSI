// Forum: what it is for, the community rules, and where discussions happen today.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Forum" };

export default function ForumPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">Forum</p>
        <h1>An international student forum</h1>
        <p>
          A place where students from every campus talk about studying, life abroad and what to build next. Today the
          conversation happens around ideas: each idea collects support, feedback from Student Government and a team.
        </p>
        <p><Link className="btn btn-primary" href="/ideas">Discuss an idea</Link></p>
      </div>
      <section>
        <h2>Community rules</h2>
        <ol className="rules">
          <li>Be kind and assume good intent. People write from many countries and in their second or third language.</li>
          <li>Use English in shared spaces so every campus can follow.</li>
          <li>Share your own words, photos and work. Do not post course materials, paid content or anything you do not have the rights to; link to the source instead.</li>
          <li>Do not publish other people&apos;s personal data: contacts, documents, grades.</li>
          <li>No advertising, spam or fundraising for third parties.</li>
          <li>Report what breaks these rules with the report link on the idea page; the admins review every report.</li>
        </ol>
      </section>
    </div>
  );
}
