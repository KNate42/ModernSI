// Progress bar towards a goal (votes to review, people to a full team).
// This work made by Anfinogentov Nikita

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-label={label}>
      <i style={{ width: `${percent}%` }} />
    </div>
  );
}
