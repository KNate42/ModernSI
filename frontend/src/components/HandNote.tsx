// A handwritten note with a hand-drawn arrow. The arrow geometry depends on where the note sits.
// This work made by Anfinogentov Nikita

const arrows = {
  hero: { box: "0 0 64 40", paths: ["M60 30C44 40 20 36 8 16", "M6 30 6 14 22 18"] },
  card: { box: "0 0 64 40", paths: ["M58 8C44 2 20 6 8 24", "M6 10 6 26 22 22"] },
  wall: { box: "0 0 64 40", paths: ["M6 8C20 2 44 6 56 24", "M58 10 58 26 42 22"] },
  finale: { box: "0 0 80 50", paths: ["M76 30C54 48 20 44 10 14", "M2 26 9 10l15 8"] },
  stop: { box: "0 0 50 30", paths: ["M6 26C16 24 30 18 40 6", "M28 7l12-2 2 12"] },
};

type Props = { arrow: keyof typeof arrows; tone?: "night" | "teal"; className?: string; children: React.ReactNode };

export function HandNote({ arrow, tone, className, children }: Props) {
  const classes = ["hand-note", tone && `hand-note-${tone}`, className].filter(Boolean).join(" ");
  return (
    <p className={classes}>
      <svg viewBox={arrows[arrow].box} aria-hidden="true" focusable="false">
        {arrows[arrow].paths.map((path) => <path key={path} d={path} />)}
      </svg>
      <span>{children}</span>
    </p>
  );
}
