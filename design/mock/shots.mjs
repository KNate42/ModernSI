/*
 * Mock checks: intro timing and skip behaviour, review-focus edge cases, screenshots of both themes.
 * Needs the mock served on :4310 (`python3 -m http.server 4310` from design/mock) and internet access
 * (gsap comes from cdnjs, Manrope from Google Fonts). The intro is measured on its own timeline, not from page load.
 * Offline helpers: CHROMIUM_PATH points at a ready browser, GSAP_FILE serves a local gsap.min.js instead of cdnjs.
 * This work made by Anfinogentov Nikita
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:4310/";
const SHOTS = fileURLToPath(new URL("shots/", import.meta.url));
const failures = [];
const contexts = [];
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures.push(label);
};

mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

// Runs in the page before any page script: records when the intro scroll lock is set and released, when #intro
// leaves the DOM, and whether the overlay was really on screen. With autoSkip it also clicks Skip twice, at once.
function instrumentIntro({ autoSkip }) {
  const state = {
    lockAt: null, visibleAtLock: null, skipDelayMs: null,
    lockRemoved: 0, lockRemovedAt: null, introRemoved: 0, introRemovedAt: null,
  };
  window.__intro = state;
  window.__introTimeline = () => window.gsap
    ? window.gsap.globalTimeline.getChildren(false, false, true).find((t) => Math.abs(t.duration() - 6) < 0.25)
    : undefined;
  let locked = false;
  let present = false;
  const scan = () => {
    const now = performance.now();
    const overlay = document.getElementById("intro");
    const lockedNow = !!document.body && document.body.classList.contains("intro-lock");
    if (lockedNow && !locked) {
      state.lockAt = now;
      const box = overlay ? overlay.getBoundingClientRect() : null;
      const style = overlay ? getComputedStyle(overlay) : null;
      state.visibleAtLock = !!box && box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      if (autoSkip) {
        const button = document.querySelector("[data-intro-skip]");
        state.skipDelayMs = performance.now() - state.lockAt;
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    }
    if (!lockedNow && locked) {
      state.lockRemoved++;
      state.lockRemovedAt = now;
    }
    if (!overlay && present) {
      state.introRemoved++;
      state.introRemovedAt = now;
    }
    locked = lockedNow;
    present = !!overlay;
  };
  new MutationObserver(scan).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
}

async function fresh(options = {}, { autoSkip = false } = {}) {
  const context = await browser.newContext(options);
  contexts.push(context);
  if (process.env.GSAP_FILE) {
    // There I answer the cdnjs request from disk when the real CDN is not reachable
    await context.route("https://cdnjs.cloudflare.com/ajax/libs/gsap/**", (route) => route.fulfill({ path: process.env.GSAP_FILE, contentType: "application/javascript" }));
  }
  await context.addInitScript(instrumentIntro, { autoSkip });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { context, page, errors };
}

// one failed or timed-out block records a FAIL and the run goes on; its contexts are always closed
async function block(name, run) {
  const opened = contexts.length;
  try {
    await run();
  } catch (error) {
    check(false, `${name}: ${String(error.message).split("\n")[0]}`);
  } finally {
    await Promise.all(contexts.splice(opened).map((context) => context.close().catch(() => {})));
  }
}

const shot = (page, name, options = {}) => page.screenshot({ path: SHOTS + name, ...options });
const introState = (page) => page.evaluate(() => ({ ...window.__intro }));
const introStarted = (page) => page.waitForFunction(() => window.__intro && window.__intro.lockAt !== null, null, { timeout: 5000 });
const gone = (page, selector, timeout) => page.waitForSelector(selector, { state: "detached", timeout }).then(() => true, () => false);

// Plays the intro live until its own timeline reaches `seconds`, then pauses everything and seeks to that exact time
// (seek without suppressing events, so the canvas threads are redrawn). Playing up to the frame instead of seeking
// all the way matters: the letter-collapse tweens are started by a callback at 1.3 s and a long seek would skip them.
async function freezeAt(page, seconds) {
  await page.evaluate(() => {
    window.gsap.globalTimeline.resume();
    window.__introTimeline()?.resume();
  });
  await page.waitForFunction((t) => {
    const timeline = window.__introTimeline();
    return !!timeline && timeline.time() >= t;
  }, seconds, { polling: "raf", timeout: 9000 });
  await page.evaluate((t) => {
    const timeline = window.__introTimeline();
    window.gsap.globalTimeline.pause();
    timeline.pause();
    timeline.seek(t, false);
  }, seconds);
  await page.waitForTimeout(100);
}

// number of pixels the intro canvas has actually drawn on (threads), read back from its backing store
const litPixels = (page) => page.evaluate(() => {
  const canvas = document.querySelector("#intro canvas");
  const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  let lit = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 16) lit++;
  return lit;
});

try {
  // 1a. intro frames, taken on the intro's own timeline
  await block("intro frames", async () => {
    const { page } = await fresh({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE, { waitUntil: "commit" });
    await page.waitForFunction(() => !!window.__introTimeline?.(), null, { polling: "raf", timeout: 9000 });
    for (const t of [400, 2000, 3000, 3700, 4600]) {
      await freezeAt(page, t / 1000);
      await shot(page, `intro-${t}ms.png`);
      if (t === 3700) {
        const lit = await litPixels(page);
        check(lit > 500, `burst frame at 3.7 s has threads on the canvas (${lit} lit px)`);
      }
    }
  });

  // 1b. the whole intro, never touched: ~6.0 s from overlay shown to overlay removed, then never again in the session
  await block("intro duration", async () => {
    const { page, errors } = await fresh({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE, { waitUntil: "commit" });
    await introStarted(page);
    await page.waitForSelector("#intro", { state: "detached", timeout: 9000 });
    const state = await introState(page);
    // measured from the moment the scroll lock is set (overlay shown, timeline created) to overlay removal,
    // so slow font/CDN loading before the intro starts does not skew it
    const seconds = (state.introRemovedAt - state.lockAt) / 1000;
    check(state.visibleAtLock === true, "overlay is on screen when the intro starts");
    check(seconds > 5.7 && seconds < 6.3, `intro lasts 6.0 s from overlay shown to overlay removed (${seconds.toFixed(2)} s)`);
    check(state.lockRemoved === 1 && !(await page.evaluate(() => document.body.classList.contains("intro-lock"))), `scroll unlocked after intro (lock released ${state.lockRemoved}x)`);
    await page.reload();
    check((await page.locator("#intro").count()) === 0, "no intro on reload in same session");
    check((await introState(page)).lockAt === null, "scroll lock never set on reload");
    check(errors.length === 0, `no console errors (${errors.join("; ")})`);
  });

  // 2. skip twice, within 100 ms of the overlay appearing: reveals exactly once, no errors
  await block("double skip", async () => {
    const { page, errors } = await fresh({}, { autoSkip: true });
    await page.goto(BASE, { waitUntil: "commit" });
    await introStarted(page); // the overlay is only in the DOM for ~0.4 s here, so wait on the recorded state, not on the node
    check(await gone(page, "#intro", 3000), "double skip at start: overlay removed");
    await page.waitForTimeout(1000); // a second reveal, if there were one, would show up in this window
    const state = await introState(page);
    check(state.visibleAtLock === true, "double skip at start: overlay was on screen");
    check(state.skipDelayMs !== null && state.skipDelayMs < 100, `double skip at start: first skip ${state.skipDelayMs === null ? "never happened" : state.skipDelayMs.toFixed(1) + " ms"} after the overlay appeared`);
    check(state.introRemoved === 1, `double skip at start: overlay removed exactly once (${state.introRemoved})`);
    check(state.lockRemoved === 1, `double skip at start: scroll lock released exactly once (${state.lockRemoved})`);
    check(errors.length === 0, `double skip at start: no errors (${errors.join("; ")})`);
  });

  // 2b. real mouse clicks: anywhere on the overlay, and on the Skip button
  await block("real clicks", async () => {
    for (const [label, click] of [
      ["click anywhere skips", (page) => page.mouse.click(300, 250)],
      ["Skip button click skips", (page) => page.click("[data-intro-skip]", { timeout: 2000 })],
    ]) {
      const { page, errors } = await fresh({ viewport: { width: 1440, height: 900 } });
      await page.goto(BASE, { waitUntil: "commit" });
      await introStarted(page);
      await page.waitForTimeout(300);
      await click(page);
      check(await gone(page, "#intro", 2000), `${label}: overlay removed within 2 s`);
      await page.waitForTimeout(700);
      const state = await introState(page);
      check(state.introRemoved === 1 && state.lockRemoved === 1, `${label}: revealed once (overlay ${state.introRemoved}x, lock ${state.lockRemoved}x)`);
      check(errors.length === 0, `${label}: no errors (${errors.join("; ")})`);
    }
  });

  // 3. Esc skips
  await block("Esc", async () => {
    const { page, errors } = await fresh();
    await page.goto(BASE, { waitUntil: "commit" });
    await introStarted(page);
    await page.waitForTimeout(300);
    check(await page.locator("#intro").isVisible(), "Esc: overlay visible before the key press");
    await page.keyboard.press("Escape");
    check(await gone(page, "#intro", 1000), "Esc skips: overlay removed within 1 s");
    await page.waitForTimeout(700);
    const state = await introState(page);
    check(state.introRemoved === 1 && state.lockRemoved === 1, `Esc: revealed once (overlay ${state.introRemoved}x, lock ${state.lockRemoved}x)`);
    check(errors.length === 0, `Esc: no errors (${errors.join("; ")})`);
  });

  // 4. reduced motion: the overlay is really shown, then gone in about 0.6 s
  await block("reduced motion", async () => {
    const { page } = await fresh({ reducedMotion: "reduce" });
    await page.goto(BASE, { waitUntil: "commit" });
    await introStarted(page);
    check(await gone(page, "#intro", 3000), "reduced motion: overlay removed");
    const state = await introState(page);
    const seconds = (state.introRemovedAt - state.lockAt) / 1000;
    check(state.visibleAtLock === true, "reduced motion: overlay was on screen");
    check(seconds > 0 && seconds <= 1.0, `reduced motion intro is short (${seconds.toFixed(2)} s from overlay shown to removed)`);
  });

  // 5. sessionStorage throws: intro still plays and finishes
  await block("blocked storage", async () => {
    const { page, errors } = await fresh();
    await page.addInitScript(() => {
      Object.defineProperty(window, "sessionStorage", { get() { throw new Error("blocked"); } });
    });
    await page.goto(BASE, { waitUntil: "commit" });
    await introStarted(page);
    check(await page.locator("#intro").isVisible(), "intro visible with blocked storage");
    await page.keyboard.press("Escape");
    check(await gone(page, "#intro", 2000), "blocked storage: Esc removes the overlay");
    await page.waitForTimeout(500);
    check(errors.length === 0, `blocked storage: no errors (${errors.join("; ")})`);
  });

  // 6. resize mid-burst at DPR 3: canvas backing store matches the viewport and still shows the threads
  await block("resize at DPR 3", async () => {
    const { page } = await fresh({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 3 });
    await page.goto(BASE, { waitUntil: "commit" });
    await page.waitForFunction(() => !!window.__introTimeline?.(), null, { polling: "raf", timeout: 9000 });
    await freezeAt(page, 3.5);
    await page.setViewportSize({ width: 700, height: 900 });
    await page.waitForTimeout(150);
    // seek again so the threads are redrawn through the normal update path at the new size
    await page.evaluate(() => { window.__introTimeline().seek(3.55, false); });
    await page.waitForTimeout(100);
    const size = await page.evaluate(() => {
      const c = document.querySelector("#intro canvas");
      return c ? [c.width, c.height] : null;
    });
    check(size && size[0] === 2100 && size[1] === 2700, `canvas refits after resize at DPR 3 (${size})`);
    const lit = await litPixels(page);
    check(lit > 500, `canvas is not empty after the resize (${lit} lit px)`);
    await shot(page, "intro-resized-dpr3.png");
  });

  // 7. screenshots of both themes, no horizontal scroll at 360 and 1440
  for (const scheme of ["dark", "light"]) {
    for (const width of [1440, 360]) {
      await block(`${scheme} ${width}px`, async () => {
        const { page } = await fresh({ viewport: { width, height: 900 }, colorScheme: scheme });
        await page.addInitScript(() => sessionStorage.setItem("msi_intro_seen", "1"));
        await page.goto(BASE);
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(overflow <= 0, `${scheme} ${width}px: no horizontal scroll (${overflow})`);
        await shot(page, `home-${scheme}-${width}.png`, { fullPage: true });
        if (width === 360) {
          await page.click("#menu-btn");
          await shot(page, `menu-${scheme}-360.png`);
        }
      });
    }
  }

  // 8. intro word fits at 360, checked while it is still at full size (1.0 s on the timeline, before the collapse)
  await block("intro word at 360", async () => {
    const { page } = await fresh({ viewport: { width: 360, height: 740 } });
    await page.goto(BASE, { waitUntil: "commit" });
    await page.waitForFunction(() => !!window.__introTimeline?.(), null, { polling: "raf", timeout: 9000 });
    await freezeAt(page, 1.0);
    const fits = await page.evaluate(() => {
      const r = document.querySelector("[data-intro-word]").getBoundingClientRect();
      return r.left >= 0 && r.right <= window.innerWidth;
    });
    check(fits, "intro word fits at 360px");
  });
} finally {
  await browser.close();
}

if (failures.length) {
  console.log(`\nOoops.. ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nall mock checks pass");
