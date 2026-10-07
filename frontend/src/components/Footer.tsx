// Site footer: link columns, the theme switch and the independence statement required by the brand ban.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function Footer({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="site-footer on-night">
      <div className="wrap footer-grid">
        <div className="footer-about">
          <Logo />
          <p>The student network for micro-campuses. Made by students, mostly between classes.</p>
          <ThemeToggle signedIn={signedIn} />
        </div>
        <nav className="footer-column" aria-label="Do stuff">
          <h2>Do stuff</h2>
          <ul>
            <li><Link href="/ideas">Browse ideas</Link></li>
            <li><Link href="/ideas/new">Pitch an idea</Link></li>
            <li><Link href="/events">Events</Link></li>
            {!signedIn && <li><Link href="/join">Join</Link></li>}
          </ul>
        </nav>
        <nav className="footer-column" aria-label="Find stuff">
          <h2>Find stuff</h2>
          <ul>
            <li><Link href="/academic">Academic</Link></li>
            <li><Link href="/international">International</Link></li>
            <li><Link href="/community">Community</Link></li>
            <li><Link href="/personal">Personal</Link></li>
          </ul>
        </nav>
        <nav className="footer-column footer-column-wide" aria-label="The network">
          <h2>The network</h2>
          <ul>
            <li><Link href="/#campuses">Campuses</Link></li>
            <li><Link href="/#how">How it works</Link></li>
            <li><Link href="/request-campus">Add your campus</Link></li>
            <li><Link href="/forum">Forum</Link></li>
            <li><Link href="/about">About</Link></li>
            {!signedIn && <li><Link href="/login">Log in</Link></li>}
          </ul>
        </nav>
        <p className="legal">ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.</p>
      </div>
    </footer>
  );
}
