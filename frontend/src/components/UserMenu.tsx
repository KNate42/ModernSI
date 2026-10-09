// Account menu in the header (a pill on the navy bar): profile, settings, review queue for Student Government, log out.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import type { Me } from "@/lib/types";
import { Icon } from "./Icon";

export function UserMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const reviewer = me.role === "student_gov" || me.role === "admin";
  return (
    <div className="user-menu" ref={box}>
      <button className="user-button" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="avatar" aria-hidden="true">{me.display_name.slice(0, 1).toUpperCase()}</span>
        <span className="user-name">{me.display_name}</span>
        <Icon name="caret" className="user-caret" />
      </button>
      {open && (
        <div className="menu" role="menu">
          {me.status === "pending" && <Link role="menuitem" href="/verify" onClick={() => setOpen(false)}>Confirm your e-mail</Link>}
          <Link role="menuitem" href={`/profile/${me.id}`} onClick={() => setOpen(false)}>My profile</Link>
          <Link role="menuitem" href="/personal" onClick={() => setOpen(false)}>Personal</Link>
          {reviewer && <Link role="menuitem" href="/review" onClick={() => setOpen(false)}>Review queue</Link>}
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)}>Settings</Link>
          <button role="menuitem" type="button" onClick={logout}>Log out</button>
        </div>
      )}
    </div>
  );
}
