// Site header: logo, the four directions plus Forum, theme switch, account or Join/Log in, mobile menu.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Me } from "@/lib/types";
import { LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

const sections = [
  { href: "/academic", label: "Academic" },
  { href: "/international", label: "International" },
  { href: "/community", label: "Community" },
  { href: "/personal", label: "Personal" },
];

export function Header({ me }: { me: Me | null }) {
  const pathname = usePathname();
  // the menu is "open" only for the page it was opened on, so following a link closes it without an effect
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  const current = (href: string) => (pathname === href || pathname.startsWith(href + "/") ? "page" : undefined);

  return (
    <header className="header">
      <div className="wrap">
        <Link className="logo" href="/" aria-label="ModernSI home">
          <LogoMark />
          ModernSI
        </Link>
        <nav id="main-nav" className={open ? "nav open" : "nav"} aria-label="Main">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} aria-current={current(section.href)}>{section.label}</Link>
          ))}
          <span className="divider" aria-hidden="true" />
          <Link href="/forum" aria-current={current("/forum")}>Forum</Link>
          {!me && (
            <div className="nav-auth">
              <Link className="btn" href="/login">Log in</Link>
              <Link className="btn btn-primary" href="/join">Join</Link>
            </div>
          )}
        </nav>
        <div className="header-actions">
          <ThemeToggle signedIn={Boolean(me)} />
          {me ? (
            <UserMenu me={me} />
          ) : (
            <>
              <Link className="btn btn-ghost hide-sm" href="/login">Log in</Link>
              <Link className="btn btn-primary hide-sm" href="/join">Join</Link>
            </>
          )}
          <button className="icon-btn menu-btn" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="main-nav" onClick={() => setOpenOn(open ? null : pathname)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M3 7h18M3 17h18" />}
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
