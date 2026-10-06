// Intro overlay. The head script decides whether this visit gets the intro; here I only play it.
// The engine is the approved mock's intro.js, shared byte-for-byte.
// This work made by Anfinogentov Nikita
"use client";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { playIntro } from "./engine.js";

export function IntroOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // React may run this effect twice in development; the intro must start only once
    if (started.current) return;
    started.current = true;
    const root = document.documentElement;
    const overlay = overlayRef.current;
    if (!overlay || root.dataset.intro !== "1") {
      setDone(true);
      return;
    }
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
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
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
        setDone(true);
        previousFocus?.focus?.();
      },
    });
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", onClick);
  }, []);

  if (done) return null;
  return (
    <div className="intro" ref={overlayRef} role="dialog" aria-label="ModernSI intro">
      <canvas aria-hidden="true" />
      <div className="intro-word" data-intro-word>ModernSI</div>
      <div className="intro-dot" data-intro-dot aria-hidden="true" />
      <div className="intro-welcome" data-intro-welcome>Welcome!</div>
      <button className="intro-skip" type="button" data-intro-skip>Skip intro</button>
    </div>
  );
}
