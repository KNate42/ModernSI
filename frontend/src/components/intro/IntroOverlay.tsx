// Intro overlay. The head script decides whether this visit gets the intro; here I only play it.
// The engine is the approved mock's intro.js, shared byte-for-byte.
// This work made by Anfinogentov Nikita
"use client";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { playIntro } from "./engine.js";

declare global {
  interface Window {
    msiStarted?: boolean;
  }
}

export function IntroOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The head script waits for this flag: if the page never gets here it falls back to the calm, fully visible state
    window.msiStarted = true;
    // React may run this effect twice in development; the intro must start only once
    if (started.current) return;
    started.current = true;
    const root = document.documentElement;
    const overlay = overlayRef.current;
    if (!overlay || root.dataset.intro !== "1") {
      setDone(true);
      return;
    }
    // the page behind the overlay must not be reachable by Tab or by a screen reader while it plays
    const behind = [...document.body.children].filter((element) => element !== overlay && element.tagName !== "SCRIPT");
    behind.forEach((element) => element.setAttribute("inert", ""));
    const skipButton = overlay.querySelector<HTMLButtonElement>("[data-intro-skip]");
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.classList.add("intro-lock");
    skipButton?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        skipButton?.focus();
      }
      if (event.key === "Escape") intro.skip();
    };
    const onClick = () => intro.skip();

    const intro = playIntro({
      overlay,
      gsap,
      // ?still=1 is the same promise as the system setting: no long show
      reducedMotion: root.dataset.motion === "still" || matchMedia("(prefers-reduced-motion: reduce)").matches,
      onDone() {
        try {
          sessionStorage.setItem("msi_intro_seen", "1");
        } catch {
          // storage blocked: the intro plays again on the next visit
        }
        delete root.dataset.intro;
        document.body.classList.remove("intro-lock");
        document.removeEventListener("keydown", onKey);
        overlay.removeEventListener("click", onClick);
        behind.forEach((element) => element.removeAttribute("inert"));
        setDone(true);
        previousFocus?.focus?.();
      },
    });
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", onClick);
  }, []);

  if (done) return null;
  return (
    <div className="intro" ref={overlayRef} role="dialog" aria-modal="true" aria-label="ModernSI intro" hidden>
      <canvas aria-hidden="true" />
      <div className="intro-word" data-intro-word aria-hidden="true">ModernSI</div>
      <div className="intro-dot" data-intro-dot aria-hidden="true" />
      <div className="intro-welcome" data-intro-welcome>Welcome!</div>
      <button className="intro-skip" type="button" data-intro-skip>Skip intro</button>
    </div>
  );
}
