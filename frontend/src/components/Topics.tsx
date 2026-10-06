// What a section covers. Plain text on purpose: these parts are described here, not linked, until they exist.
// This work made by Anfinogentov Nikita

export function Topics({ title, intro, topics }: { title: string; intro?: string; topics: [string, string][] }) {
  return (
    <div className="topics">
      <h2>{title}</h2>
      {intro && <p>{intro}</p>}
      <ul>
        {topics.map(([name, text]) => (
          <li key={name}><b>{name}</b><span>{text}</span></li>
        ))}
      </ul>
    </div>
  );
}
