// Still "nodes and threads" network behind the hero: the frame the intro burst settles into.
// This work made by Anfinogentov Nikita

export function HeroNet() {
  return (
    <svg className="hero-net" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M820 300 C 900 200, 1000 160, 1200 120" />
        <path d="M820 300 C 760 420, 700 500, 640 600" />
        <path d="M820 300 C 940 340, 1040 420, 1200 460" />
        <path d="M820 300 C 860 180, 880 90, 900 0" />
        <path d="M820 300 C 700 260, 600 280, 480 240" />
        <path d="M480 240 C 420 200, 380 120, 360 0" />
        <path d="M1040 200 C 1080 260, 1120 300, 1200 320" />
      </g>
      <g fill="currentColor">
        <circle cx="820" cy="300" r="6" />
        <circle cx="480" cy="240" r="4" />
        <circle cx="1040" cy="200" r="4" />
        <circle cx="700" cy="500" r="3" />
      </g>
    </svg>
  );
}
