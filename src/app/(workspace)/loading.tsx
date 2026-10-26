export default function Loading() {
  return (
    <div className="stack" aria-label="Loading workspace" role="status">
      <p className="muted">Loading your workspace…</p>
      <div className="grid three">
        <div className="loading-bar" />
        <div className="loading-bar" />
        <div className="loading-bar" />
      </div>
      <div className="loading-bar" style={{ height: 280 }} />
    </div>
  );
}
