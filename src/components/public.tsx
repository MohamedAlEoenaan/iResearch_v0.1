import Link from 'next/link';
import Image from 'next/image';
import { Button } from './ui/button';
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="iResearch home">
      <Image
        src="/brand/iresearch-logo.png"
        alt="iResearch"
        width={400}
        height={136}
        priority
      />
      <span>V0.1</span>
    </Link>
  );
}
export function PublicNav() {
  return (
    <header className="public-nav">
      <Brand />
      <nav aria-label="Main navigation">
        <Link href="/services">Services</Link>
        <Link href="/packages">Packages</Link>
        <Link href="/login">Sign in</Link>
        <Button asChild>
          <Link href="/register">Get started</Link>
        </Button>
      </nav>
    </header>
  );
}
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <span>iResearch · Research services</span>
      <span>V0.1 development build · Official iResearch branding</span>
    </footer>
  );
}
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="auth-layout">
      <aside className="auth-aside">
        <Brand />
        <div>
          <p className="eyebrow">A clearer path to research</p>
          <h2>From your first question to your next discovery.</h2>
          <p className="muted">
            One workspace to manage your requirements, follow progress, and
            review the research that matters to you.
          </p>
        </div>
        <p className="small muted">iResearch V0.1 · English</p>
      </aside>
      <section className="auth-content">
        <div className="auth-box">{children}</div>
      </section>
    </main>
  );
}
