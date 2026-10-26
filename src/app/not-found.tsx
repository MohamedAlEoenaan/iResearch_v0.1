import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="public-main">
      <div className="card stack">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p className="muted">
          This page is unavailable or you don’t have access.
        </p>
        <Link href="/dashboard">Return to your workspace →</Link>
      </div>
    </main>
  );
}
