// The shape of an inner page while its data loads: a band with a title, then three cards. Screen readers hear one short status.
// This work made by Anfinogentov Nikita

export function PageSkeleton() {
  return (
    <div aria-busy="true">
      <div className="page-hero tone-paper">
        <div className="wrap page-hero-grid">
          <div className="page-hero-copy" aria-hidden="true">
            <span className="skeleton skeleton-eyebrow" />
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-line" />
          </div>
        </div>
      </div>
      <div className="wrap page-body">
        <p className="visually-hidden" role="status">Loading the page</p>
        <div className="cards" aria-hidden="true">
          {[1, 2, 3].map((number) => (
            <div key={number} className="card skeleton-card">
              <span className="skeleton skeleton-eyebrow" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line skeleton-short" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
