// What a section covers. Plain text on purpose: these parts are described here, not linked, until they exist.
// This work made by Anfinogentov Nikita
import { Icon, type IconName } from "./Icon";

export function Topics({ title, intro, topics }: { title: string; intro?: string; topics: [string, string, IconName][] }) {
  return (
    <div className="topics">
      <h2>{title}</h2>
      {intro && <p className="topics-intro">{intro}</p>}
      <ul>
        {topics.map(([name, text, icon]) => (
          <li key={name}>
            <span className="topics-icon" aria-hidden="true"><Icon name={icon} /></span>
            <b>{name}</b>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
