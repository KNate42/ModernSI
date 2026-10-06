// Site footer with the independence statement required by the brand ban.
// This work made by Anfinogentov Nikita
import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <nav aria-label="Footer">
          <Link href="/about">About</Link>
          <Link href="/academic">Academic</Link>
          <Link href="/international">International</Link>
          <Link href="/community">Community</Link>
          <Link href="/personal">Personal</Link>
          <Link href="/forum">Forum</Link>
          <Link href="/ideas">Ideas</Link>
          <Link href="/events">Events</Link>
          <Link href="/request-campus">Add your university</Link>
        </nav>
        <p>ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.</p>
      </div>
    </footer>
  );
}
