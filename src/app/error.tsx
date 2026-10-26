'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="public-main">
      <div className="card stack">
        <p className="eyebrow">Unable to load this page</p>
        <h1>Something needs attention</h1>
        <p className="muted">
          The page could not be loaded. Please retry. If the issue continues,
          check the application and database status.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
