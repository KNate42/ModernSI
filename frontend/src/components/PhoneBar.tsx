// Bottom bar for phones (CSS shows it up to 700 px): Events, Ideas, Pitch, and Me or Join. The current page gets aria-current.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

export function PhoneBar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const inside = (href: string) => pathname === href || pathname.startsWith(href + "/");
  // /ideas/new is the Pitch button, so it must not light up Ideas as well
  const pitching = pathname === "/ideas/new";
  const current = (on: boolean) => (on ? "page" : undefined);

  return (
    <nav className="phone-bar" aria-label="Quick actions">
      <Link href="/events" aria-current={current(inside("/events"))}><Icon name="events" /><span>Events</span></Link>
      <Link href="/ideas" aria-current={current(inside("/ideas") && !pitching)}><Icon name="ideas" /><span>Ideas</span></Link>
      <Link className="phone-bar-pitch" href="/ideas/new" aria-current={current(pitching)}><Icon name="plus" /><span>Pitch</span></Link>
      {signedIn ? (
        <Link href="/personal" aria-current={current(inside("/personal") || inside("/profile") || inside("/settings"))}><Icon name="personal" /><span>Me</span></Link>
      ) : (
        <Link href="/join" aria-current={current(inside("/join"))}><Icon name="personal" /><span>Join</span></Link>
      )}
    </nav>
  );
}
