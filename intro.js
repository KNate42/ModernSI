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
// lilac, sky, mint and orchid: the threads carry colour, never plain white
const THREAD_COLOURS = ["#B9A8FF", "#8FC4FF", "#8EF0CC", "#F5A8EA"];

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
      colour: THREAD_COLOURS[i % THREAD_COLOURS.length],
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

  // Fallback: if canvas context is unavailable, return a no-op renderer
  if (!ctx) {
    return { fit() {}, draw() {} };
  }

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
      ctx.shadowColor = thread.colour;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = thread.colour;
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
