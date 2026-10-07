// Scroll reveal: stickers get slapped on as they come into view and the route draws itself. Renders nothing; it only sets data-state.
// This work made by Anfinogentov Nikita
"use client";
import { useEffect } from "react";

export function Reveal() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(".home [data-reveal], .home [data-route]");
    // the calm mode (?still=1, reduced motion) and old browsers show everything at once
    if (document.documentElement.dataset.motion !== "full" || !("IntersectionObserver" in window)) {
      targets.forEach((element) => { element.dataset.state = "in"; });
      return;
    }
    // the state lives in data-state, so a rewritten className can never hide a revealed sticker again
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).dataset.state = "in";
        seen.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    targets.forEach((element) => seen.observe(element));
    return () => seen.disconnect();
  }, []);
  return null;
}
