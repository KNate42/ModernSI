// 404 page.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { PageHero } from "@/components/PageHero";

export default function NotFound() {
  return (
    <>
      <PageHero
        tone="sky" icon="about" eyebrow="404" note="it was here a minute ago"
        title={<>Page <span className="marker">not found</span></>}
        lead="This link is old, or the page took the day off."
      >
        <Link className="btn btn-primary btn-large" href="/">Back to the homepage</Link>
      </PageHero>
      <div className="wrap page-body">
        <nav className="chips" aria-label="Places to try">
          <span className="chips-label" aria-hidden="true">Try</span>
          <Link className="chip" href="/ideas">Ideas</Link>
          <Link className="chip" href="/events">Events</Link>
          <Link className="chip" href="/forum">Forum</Link>
          <Link className="chip" href="/about">About</Link>
        </nav>
      </div>
    </>
  );
}
