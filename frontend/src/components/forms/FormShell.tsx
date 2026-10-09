// The page around a form: the title, a human line and optional tips on the left, the form on a sticker card on the right.
// This work made by Anfinogentov Nikita
import { HandNote } from "../HandNote";
import { Icon, type IconName } from "../Icon";
import type { Tone } from "../PageHero";

type Props = {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  icon?: IconName;
  tone?: Tone;
  note?: string;
  tips?: string[];
  crumbs?: React.ReactNode;
  below?: React.ReactNode;
  children: React.ReactNode;
};

export function FormShell({ eyebrow, title, lead, icon, tone = "sky", note, tips, crumbs, below, children }: Props) {
  return (
    <div className={`form-band tone-${tone}`}>
      <div className="wrap form-page">
        <div className="form-page-intro">
          {crumbs}
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {lead && <p className="form-page-lead">{lead}</p>}
          {tips && (
            <ul className="tips">
              {tips.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          )}
          {(icon || note) && (
            <div className="form-page-art" aria-hidden="true">
              {icon && <span className="page-hero-badge"><Icon name={icon} /></span>}
              {note && <HandNote arrow="wall">{note}</HandNote>}
            </div>
          )}
        </div>
        <div className="form-card">
          {children}
          {below && <p className="below">{below}</p>}
        </div>
      </div>
    </div>
  );
}
