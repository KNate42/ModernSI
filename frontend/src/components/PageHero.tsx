// The band at the top of an inner page: eyebrow sticker, big title with a marker word, a human line, the actions and a sticker icon (or any art).
// This work made by Anfinogentov Nikita
import { HandNote } from "./HandNote";
import { Icon, type IconName } from "./Icon";

export type Tone = "sky" | "teal" | "steel" | "paper";

type Props = {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  icon?: IconName;
  tone?: Tone;
  note?: string;
  crumbs?: React.ReactNode;
  art?: React.ReactNode;
  extra?: React.ReactNode;
  children?: React.ReactNode;
};

export function PageHero({ eyebrow, title, lead, icon, tone = "paper", note, crumbs, art, extra, children }: Props) {
  return (
    <div className={`page-hero tone-${tone}`}>
      <div className="wrap page-hero-grid">
        <div className="page-hero-copy">
          {crumbs}
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {lead && <p className="page-hero-lead">{lead}</p>}
          {children && <div className="page-hero-actions">{children}</div>}
          {extra}
        </div>
        {(icon || art) && (
          <div className="page-hero-art" aria-hidden="true">
            {art ?? (icon && <span className="page-hero-badge"><Icon name={icon} /></span>)}
            {note && <HandNote arrow="card">{note}</HandNote>}
          </div>
        )}
      </div>
    </div>
  );
}
