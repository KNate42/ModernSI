// "23 going" with three little faces, or an invitation to be the first.
// This work made by Anfinogentov Nikita

export function Going({ count, you }: { count: number; you?: boolean }) {
  if (count < 1) return <p className="next-up-going">Nobody yet. Be the first.</p>;
  return (
    <p className="next-up-going">
      <span className="faces" aria-hidden="true"><i /><i /><i /></span>
      <span><b>{count}</b> going{you ? ", you included" : ""}</span>
    </p>
  );
}
