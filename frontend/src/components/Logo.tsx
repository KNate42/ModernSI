// The node mark: a dot with three curved threads, the still frame of the intro burst.
// This work made by Anfinogentov Nikita

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 16 C20 11 24 9 28 8 M16 16 C11 19 8 23 6 27 M16 16 C19 20 23 22 27 23" stroke="var(--accent-text)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="16" r="4.5" fill="currentColor" />
    </svg>
  );
}
