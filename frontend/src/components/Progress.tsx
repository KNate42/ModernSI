// Progress bar towards a goal (votes to review, people to a full team). A goal of up to 60 is drawn as that many segments.
// This work made by Anfinogentov Nikita

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const segmented = max > 1 && max <= 60;
  return (
    <div
      className={segmented ? "progress progress-segmented" : "progress"} role="progressbar"
      aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-label={label}
      style={segmented ? ({ "--goal": max } as React.CSSProperties) : undefined}
    >
      <i style={{ width: `${percent}%` }} />
    </div>
  );
}
