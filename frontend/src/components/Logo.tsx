// The wordmark: "Modern" and a tilted teal "SI" chip, the same lettering as the intro. It links home.
// This work made by Anfinogentov Nikita
import Link from "next/link";

export function Logo() {
  return (
    <Link className="logo" href="/" aria-label="ModernSI home">
      Modern<b>SI</b>
    </Link>
  );
}
