# ModernSI — Stage 1A: Homepage + Intro Mock — Implementation Plan

**Goal:** A static, self-contained mock of the ModernSI homepage with the ~6 s intro, in dark and light themes, for the user to approve before the real frontend is built.

**Architecture:** Plain HTML + CSS + one framework-free ES module (`intro.js`) that drives the intro with GSAP and a Canvas 2D thread renderer. Plan C copies `intro.js` into the Next.js app nearly verbatim, so it is written as production code, not throwaway. Mock content is hard-coded sample data.

**Tech Stack:** HTML5, CSS custom properties, GSAP 3.15 (cdnjs), Canvas 2D, Python 3 (contrast check), Playwright via `npx` (screenshots).

**Spec:** `docs/superpowers/specs/2026-10-05-stage1-foundation-home-design.md` (sections 6, 7, 8)

## Global Constraints

- No university names, crests, palettes or fonts. Forbidden colours (whole UofA range): Arizona Red `#AB0520`, Arizona Blue `#0C234B`, Midnight `#001C48`, Azurite `#1E5288`, Chili `#8B0015`, Bloom `#EF4056`, Sky `#81D3EB`, Oasis `#378DBD`, River `#007D84`, Leaf `#70B865`, Mesa `#A95C42`. No Proxima Nova, no Milo. No stock photos from the brief slides.
- Tokens, dark (default): `--bg #0B0B0D`, `--surface #16161A`, `--border #2A2A31`, `--fg #F4F2EE`, `--muted #A3A1AB`, `--accent #7C5CFF`, `--on-accent #0B0B0D`, `--accent-text #9B85FF`.
- Tokens, light: `--bg #F4F2EE`, `--surface #FFFFFF`, `--border #DAD7D0`, `--fg #0B0B0D`, `--muted #5E5C66`, `--accent #5B3DE6`, `--on-accent #FFFFFF`, `--accent-text #5B3DE6`.
- Every text/background pair ≥ 4.5:1.
- Font: Manrope 400–800.
- Intro ≈ 6.0 s, timeline per spec §7; once per browser session (`sessionStorage`, wrapped in try/catch); Skip button + click anywhere + Esc; `prefers-reduced-motion: reduce` → 0.6 s fade; no sound; intro overlay is always ink-black regardless of theme.
- Header items in order: Academic · International · Community · Personal | Forum (Forum after a thin divider).
- Footer line verbatim: "ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university."
- English UI. No `href="#"`, no "coming soon"/"TBD"/"lorem" — mock links point to in-page anchors that exist.
- JS/TS in standard camelCase style; file header comment with a one-line purpose and `This work made by Anfinogentov Nikita`.

## Review Focus

- Very narrow screens (360 px): header must collapse into a menu button; no horizontal scroll anywhere, including the intro word and the hero headline.
- Window resized mid-intro: canvas must re-fit (no stretched/blurred threads, threads still centred).
- `sessionStorage` throwing (private mode / blocked storage): intro must still play and the page must work.
- Skip pressed during the first 100 ms or pressed twice: page reveals exactly once, no console errors.
- High-DPI screens (devicePixelRatio 2–3): threads crisp, not blurry.

Each of these has an explicit check in Task A3.

---

## File Structure

```
design/mock/
  index.html      page markup (header, hero, pillars, ideas, events, feed, campuses, footer) + intro overlay markup
  styles.css      tokens (both themes), layout, components, intro overlay styles
  intro.js        framework-free intro engine: playIntro({ overlay, gsap, reducedMotion, onDone }) → { skip }
  page.js         wires intro (session flag, Skip, Esc, focus trap, body scroll lock), theme toggle, mobile menu
  contrast.py     asserts every token pair ≥ 4.5:1 and no forbidden colour appears in styles.css
  shots.mjs       Playwright script: screenshots of both themes at 1440 and 360, intro frames
```

---

### Task A1: Tokens, page skeleton and contrast check

**Files:**
- Create: `design/mock/contrast.py`
- Create: `design/mock/styles.css`
- Create: `design/mock/index.html`

**Interfaces:**
- Produces: CSS custom properties listed in Global Constraints, `data-theme="light|dark"` on `<html>` overrides the system theme. Plan C copies the `:root` blocks verbatim into `frontend/src/app/tokens.css`.

- [ ] **Step 1: Write the failing contrast check**

`design/mock/contrast.py`:

```python
"""
Checks that every text/background token pair of the mock reaches WCAG AA (4.5:1)
and that no forbidden university colour sneaks into the stylesheet.
This work made by Anfinogentov Nikita
"""
import re
import sys
from pathlib import Path

forbidden = ["AB0520", "0C234B", "001C48", "1E5288", "8B0015", "EF4056", "81D3EB", "378DBD", "007D84", "70B865", "A95C42"]

# fg token, bg token: every pair I actually put text on
pairs = [
    ("--fg", "--bg"), ("--fg", "--surface"),
    ("--muted", "--bg"), ("--muted", "--surface"),
    ("--accent-text", "--bg"), ("--accent-text", "--surface"),
    ("--on-accent", "--accent"),
]


def luminance(hex_colour):
    channels = [int(hex_colour[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    channels = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def ratio(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def read_block(css, selector):
    # There I take the first block that starts with the selector and pull out its tokens
    start = css.index(selector)
    body = css[css.index("{", start) + 1:css.index("}", start)]
    return dict(re.findall(r"(--[\w-]+):\s*#([0-9A-Fa-f]{6})", body))


def main():
    css = Path(__file__).with_name("styles.css").read_text()
    failures = []
    for colour in forbidden:
        if colour.lower() in css.lower():
            failures.append("forbidden colour #" + colour)
    themes = {"dark": read_block(css, ":root {"), "light": read_block(css, ':root[data-theme="light"]')}
    for name, tokens in themes.items():
        for fg, bg in pairs:
            value = ratio(tokens[fg], tokens[bg])
            line = f"{name:5} {fg:14} on {bg:10} {value:5.2f}"
            print(line)
            if value < 4.5:
                failures.append(line)
    if failures:
        print("Ooops.. contrast/brand check failed:")
        for item in failures:
            print("  " + item)
        sys.exit(1)
    print("all pairs pass")


main()
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python3 design/mock/contrast.py`
Expected: FAIL with `FileNotFoundError` for `styles.css`.

- [ ] **Step 3: Write `styles.css`**

`design/mock/styles.css`:

```css
/*
 * Mock styles: theme tokens, layout and the intro overlay.
 * This work made by Anfinogentov Nikita
 */

:root {
  --bg: #0B0B0D;
  --surface: #16161A;
  --border: #2A2A31;
  --fg: #F4F2EE;
  --muted: #A3A1AB;
  --accent: #7C5CFF;
  --on-accent: #0B0B0D;
  --accent-text: #9B85FF;
  --ink: #0B0B0D;
  --radius: 14px;
  --gutter: clamp(16px, 4vw, 40px);
  --maxw: 1200px;
  color-scheme: dark;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg: #F4F2EE;
    --surface: #FFFFFF;
    --border: #DAD7D0;
    --fg: #0B0B0D;
    --muted: #5E5C66;
    --accent: #5B3DE6;
    --on-accent: #FFFFFF;
    --accent-text: #5B3DE6;
    color-scheme: light;
  }
}

:root[data-theme="light"] {
  --bg: #F4F2EE;
  --surface: #FFFFFF;
  --border: #DAD7D0;
  --fg: #0B0B0D;
  --muted: #5E5C66;
  --accent: #5B3DE6;
  --on-accent: #FFFFFF;
  --accent-text: #5B3DE6;
  color-scheme: light;
}

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: "Manrope", system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.55;
  overflow-x: hidden;
}
a { color: var(--accent-text); text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 3px; }
:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 3px; border-radius: 6px; }
.wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 var(--gutter); }
.eyebrow { color: var(--muted); font-size: 13px; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; }
h1, h2, h3 { line-height: 1.1; margin: 0; letter-spacing: -0.02em; }
h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 800; }
h3 { font-size: 18px; font-weight: 700; }
.muted { color: var(--muted); }
section { padding: clamp(56px, 9vw, 112px) 0; border-top: 1px solid var(--border); }

/* buttons */
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 20px; border-radius: 999px; font-weight: 700; font-size: 15px;
  border: 1px solid var(--border); color: var(--fg); background: transparent; cursor: pointer;
  font-family: inherit;
}
.btn:hover { text-decoration: none; border-color: var(--fg); }
.btn-primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.btn-primary:hover { border-color: var(--accent); filter: brightness(1.08); }

/* header */
.header { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--bg) 86%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
.header .wrap { display: flex; align-items: center; justify-content: space-between; height: 64px; gap: 16px; }
.logo { display: inline-flex; align-items: center; gap: 10px; color: var(--fg); font-weight: 800; letter-spacing: -0.01em; font-size: 18px; white-space: nowrap; }
.logo:hover { text-decoration: none; }
.logo svg { width: 26px; height: 26px; }
.nav { display: flex; align-items: center; gap: 4px; }
.nav a { color: var(--fg); padding: 8px 12px; border-radius: 999px; font-weight: 600; font-size: 15px; }
.nav a:hover { background: var(--surface); text-decoration: none; }
.nav .divider { width: 1px; height: 20px; background: var(--border); margin: 0 8px; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.icon-btn { width: 40px; height: 40px; border-radius: 999px; border: 1px solid var(--border); background: transparent; color: var(--fg); display: inline-grid; place-items: center; cursor: pointer; }
.menu-btn { display: none; }
@media (max-width: 900px) {
  .nav { display: none; }
  .menu-btn { display: inline-grid; }
  .header .btn { display: none; }
  .nav.open {
    display: flex; flex-direction: column; align-items: stretch; position: fixed; inset: 64px 0 0 0;
    background: var(--bg); padding: 16px var(--gutter); gap: 4px;
  }
  .nav.open a { font-size: 22px; padding: 14px 8px; }
  .nav.open .divider { width: 100%; height: 1px; margin: 8px 0; }
}

/* hero */
.hero { position: relative; padding: clamp(72px, 12vw, 160px) 0 clamp(56px, 8vw, 96px); border-top: 0; overflow: hidden; }
.hero-net { position: absolute; inset: 0; width: 100%; height: 100%; color: var(--accent-text); opacity: .35; pointer-events: none; }
.hero .wrap { position: relative; }
.hero h1 { font-size: clamp(40px, 8vw, 96px); font-weight: 800; letter-spacing: -0.035em; max-width: 12ch; }
.hero p.lead { font-size: clamp(18px, 2.2vw, 22px); color: var(--muted); max-width: 36ch; margin: 20px 0 32px; }
.hero .actions { display: flex; flex-wrap: wrap; gap: 12px; }
.stats { display: flex; flex-wrap: wrap; gap: clamp(24px, 6vw, 72px); margin-top: 56px; }
.stat b { display: block; font-size: clamp(28px, 4vw, 40px); font-weight: 800; letter-spacing: -0.02em; }
.stat span { color: var(--muted); font-size: 14px; }

/* pillars */
.section-head { display: flex; justify-content: space-between; align-items: end; gap: 24px; flex-wrap: wrap; margin-bottom: 40px; }
.section-head p { margin: 12px 0 0; max-width: 52ch; }
.pillars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 1000px) { .pillars { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .pillars { grid-template-columns: 1fr; } }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
a.card { color: var(--fg); display: block; transition: border-color .2s, transform .2s; }
a.card:hover { text-decoration: none; border-color: var(--accent-text); transform: translateY(-2px); }
.pillar ul { list-style: none; padding: 0; margin: 16px 0 0; color: var(--muted); }
.pillar li { padding: 6px 0; border-top: 1px solid var(--border); font-size: 15px; }
.pillar .node { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 20%, transparent); margin-bottom: 20px; }

/* ideas */
.steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; margin-bottom: 40px; counter-reset: step; }
.step { position: relative; padding: 16px 16px 16px 0; }
.step::before { counter-increment: step; content: "0" counter(step); display: block; font-weight: 800; color: var(--accent-text); font-size: 14px; margin-bottom: 8px; }
.step::after { content: ""; position: absolute; top: 26px; left: 36px; right: 12px; height: 1px; background: var(--border); }
.step:last-child::after { display: none; }
.step b { display: block; font-size: 18px; }
.step span { color: var(--muted); font-size: 14px; }
@media (max-width: 800px) { .steps { grid-template-columns: 1fr; } .step::after { display: none; } }
.ideas-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 16px; }
@media (max-width: 900px) { .ideas-grid { grid-template-columns: 1fr; } }
.spotlight .tag { display: inline-block; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
.spotlight h3 { font-size: clamp(22px, 3vw, 30px); margin: 16px 0 8px; }
.progress { height: 8px; background: var(--border); border-radius: 999px; overflow: hidden; margin: 24px 0 8px; }
.progress i { display: block; height: 100%; background: var(--accent); border-radius: inherit; }
.idea-list { list-style: none; margin: 0; padding: 0; }
.idea-list li { border-top: 1px solid var(--border); }
.idea-list li:first-child { border-top: 0; }
.idea-list a { display: flex; justify-content: space-between; gap: 16px; padding: 16px 0; color: var(--fg); }
.idea-list a:hover { text-decoration: none; color: var(--accent-text); }
.idea-list small { color: var(--muted); display: block; font-size: 13px; }
.votes { font-weight: 800; white-space: nowrap; }

/* events */
.events { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 1000px) { .events { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .events { grid-template-columns: 1fr; } }
.event time { font-weight: 800; color: var(--accent-text); font-size: 14px; }
.event h3 { margin: 10px 0 6px; }

/* feed */
.feed { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); column-gap: 32px; }
@media (max-width: 800px) { .feed { grid-template-columns: 1fr; } }
.feed li { display: flex; gap: 14px; padding: 14px 0; border-top: 1px solid var(--border); }
.feed .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); margin-top: 9px; }
.feed small { color: var(--muted); display: block; font-size: 13px; }

/* campuses */
.campuses { display: flex; flex-wrap: wrap; gap: 10px; }
.campus { display: inline-flex; gap: 10px; align-items: center; padding: 10px 16px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); }
.campus small { color: var(--muted); }

/* footer */
.footer { border-top: 1px solid var(--border); padding: 48px 0; color: var(--muted); font-size: 14px; }
.footer .wrap { display: grid; gap: 24px; }
.footer nav { display: flex; flex-wrap: wrap; gap: 8px 20px; }
.footer nav a { color: var(--fg); }

/* intro overlay: always ink, whatever the theme */
.intro { position: fixed; inset: 0; z-index: 100; background: var(--ink); color: #F4F2EE; display: grid; place-items: center; overflow: hidden; }
.intro canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.intro-word, .intro-welcome { position: absolute; font-family: "Manrope", system-ui, sans-serif; white-space: nowrap; }
.intro-word { font-size: clamp(28px, 6vw, 64px); font-weight: 500; letter-spacing: -0.01em; opacity: 0; }
.intro-word span { display: inline-block; white-space: pre; }
.intro-dot { position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #F4F2EE; box-shadow: 0 0 24px 4px rgba(155, 133, 255, .55); transform: scale(0); }
.intro-welcome { font-size: clamp(40px, 9vw, 96px); font-weight: 800; letter-spacing: -0.02em; opacity: 0; }
.intro-skip {
  position: absolute; right: 20px; bottom: 20px; padding: 10px 18px; border-radius: 999px;
  border: 1px solid rgba(244, 242, 238, .35); background: transparent; color: #F4F2EE; font: 600 14px "Manrope", system-ui, sans-serif; cursor: pointer;
}
.intro-skip:hover { border-color: #F4F2EE; }
body.intro-lock { overflow: hidden; }
```

- [ ] **Step 4: Run the contrast check to verify it passes**

Run: `python3 design/mock/contrast.py`
Expected: 14 lines printed, every ratio ≥ 4.50 (lowest: `dark --on-accent on --accent 4.52`), last line `all pairs pass`, exit code 0.

- [ ] **Step 5: Write `index.html` (page markup, intro overlay, no scripts yet)**

`design/mock/index.html`:

```html
<!doctype html>
<!--
  ModernSI homepage mock with the intro, for design sign-off. Sample data only.
  This work made by Anfinogentov Nikita
-->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ModernSI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230B0B0D'/%3E%3Cpath d='M16 16 C20 11 24 9 28 8 M16 16 C11 19 8 23 6 27 M16 16 C19 20 23 22 27 23' stroke='%239B85FF' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3Ccircle cx='16' cy='16' r='4' fill='%23F4F2EE'/%3E%3C/svg%3E">
</head>
<body>

<div class="intro" id="intro" role="dialog" aria-label="ModernSI intro" hidden>
  <canvas aria-hidden="true"></canvas>
  <div class="intro-word" data-intro-word>ModernSI</div>
  <div class="intro-dot" data-intro-dot aria-hidden="true"></div>
  <div class="intro-welcome" data-intro-welcome>Welcome!</div>
  <button class="intro-skip" type="button" data-intro-skip>Skip intro</button>
</div>

<header class="header">
  <div class="wrap">
    <a class="logo" href="#top" aria-label="ModernSI home">
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 16 C20 11 24 9 28 8 M16 16 C11 19 8 23 6 27 M16 16 C19 20 23 22 27 23" stroke="var(--accent-text)" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="16" cy="16" r="4.5" fill="currentColor"/></svg>
      ModernSI
    </a>
    <nav class="nav" id="nav" aria-label="Main">
      <a href="#pillars">Academic</a>
      <a href="#pillars">International</a>
      <a href="#ideas">Community</a>
      <a href="#feed">Personal</a>
      <span class="divider" aria-hidden="true"></span>
      <a href="#campuses">Forum</a>
    </nav>
    <div class="header-actions">
      <button class="icon-btn" type="button" id="theme-toggle" aria-label="Switch colour theme">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>
      </button>
      <a class="btn btn-primary" href="#top">Join</a>
      <button class="icon-btn menu-btn" type="button" id="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="nav">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 7h18M3 17h18"/></svg>
      </button>
    </div>
  </div>
</header>

<main id="top">
  <section class="hero">
    <svg class="hero-net" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1">
        <path d="M820 300 C 900 200, 1000 160, 1200 120"/>
        <path d="M820 300 C 760 420, 700 500, 640 600"/>
        <path d="M820 300 C 940 340, 1040 420, 1200 460"/>
        <path d="M820 300 C 860 180, 880 90, 900 0"/>
        <path d="M820 300 C 700 260, 600 280, 480 240"/>
        <path d="M480 240 C 420 200, 380 120, 360 0"/>
        <path d="M1040 200 C 1080 260, 1120 300, 1200 320"/>
      </g>
      <g fill="currentColor">
        <circle cx="820" cy="300" r="6"/><circle cx="480" cy="240" r="4"/><circle cx="1040" cy="200" r="4"/><circle cx="700" cy="500" r="3"/>
      </g>
    </svg>
    <div class="wrap">
      <p class="eyebrow">An independent international student network</p>
      <h1>One hub. Every campus.</h1>
      <p class="lead">A digital ecosystem built around the student experience.</p>
      <div class="actions">
        <a class="btn btn-primary" href="#top">Join with your university email</a>
        <a class="btn" href="#ideas">Explore ideas</a>
      </div>
      <div class="stats" aria-label="Network in numbers">
        <div class="stat"><b>1,284</b><span>students</span></div>
        <div class="stat"><b>9</b><span>campuses</span></div>
        <div class="stat"><b>37</b><span>ideas became events</span></div>
      </div>
    </div>
  </section>

  <section id="pillars">
    <div class="wrap">
      <div class="section-head">
        <div>
          <p class="eyebrow">What lives here</p>
          <h2>Four directions, one account</h2>
        </div>
      </div>
      <div class="pillars">
        <a class="card pillar" href="#pillars"><div class="node"></div><h3>Academic</h3>
          <ul><li>Schedule</li><li>Courses</li><li>Professors</li><li>Resources</li><li>Deadlines</li></ul></a>
        <a class="card pillar" href="#pillars"><div class="node"></div><h3>International</h3>
          <ul><li>Learning portals</li><li>Exchange opportunities</li><li>Scholarships</li><li>Conferences</li><li>International events</li></ul></a>
        <a class="card pillar" href="#ideas"><div class="node"></div><h3>Community</h3>
          <ul><li>Speaking Club</li><li>Volunteering</li><li>Student Government</li><li>Student Voice</li><li>Campus events</li></ul></a>
        <a class="card pillar" href="#feed"><div class="node"></div><h3>Personal</h3>
          <ul><li>Notifications</li><li>Activity history</li><li>Achievements</li><li>Digital portfolio</li></ul></a>
      </div>
    </div>
  </section>

  <section id="ideas">
    <div class="wrap">
      <div class="section-head">
        <div>
          <p class="eyebrow">Student ideas → real initiatives</p>
          <h2>Your idea can become a campus activity</h2>
          <p class="muted">Propose it, gather support, and Student Government takes it from there.</p>
        </div>
        <a class="btn btn-primary" href="#ideas">Propose an idea</a>
      </div>
      <ol class="steps" aria-label="How an idea becomes an event">
        <li class="step"><b>Idea</b><span>Any student proposes</span></li>
        <li class="step"><b>Support</b><span>50 votes to go further</span></li>
        <li class="step"><b>Review</b><span>Student Government decides</span></li>
        <li class="step"><b>Team</b><span>Volunteers join in</span></li>
        <li class="step"><b>On the Hub</b><span>It becomes an event</span></li>
      </ol>
      <div class="ideas-grid">
        <article class="card spotlight">
          <span class="tag">Event · whole network</span>
          <h3>International Food Festival</h3>
          <p class="muted">One evening, one table per country. Students cook a dish from home and share the story behind it.</p>
          <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="50" aria-valuenow="41" aria-label="Support"><i style="width:82%"></i></div>
          <p class="muted"><b style="color:var(--fg)">41 of 50</b> students support this idea</p>
          <a class="btn" href="#ideas">Support it</a>
        </article>
        <div class="card">
          <h3>Trending this week</h3>
          <ul class="idea-list">
            <li><a href="#ideas"><span>Peer tutoring hour before exams<small>Academic initiative · Almaty</small></span><span class="votes">38</span></a></li>
            <li><a href="#ideas"><span>Weekend speaking club in Spanish<small>Club · whole network</small></span><span class="votes">29</span></a></li>
            <li><a href="#ideas"><span>Quiet study room open until midnight<small>Campus life · Tbilisi</small></span><span class="votes">24</span></a></li>
            <li><a href="#ideas"><span>River clean-up with the eco club<small>Volunteering · Petropavl</small></span><span class="votes">17</span></a></li>
            <li><a href="#ideas"><span>Open data hackathon<small>Research project · whole network</small></span><span class="votes">12</span></a></li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <section id="events">
    <div class="wrap">
      <div class="section-head">
        <div><p class="eyebrow">On the Hub</p><h2>Coming up</h2></div>
      </div>
      <div class="events">
        <a class="card event" href="#events"><time>Oct 18 · 18:00</time><h3>Conversation night</h3><p class="muted">Online · whole network</p></a>
        <a class="card event" href="#events"><time>Oct 22 · 15:00</time><h3>CV clinic with alumni</h3><p class="muted">Room 204 · Almaty</p></a>
        <a class="card event" href="#events"><time>Oct 26 · 11:00</time><h3>Autumn volunteering day</h3><p class="muted">City park · Petropavl</p></a>
        <a class="card event" href="#events"><time>Nov 2 · 19:00</time><h3>Board games &amp; tea</h3><p class="muted">Student lounge · Tbilisi</p></a>
      </div>
    </div>
  </section>

  <section id="feed">
    <div class="wrap">
      <div class="section-head">
        <div><p class="eyebrow">Live across the network</p><h2>What just happened</h2></div>
      </div>
      <ul class="feed">
        <li><span class="dot"></span><span>Aru proposed <a href="#ideas">Peer tutoring hour before exams</a><small>4 min ago · Almaty</small></span></li>
        <li><span class="dot"></span><span><a href="#ideas">Weekend speaking club in Spanish</a> reached 25 votes<small>12 min ago · whole network</small></span></li>
        <li><span class="dot"></span><span>Student Government approved <a href="#ideas">Board games &amp; tea</a><small>1 h ago · Tbilisi</small></span></li>
        <li><span class="dot"></span><span>The team for <a href="#ideas">Autumn volunteering day</a> is complete<small>3 h ago · Petropavl</small></span></li>
        <li><span class="dot"></span><span><a href="#events">CV clinic with alumni</a> is now on the Hub<small>5 h ago · Almaty</small></span></li>
        <li><span class="dot"></span><span>A new campus joined the network: Yerevan<small>yesterday</small></span></li>
      </ul>
    </div>
  </section>

  <section id="campuses">
    <div class="wrap">
      <div class="section-head">
        <div><p class="eyebrow">Campus network</p><h2>Students from nine campuses</h2></div>
      </div>
      <div class="campuses">
        <span class="campus">Almaty <small>KZ</small></span>
        <span class="campus">Petropavl <small>KZ</small></span>
        <span class="campus">Tbilisi <small>GE</small></span>
        <span class="campus">Yerevan <small>AM</small></span>
        <span class="campus">Tashkent <small>UZ</small></span>
        <span class="campus">Bishkek <small>KG</small></span>
        <span class="campus">Baku <small>AZ</small></span>
        <span class="campus">Astana <small>KZ</small></span>
        <span class="campus">Shymkent <small>KZ</small></span>
      </div>
    </div>
  </section>
</main>

<footer class="footer">
  <div class="wrap">
    <nav aria-label="Footer">
      <a href="#top">About</a><a href="#pillars">Academic</a><a href="#pillars">International</a><a href="#ideas">Community</a><a href="#feed">Personal</a><a href="#campuses">Forum</a>
    </nav>
    <p>ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.</p>
  </div>
</footer>

<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/gsap.min.js" integrity="sha384-XmJ9SoHtVOHoQUcKvFAzVXwdkKo1Ie3bhmSoIAkcdsHGaIrVJIkmozyq0FJeb/Ly" crossorigin="anonymous"></script>
<script type="module" src="page.js"></script>
</body>
</html>
```

- [ ] **Step 6: Check every in-page anchor exists**

Run:
```bash
cd design/mock && python3 -c "
import re;h=open('index.html').read()
ids=set(re.findall(r'id=\"([^\"]+)\"',h));refs=set(re.findall(r'href=\"#([^\"]*)\"',h))
missing=refs-ids;print('missing:',missing);assert not missing and '' not in refs"
```
Expected: `missing: set()` and exit code 0.

- [ ] **Step 7: Commit**

```bash
git add design/mock/contrast.py design/mock/styles.css design/mock/index.html
git commit -m "Add homepage mock markup, theme tokens and contrast check"
```

---

### Task A2: Intro engine and page wiring

**Files:**
- Create: `design/mock/intro.js`
- Create: `design/mock/page.js`

**Interfaces:**
- Produces: `export function playIntro({ overlay, gsap, reducedMotion, onDone })` returning `{ skip() }`. `overlay` must contain `canvas`, `[data-intro-word]`, `[data-intro-dot]`, `[data-intro-welcome]`. `onDone()` is called exactly once, after the overlay has faded to opacity 0. Also `export const INTRO_TIMING` (seconds). Plan C imports both unchanged.

- [ ] **Step 1: Write `intro.js`**

`design/mock/intro.js`:

```js
/*
 * Intro engine: "ModernSI" collapses into a dot, the dot bursts into light threads, "Welcome!" appears,
 * then the overlay dissolves. Framework-free so the mock and the Next.js app share it.
 * This work made by Anfinogentov Nikita
 */

export const INTRO_TIMING = {
  fadeIn: 0.5,     // 0.0 – 0.5
  hold: 0.8,       // 0.5 – 1.3
  collapse: 1.2,   // 1.3 – 2.5
  dot: 0.8,        // 2.5 – 3.3
  burst: 0.6,      // 3.3 – 3.9
  welcome: 0.6,    // 3.9 – 4.5
  welcomeHold: 0.8, // 4.5 – 5.3
  reveal: 0.7,     // 5.3 – 6.0
};

const THREAD_COUNT = 16;
const GLOW = "rgba(155, 133, 255, 0.9)";

function makeThreads(count) {
  const threads = [];
  for (let i = 0; i < count; i++) {
    threads.push({
      angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
      bend: (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.45),
      reach: 0.55 + Math.random() * 0.25,
      length: 0.25 + Math.random() * 0.2,
      speed: 1 + Math.random() * 0.35,
      width: 1 + Math.random() * 1.2,
    });
  }
  return threads;
}

function pointOnThread(thread, t, cx, cy, radius) {
  // cubic bezier from the centre; the two control points bend the thread into an S-curve
  const dir = thread.angle;
  const r = radius * thread.reach;
  const c1 = { x: cx + Math.cos(dir + thread.bend) * r * 0.35, y: cy + Math.sin(dir + thread.bend) * r * 0.35 };
  const c2 = { x: cx + Math.cos(dir - thread.bend * 0.6) * r * 0.7, y: cy + Math.sin(dir - thread.bend * 0.6) * r * 0.7 };
  const end = { x: cx + Math.cos(dir) * r * 1.4, y: cy + Math.sin(dir) * r * 1.4 };
  const u = 1 - t;
  return {
    x: u * u * u * cx + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * end.x,
    y: u * u * u * cy + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * end.y,
  };
}

function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const threads = makeThreads(THREAD_COUNT);
  let width = 0;
  let height = 0;
  let dpr = 1;

  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(progress) {
    ctx.clearRect(0, 0, width, height);
    if (progress <= 0) return;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.hypot(width, height) / 2;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const thread of threads) {
      const s = progress * (1 + thread.length) * thread.speed;
      const head = Math.min(1, s);
      const tail = Math.min(1, Math.max(0, s - thread.length));
      if (head <= tail) continue;
      ctx.beginPath();
      const steps = 32;
      for (let k = 0; k <= steps; k++) {
        const p = pointOnThread(thread, tail + ((head - tail) * k) / steps, cx, cy, radius);
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.shadowColor = GLOW;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = "rgba(244, 242, 238, 0.85)";
      ctx.lineWidth = thread.width;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  fit();
  return { fit, draw };
}

function splitLetters(word) {
  const text = word.textContent;
  word.textContent = "";
  return Array.from(text).map((char) => {
    const span = document.createElement("span");
    span.textContent = char;
    word.appendChild(span);
    return span;
  });
}

export function playIntro({ overlay, gsap, reducedMotion = false, onDone }) {
  const word = overlay.querySelector("[data-intro-word]");
  const dot = overlay.querySelector("[data-intro-dot]");
  const welcome = overlay.querySelector("[data-intro-welcome]");
  const canvas = overlay.querySelector("canvas");
  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    window.removeEventListener("resize", onResize);
    onDone();
  }

  if (reducedMotion) {
    const quiet = gsap.timeline({ onComplete: finish });
    quiet.to(word, { opacity: 1, duration: 0.3 }).to(overlay, { opacity: 0, duration: 0.3 });
    return {
      skip() {
        quiet.kill();
        gsap.to(overlay, { opacity: 0, duration: 0.2, onComplete: finish });
      },
    };
  }

  const renderer = createRenderer(canvas);
  const burstState = { progress: 0 };
  function onResize() {
    renderer.fit();
    renderer.draw(burstState.progress);
  }
  window.addEventListener("resize", onResize);

  const letters = splitLetters(word);
  const T = INTRO_TIMING;
  const tl = gsap.timeline({ onComplete: finish });

  tl.to(word, { opacity: 1, duration: T.fadeIn, ease: "power1.out" });
  tl.addLabel("collapse", `+=${T.hold}`);
  // measured lazily at the start of the collapse so fonts and resizes are already settled
  tl.add(() => {
    const box = overlay.getBoundingClientRect();
    const centre = box.left + box.width / 2;
    letters.forEach((span) => {
      const r = span.getBoundingClientRect();
      gsap.to(span, { x: centre - (r.left + r.width / 2), duration: T.collapse, ease: "power3.in" });
    });
  }, "collapse");
  tl.to(word, { scale: 0.55, duration: T.collapse, ease: "power3.in" }, "collapse");
  tl.to(word, { opacity: 0, duration: 0.15 }, `collapse+=${T.collapse - 0.15}`);
  tl.to(dot, { scale: 1, duration: 0.15, ease: "back.out(3)" }, `collapse+=${T.collapse - 0.1}`);
  tl.to(dot, { scale: 1.35, duration: T.dot / 2, ease: "sine.inOut", yoyo: true, repeat: 1 }, `collapse+=${T.collapse + 0.05}`);
  tl.addLabel("burst", `collapse+=${T.collapse + T.dot}`);
  tl.to(dot, { scale: 2.4, opacity: 0, duration: 0.25, ease: "power2.out" }, "burst");
  const threadsDuration = T.burst + T.welcome + 0.5;
  tl.to(burstState, {
    progress: 1,
    duration: threadsDuration,
    ease: "power2.out",
    onUpdate: () => renderer.draw(burstState.progress),
  }, "burst");
  tl.fromTo(welcome,
    { opacity: 0, scale: 0.96, filter: "blur(10px)" },
    { opacity: 1, scale: 1, filter: "blur(0px)", duration: T.welcome, ease: "power2.out" },
    `burst+=${T.burst}`);
  tl.to(overlay, { opacity: 0, duration: T.reveal, ease: "power1.inOut" }, `burst+=${T.burst + T.welcome + T.welcomeHold}`);

  return {
    skip() {
      if (finished) return;
      tl.kill();
      gsap.to(overlay, { opacity: 0, duration: 0.3, onComplete: finish });
    },
  };
}
```

- [ ] **Step 2: Write `page.js`**

`design/mock/page.js`:

```js
/*
 * Mock page wiring: plays the intro once per session, theme toggle, mobile menu.
 * This work made by Anfinogentov Nikita
 */
import { playIntro } from "./intro.js";

const SEEN_KEY = "msi_intro_seen";

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
    return;
  }
  overlay.hidden = false;
  document.body.classList.add("intro-lock");
  const skipButton = overlay.querySelector("[data-intro-skip]");
  const previousFocus = document.activeElement;
  skipButton.focus();

  const trapFocus = (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      skipButton.focus();
    }
    if (event.key === "Escape") intro.skip();
  };
  document.addEventListener("keydown", trapFocus);

  const intro = playIntro({
    overlay,
    gsap: window.gsap,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    onDone() {
      markIntroSeen();
      document.removeEventListener("keydown", trapFocus);
      document.body.classList.remove("intro-lock");
      overlay.remove();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    },
  });
  overlay.addEventListener("click", () => intro.skip());
}

function setupTheme() {
  const button = document.getElementById("theme-toggle");
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem("msi_theme");
    if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  } catch {
    // no storage: follow the system theme
  }
  button.addEventListener("click", () => {
    const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next = current === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("msi_theme", next);
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
```

- [ ] **Step 3: Serve and open manually once**

Run: `cd design/mock && python3 -m http.server 4310` (leave running in background).
Open `http://localhost:4310/?intro` in a browser. Expected: word fades in, letters converge into a dot, dot pulses, bursts into glowing threads, "Welcome!" appears, overlay dissolves into the dark homepage at ≈6 s. Reload without `?intro` in the same tab → no intro.

- [ ] **Step 4: Commit**

```bash
git add design/mock/intro.js design/mock/page.js
git commit -m "Add intro engine and mock page wiring"
```

---

### Task A3: Automated checks and screenshots

**Files:**
- Create: `design/mock/shots.mjs`
- Create: `design/mock/package.json`

**Interfaces:**
- Consumes: the mock served at `http://localhost:4310/` (Task A2 Step 3).
- Produces: `design/mock/shots/*.png` (git-ignored) for the user review.

- [ ] **Step 1: Write the check script**

`design/mock/package.json`:

```json
{
  "name": "modernsi-mock-checks",
  "private": true,
  "type": "module",
  "devDependencies": { "@playwright/test": "1.63.0" }
}
```

`design/mock/shots.mjs`:

```js
/*
 * Mock checks: intro timing and skip behaviour, review-focus edge cases, screenshots of both themes.
 * This work made by Anfinogentov Nikita
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:4310/";
const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures.push(label);
};

mkdirSync("shots", { recursive: true });
const browser = await chromium.launch();

async function fresh(options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { context, page, errors };
}

// 1. full intro plays, ends in ~6 s, then never again in the same session
{
  const { context, page, errors } = await fresh({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE);
  const started = Date.now();
  for (const t of [400, 2000, 3000, 3700, 4600]) {
    await page.waitForTimeout(Math.max(0, t - (Date.now() - started)));
    await page.screenshot({ path: `shots/intro-${t}ms.png` });
  }
  await page.waitForSelector("#intro", { state: "detached", timeout: 9000 });
  // measured from navigation start, so slow font/CDN loading does not skew it
  const elapsed = (await page.evaluate(() => performance.now())) / 1000;
  check(elapsed > 5.8 && elapsed < 7.5, `intro ends ~6 s after navigation (${elapsed.toFixed(2)} s)`);
  check(!(await page.evaluate(() => document.body.classList.contains("intro-lock"))), "scroll unlocked after intro");
  await page.reload();
  check((await page.locator("#intro").count()) === 0, "no intro on reload in same session");
  check(errors.length === 0, `no console errors (${errors.join("; ")})`);
  await context.close();
}

// 2. skip twice, immediately: reveals once, no errors
{
  const { context, page, errors } = await fresh();
  await page.goto(BASE);
  await page.click("[data-intro-skip]", { timeout: 2000 });
  await page.click("body", { force: true }).catch(() => {});
  await page.waitForSelector("#intro", { state: "detached", timeout: 2000 });
  check(errors.length === 0, "double skip at start: no errors");
  await context.close();
}

// 3. Esc skips
{
  const { context, page } = await fresh();
  await page.goto(BASE);
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForSelector("#intro", { state: "detached", timeout: 2000 });
  check(true, "Esc skips");
  await context.close();
}

// 4. reduced motion: done well under a second
{
  const { context, page } = await fresh({ reducedMotion: "reduce" });
  const started = Date.now();
  await page.goto(BASE);
  await page.waitForSelector("#intro", { state: "detached", timeout: 3000 });
  check(Date.now() - started < 2000, "reduced motion intro is short");
  await context.close();
}

// 5. sessionStorage throws: intro still plays and finishes
{
  const { context, page, errors } = await fresh();
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("blocked"); } });
  });
  await page.goto(BASE);
  check(await page.locator("#intro").isVisible(), "intro visible with blocked storage");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#intro", { state: "detached", timeout: 2000 });
  check(errors.length === 0, "blocked storage: no errors");
  await context.close();
}

// 6. resize mid-burst and DPR 3: canvas backing store matches the viewport
{
  const { context, page } = await fresh({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 3 });
  await page.goto(BASE);
  await page.waitForTimeout(3500);
  await page.setViewportSize({ width: 700, height: 900 });
  await page.waitForTimeout(150);
  const size = await page.evaluate(() => {
    const c = document.querySelector("#intro canvas");
    return c ? [c.width, c.height] : null;
  });
  check(size && size[0] === 2100 && size[1] === 2700, `canvas refits after resize at DPR 3 (${size})`);
  await page.screenshot({ path: "shots/intro-resized-dpr3.png" });
  await context.close();
}

// 7. screenshots of both themes, no horizontal scroll at 360 and 1440
for (const scheme of ["dark", "light"]) {
  for (const width of [1440, 360]) {
    const { context, page } = await fresh({ viewport: { width, height: 900 }, colorScheme: scheme });
    await page.addInitScript(() => sessionStorage.setItem("msi_intro_seen", "1"));
    await page.goto(BASE);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `${scheme} ${width}px: no horizontal scroll (${overflow})`);
    await page.screenshot({ path: `shots/home-${scheme}-${width}.png`, fullPage: true });
    if (width === 360) {
      await page.click("#menu-btn");
      await page.screenshot({ path: `shots/menu-${scheme}-360.png` });
    }
    await context.close();
  }
}

// 8. intro word fits at 360
{
  const { context, page } = await fresh({ viewport: { width: 360, height: 740 } });
  await page.goto(BASE);
  await page.waitForTimeout(700);
  const fits = await page.evaluate(() => {
    const r = document.querySelector("[data-intro-word]").getBoundingClientRect();
    return r.left >= 0 && r.right <= window.innerWidth;
  });
  check(fits, "intro word fits at 360px");
  await context.close();
}

await browser.close();
if (failures.length) {
  console.log(`\nOoops.. ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nall mock checks pass");
```

- [ ] **Step 2: Install and run**

Run:
```bash
cd design/mock && npm install && npx playwright install chromium && printf 'node_modules/\nshots/\n' > .gitignore && node shots.mjs
```
Expected: every line `ok`, final line `all mock checks pass`, exit code 0. If a line fails, fix `intro.js`/`styles.css`/`page.js` (not the check) and re-run.

- [ ] **Step 3: Look at the screenshots yourself**

Open `shots/intro-3700ms.png` (threads burst), `shots/intro-4600ms.png` (Welcome!), `shots/home-dark-1440.png`, `shots/home-light-1440.png`, `shots/home-dark-360.png`, `shots/menu-dark-360.png`. Confirm: threads are curved and glowing (not straight spokes), "Welcome!" readable, no overlapping text, stats row and pillars aligned, light theme accent is the darker violet.

- [ ] **Step 4: Re-run the contrast check**

Run: `python3 design/mock/contrast.py`
Expected: `all pairs pass`.

- [ ] **Step 5: Commit**

```bash
git add design/mock/shots.mjs design/mock/package.json design/mock/package-lock.json design/mock/.gitignore
git commit -m "Add automated mock checks and screenshots"
```

- [ ] **Step 6: User sign-off gate**

Show the user the screenshots (dark/light, desktop/mobile, two intro frames) and the URL `http://localhost:4310/?intro` to watch it live. **Stop here.** Plan C must not start its visual tasks (C2+) until the user approves the mock or the requested changes are applied and re-checked with Steps 2–4.
