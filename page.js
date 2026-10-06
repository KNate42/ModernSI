/*
 * Mock page wiring: plays the intro once per session, theme toggle, mobile menu.
 * This work made by Anfinogentov Nikita
 */
import { playIntro } from "./intro.js";

const SEEN_KEY = "mh_intro_seen";

function introSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // storage blocked: the intro will simply play again next time
  }
}

function startIntro() {
  const overlay = document.getElementById("intro");
  const forced = new URLSearchParams(location.search).has("intro");
  if (!overlay || !window.gsap || (introSeen() && !forced)) {
    overlay?.remove();
    delete document.documentElement.dataset.intro;
    return;
  }
  overlay.hidden = false;
  document.body.classList.add("intro-lock");
  const skipButton = overlay.querySelector("[data-intro-skip]");
  const previousFocus = document.activeElement;
  skipButton.focus();

  let intro;
  const trapFocus = (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      skipButton.focus();
    }
    if (event.key === "Escape") intro?.skip();
  };
  document.addEventListener("keydown", trapFocus);

  function cleanup() {
    markIntroSeen();
    document.removeEventListener("keydown", trapFocus);
    document.body.classList.remove("intro-lock");
    overlay.remove();
    delete document.documentElement.dataset.intro;
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }

  try {
    intro = playIntro({
      overlay,
      gsap: window.gsap,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      onDone: cleanup,
    });
    overlay.addEventListener("click", () => intro.skip());
  } catch (error) {
    console.error("Intro playback failed:", error);
    cleanup();
  }
}

function setupTheme() {
  const button = document.getElementById("theme-toggle");
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem("mh_theme");
    if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  } catch {
    // no storage: follow the system theme
  }
  button.addEventListener("click", () => {
    const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next = current === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("mh_theme", next);
    } catch {
      // the choice just will not survive a reload
    }
  });
}

function setupMenu() {
  const button = document.getElementById("menu-btn");
  const nav = document.getElementById("nav");
  button.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      nav.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    }
  });
}

setupTheme();
setupMenu();
startIntro();
