/*
 * Mock page wiring: the intro once per session, theme switch, mobile menu, sample countdown, idea ticker and scroll reveal.
 * This work made by Anfinogentov Nikita
 */
import { playIntro } from "./intro.js";

// The head script waits for this flag: if the module never gets here, it puts the page into the calm, fully visible state
window.msiStarted = true;

const SEEN_KEY = "msi_intro_seen";
const THEME_KEY = "msi_theme";
// There I fake the clock: the sample event "starts" 2 h 14 min after the page loads. The live site reads the real start time.
const SAMPLE_START_AFTER_MS = (2 * 60 + 14) * 60 * 1000;
const TICKER_SPEED_PX_PER_SECOND = 55;
// the burger shows up at the same width as in the stylesheet (73.75em = 1180px)
const COMPACT_HEADER = "(max-width: 73.75em)";
const MENU_BACKGROUND = "main, footer, .phone-bar, .preview-strip";

const stillMode = document.documentElement.dataset.motion === "still";

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

function setInert(elements, on) {
  elements.forEach((element) => element.toggleAttribute("inert", on));
}

function startIntro() {
  const overlay = document.getElementById("intro");
  // The head script decided whether this visit gets the intro (first visit of the session, or ?intro); no flag or no gsap means no intro
  if (!overlay || !window.gsap || document.documentElement.dataset.intro !== "1") {
    overlay?.remove();
    delete document.documentElement.dataset.intro;
    return;
  }
  overlay.hidden = false;
  document.body.classList.add("intro-lock");
  // the page behind the overlay must not be reachable by Tab or by a screen reader while it plays
  const behind = [...document.body.children].filter((element) => element !== overlay);
  setInert(behind, true);
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
    setInert(behind, false);
    overlay.remove();
    delete document.documentElement.dataset.intro;
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }

  try {
    intro = playIntro({
      overlay,
      gsap: window.gsap,
      // ?still=1 is the same promise as the system setting: no long show
      reducedMotion: stillMode || matchMedia("(prefers-reduced-motion: reduce)").matches,
      onDone: cleanup,
    });
    overlay.addEventListener("click", () => intro.skip());
  } catch (error) {
    console.error("Intro playback failed:", error);
    cleanup();
  }
}

function currentTheme() {
  return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

// The saved theme is applied by the inline script in the head, so here I only wire the switch in the footer
function setupTheme() {
  const button = document.querySelector("[data-theme-toggle]");
  if (!button) return;
  const sync = () => button.setAttribute("aria-checked", String(currentTheme() === "dark"));
  sync();
  button.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // the choice just will not survive a reload
    }
    sync();
  });
}

// The open menu is a full-screen sheet: focus moves into it, the page behind is inert, Tab stays in the header, Esc and a wide screen close it
function setupMenu() {
  const button = document.querySelector("[data-menu-button]");
  const nav = document.querySelector("[data-site-nav]");
  const header = document.querySelector(".site-header");
  if (!button || !nav || !header) return;
  const isOpen = () => nav.classList.contains("open");
  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    setInert(document.querySelectorAll(MENU_BACKGROUND), open);
    if (open) nav.querySelector("a")?.focus();
  };
  button.addEventListener("click", () => setOpen(!isOpen()));
  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (!isOpen()) return;
    if (event.key === "Escape") {
      setOpen(false);
      button.focus();
    }
    if (event.key === "Tab") {
      const stops = [...header.querySelectorAll("a[href], button")].filter((element) => element.offsetParent !== null);
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
  });
  matchMedia(COMPACT_HEADER).addEventListener("change", (event) => {
    if (!event.matches && isOpen()) setOpen(false);
  });
}

// "h" and "min" carry their own spaces, so a screen reader hears "2 h 14 min" and not "2h14min"
function makeUnit(text) {
  const unit = document.createElement("span");
  unit.className = "countdown-unit";
  unit.textContent = text;
  return unit;
}

// "2 h 14 min", rounded up to the minute so the first second does not already show 13 min.
// The text changes only when the minute does, so a selection inside it is not wiped every second.
function renderCountdown(element, msLeft) {
  if (msLeft <= 0) {
    if (element.dataset.shown === "now") return;
    element.dataset.shown = "now";
    const now = document.createElement("span");
    now.className = "countdown-now";
    now.textContent = "Happening now";
    element.replaceChildren(now);
    return;
  }
  const totalMinutes = Math.ceil(msLeft / 60000);
  if (element.dataset.shown === String(totalMinutes)) return;
  element.dataset.shown = String(totalMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours > 0) parts.push(String(hours), makeUnit(" h "));
  parts.push(String(minutes), makeUnit(" min"));
  element.replaceChildren(...parts);
}

function setupCountdown() {
  const counters = document.querySelectorAll("[data-countdown]");
  const labels = document.querySelectorAll("[data-countdown-label]");
  const startsAt = Date.now() + SAMPLE_START_AFTER_MS;
  const tick = () => {
    const msLeft = startsAt - Date.now();
    counters.forEach((element) => renderCountdown(element, msLeft));
    labels.forEach((label) => { label.hidden = msLeft <= 0; });
  };
  tick();
  setInterval(tick, 1000);
}

// Signature animation 2: the idea ticker. I repeat the list until it is wider than the screen, then double it so the loop has no seam.
function setupTickers() {
  if (stillMode) return;
  const build = () => {
    document.querySelectorAll("[data-marquee]").forEach((track) => {
      const list = track.firstElementChild;
      if (!list || !list.offsetWidth) return;
      const copies = Math.max(1, Math.ceil((Math.max(window.innerWidth, screen.width) * 1.2) / list.offsetWidth));
      for (let index = 1; index < copies * 2; index++) {
        const clone = list.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      }
      track.style.setProperty("--ribbon-duration", `${Math.round((list.offsetWidth * copies) / TICKER_SPEED_PX_PER_SECOND)}s`);
    });
  };
  // the widths depend on the web fonts, so I wait for them
  document.fonts.ready.then(build);
}

// A moving ticker needs a way to stop it for good, for keyboard and touch users too (hover only helps a mouse)
function setupTickerPause() {
  const button = document.querySelector("[data-ticker-pause]");
  const ribbons = document.querySelector(".ribbons");
  if (!button || !ribbons) return;
  button.addEventListener("click", () => {
    const paused = ribbons.toggleAttribute("data-paused");
    button.setAttribute("aria-pressed", String(paused));
  });
}

// Signature animations 1 and 3: stickers slap in and the route draws itself when they scroll into view.
// The state lives in data-state, so a framework that rewrites className cannot hide a revealed sticker again.
function setupReveal() {
  const targets = document.querySelectorAll("[data-reveal], [data-route]");
  if (stillMode || !("IntersectionObserver" in window)) {
    targets.forEach((element) => { element.dataset.state = "in"; });
    return;
  }
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.dataset.state = "in";
      seen.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  targets.forEach((element) => seen.observe(element));
}

setupTheme();
setupMenu();
setupCountdown();
setupTickers();
setupTickerPause();
setupReveal();
startIntro();
