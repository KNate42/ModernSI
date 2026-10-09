// An honest empty state: one line of what is missing and, when there is a next step, a button for it.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { Icon, type IconName } from "./Icon";

type Action = { href: string; label: string };

export function EmptyState({ children, action, icon = "plus" }: { children: React.ReactNode; action?: Action; icon?: IconName }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true"><Icon name={icon} /></span>
      <div className="empty-copy">
        <p>{children}</p>
        {action && <Link className="btn btn-small btn-teal" href={action.href}>{action.label}</Link>}
      </div>
    </div>
  );
}
