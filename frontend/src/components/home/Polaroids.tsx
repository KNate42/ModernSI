// The two drawn polaroids of the hero. Their captions are generic (a drawing, not a campus photo); a student photo can replace a scene later.
// This work made by Anfinogentov Nikita
import Image from "next/image";

export type Photo = { src: string; alt: string };

function FoodScene() {
  return (
    <svg viewBox="0 0 300 268" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <circle className="halo" cx="236" cy="104" r="44" />
      <circle className="halo" cx="236" cy="104" r="62" />
      <circle className="f-butter" cx="236" cy="104" r="24" />
      <path className="f-teal" d="M0 150C44 118 86 130 128 146c48 18 98-26 172-4v126H0Z" />
      <path className="f-navy" d="M0 184c58-26 118-8 176-12 46-3 88-14 124-6v102H0Z" />
      <path className="s-night" fill="none" strokeWidth="2.2" d="M-4 24Q75 74 150 36T304 42" />
      <g className="f-butter s-night" strokeWidth="1.6">
        <circle cx="35" cy="49" r="6" /><circle cx="74" cy="57" r="6" /><circle cx="112" cy="53" r="6" /><circle cx="150" cy="36" r="6" />
        <circle cx="188" cy="23" r="6" /><circle cx="226" cy="21" r="6" /><circle cx="265" cy="27" r="6" />
      </g>
      <rect className="f-royal s-night" x="14" y="196" width="138" height="12" rx="3" strokeWidth="2.5" />
      <path className="s-night" fill="none" strokeWidth="4" strokeLinecap="round" d="M28 208v34M138 208v34" />
      <ellipse className="f-cream s-night" cx="44" cy="190" rx="19" ry="6" strokeWidth="2.2" /><ellipse className="f-butter" cx="44" cy="186" rx="12" ry="4.5" />
      <ellipse className="f-cream s-night" cx="86" cy="190" rx="19" ry="6" strokeWidth="2.2" /><ellipse className="f-accent" cx="86" cy="186" rx="12" ry="4.5" />
      <ellipse className="f-cream s-night" cx="126" cy="190" rx="16" ry="5.5" strokeWidth="2.2" /><ellipse className="f-teal" cx="126" cy="186" rx="10" ry="4" />
      <rect className="f-night" x="172" y="196" width="62" height="42" rx="10" />
      <rect className="f-teal s-night" x="166" y="186" width="74" height="14" rx="6" strokeWidth="2.5" />
      <path className="s-cream" fill="none" strokeWidth="3" strokeLinecap="round" d="M186 176c-9-10 9-14 0-26M203 176c-9-10 9-14 0-26M220 176c-9-10 9-14 0-26" />
      <path className="f-night" d="M0 244H300V268H0Z" />
      <path className="s-butter" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 8" d="M8 256H292" />
    </svg>
  );
}

function StudyScene() {
  return (
    <svg viewBox="0 0 240 214" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect className="f-night s-teal" x="22" y="18" width="84" height="92" rx="4" strokeWidth="4" />
      <path className="s-teal" fill="none" strokeWidth="3" d="M64 18v92M22 64h84" />
      <path className="f-butter" d="M88 34a14 14 0 1 1-12 22 11 11 0 0 0 12-22Z" />
      <g className="f-butter"><circle cx="38" cy="36" r="1.8" /><circle cx="50" cy="86" r="1.8" /><circle cx="92" cy="86" r="1.8" /><circle cx="34" cy="98" r="1.4" /></g>
      <circle className="f-glow" cx="190" cy="100" r="58" />
      <circle className="halo" cx="190" cy="100" r="58" />
      <path className="s-cream" fill="none" strokeWidth="5" strokeLinecap="round" d="M190 146C190 120 206 114 206 86" />
      <path className="f-butter s-cream" strokeWidth="3" strokeLinejoin="round" d="M194 66h24l10 26h-44Z" />
      <path className="s-butter" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 7" d="M180 102 170 128M206 102v30M232 102l10 26" />
      <rect className="f-teal" x="0" y="150" width="240" height="64" />
      <rect className="f-navy" x="0" y="146" width="240" height="8" />
      <rect className="f-cream s-night" x="170" y="140" width="40" height="8" rx="3" strokeWidth="2.5" />
      <rect className="f-accent s-night" x="20" y="128" width="64" height="18" rx="2" strokeWidth="2.5" />
      <rect className="f-cream s-night" x="26" y="112" width="54" height="16" rx="2" strokeWidth="2.5" />
      <rect className="f-royal s-night" x="32" y="98" width="44" height="14" rx="2" strokeWidth="2.5" />
      <path className="f-butter s-night" strokeWidth="2.5" d="M106 124h26v22h-26Z" />
      <path className="s-night" fill="none" strokeWidth="2.5" d="M132 130h8a5 5 0 0 1 0 10h-8" />
      <path className="s-cream" fill="none" strokeWidth="2.5" strokeLinecap="round" d="M112 116c-5-6 5-8 0-14M122 116c-5-6 5-8 0-14" />
    </svg>
  );
}

const scenes = {
  food: { className: "polaroid-food", tape: "tape", scene: "scene-dusk", caption: "Food night" },
  study: { className: "polaroid-study", tape: "tape tape-teal", scene: "scene-room", caption: "Study room, 23:40" },
};

export function Polaroid({ variant, photo }: { variant: keyof typeof scenes; photo?: Photo }) {
  const look = scenes[variant];
  return (
    <figure className={`polaroid ${look.className} tilt`} aria-hidden={photo ? undefined : true} data-reveal>
      <span className={look.tape} aria-hidden="true" />
      <div className={`polaroid-photo ${look.scene}`}>
        {photo ? (
          <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 60em) 320px, 60vw" unoptimized />
        ) : variant === "food" ? (
          <FoodScene />
        ) : (
          <StudyScene />
        )}
      </div>
      <figcaption>{look.caption}</figcaption>
    </figure>
  );
}
