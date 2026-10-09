// Site header: logo, Events and Ideas, the four directions, Forum, then Log in and Join or the user menu; a full-screen menu on small screens.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Me } from "@/lib/types";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

const groups = [
  [{ href: "/events", label: "Events" }, { href: "/ideas", label: "Ideas" }],
  [{ href: "/academic", label: "Academic" }, { href: "/international", label: "International" }, { href: "/community", label: "Community" }, { href: "/personal", label: "Personal" }],
  [{ href: "/forum", label: "Forum" }],
];

// the burger shows at the same width as in the stylesheet (73.75em = 1180px)
const compactHeader = "(max-width: 73.75em)";
// the open menu is a sheet over the page, so everything behind it is inert
const menuBackground = "main, footer, .phone-bar";

export function Header({ me }: { me: Me | null }) {
  const pathname = usePathname();
  // the menu is "open" only for the page it was opened on, so following a link closes it without an effect
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const header = useRef<HTMLElement>(null);
  const nav = useRef<HTMLElement>(null);
  const burger = useRef<HTMLButtonElement>(null);

  // Open menu: focus moves into it, the page behind is inert, Tab stays in the header, Esc and a wide screen close it
  useEffect(() => {
    if (!open) return;
    const background = document.querySelectorAll(menuBackground);
    background.forEach((element) => element.setAttribute("inert", ""));
    nav.current?.querySelector("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenOn(null);
        burger.current?.focus();
      }
      if (event.key === "Tab" && header.current) {
        const stops = [...header.current.querySelectorAll<HTMLElement>("a[href], button")].filter((element) => element.offsetParent !== null);
        const first = stops[0];
        const last = stops[stops.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const compact = matchMedia(compactHeader);
    const onWide = (event: MediaQueryListEvent) => {
      if (!event.matches) setOpenOn(null);
    };
    document.addEventListener("keydown", onKey);
    compact.addEventListener("change", onWide);
    return () => {
      background.forEach((element) => element.removeAttribute("inert"));
      document.removeEventListener("keydown", onKey);
      compact.removeEventListener("change", onWide);
    };
  }, [open]);

  // a click on a link of the open menu closes it even when the link leads to the page we are already on
  const close = () => setOpenOn(null);
  const current = (href: string) => (pathname === href || pathname.startsWith(href + "/") ? "page" : undefined);

  return (
    <header className="site-header" ref={header}>
      <div className="wrap header-bar">
        <Logo />
        <nav id="main-nav" ref={nav} className={open ? "site-nav open" : "site-nav"} aria-label="Main">
          {groups.map((group) => (
            <ul key={group[0].href} className="nav-group">
              {group.map((item) => (
                <li key={item.href}><Link href={item.href} aria-current={current(item.href)} onClick={close}>{item.label}</Link></li>
              ))}
            </ul>
          ))}
          {!me && (
            <ul className="nav-group nav-account">
              <li><Link href="/login" onClick={close}>Log in</Link></li>
              <li><Link className="btn btn-butter" href="/join" onClick={close}>Join</Link></li>
            </ul>
          )}
        </nav>
        <div className="header-actions">
          {me ? (
            <UserMenu me={me} />
          ) : (
            <>
              <Link className="header-login" href="/login">Log in</Link>
              <Link className="btn btn-butter btn-small header-join" href="/join">Join</Link>
            </>
          )}
          <button ref={burger} className="menu-button" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="main-nav" onClick={() => setOpenOn(open ? null : pathname)}>
            <span className="menu-open"><Icon name="menu" /></span>
            <span className="menu-close"><Icon name="close" /></span>
          </button>
        </div>
      </div>
    </header>
  );
}
