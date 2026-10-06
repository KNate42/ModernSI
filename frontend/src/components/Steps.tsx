// Idea → Support → Review → Team → On the Hub.
// This work made by Anfinogentov Nikita

export function Steps({ threshold }: { threshold?: number }) {
  const steps = [
    ["Idea", "Any student proposes"],
    ["Support", threshold ? `${threshold} votes to go further` : "Enough votes to go further"],
    ["Review", "Student Government decides"],
    ["Team", "Volunteers join in"],
    ["On the Hub", "It becomes an event"],
  ];
  return (
    <ol className="steps" aria-label="How an idea becomes an event">
      {steps.map(([title, text]) => (
        <li key={title} className="step"><b>{title}</b><span>{text}</span></li>
      ))}
    </ol>
  );
}
