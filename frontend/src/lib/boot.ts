// What the head script puts on <html> before the first paint: the saved theme and the motion mode.
// It is one function, so the head script and the repair after a client render (PageState) run the same code.
// This work made by Anfinogentov Nikita

// Plain ES and no outside names inside: the layout turns this function into the text of the head script
export function applyPageState() {
  const root = document.documentElement;
  if (!root.dataset.theme) {
    try {
      const saved = localStorage.getItem("msi_theme");
      if (saved === "light" || saved === "dark") root.dataset.theme = saved;
    } catch {
      // storage blocked: the system setting decides
    }
  }
  if (!root.dataset.motion) {
    let calm = false;
    try {
      calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      // an old browser: full motion
    }
    root.dataset.motion = new URLSearchParams(location.search).get("still") === "1" || calm ? "still" : "full";
  }
}
