// Types for the framework-free intro engine copied from the mock.
// This work made by Anfinogentov Nikita
import type gsapType from "gsap";

export const INTRO_TIMING: Record<string, number>;
export function playIntro(options: {
  overlay: HTMLElement;
  gsap: typeof gsapType;
  reducedMotion?: boolean;
  onDone: () => void;
}): { skip(): void };
