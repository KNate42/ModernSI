// 404 page.
// This work made by Anfinogentov Nikita
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap page-head">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The link may be old, or the page was removed.</p>
      <p><Link className="btn btn-primary" href="/">Back to the hub</Link></p>
    </div>
  );
}
