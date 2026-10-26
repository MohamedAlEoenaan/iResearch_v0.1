import Link from 'next/link';
import {
  ArrowUpRight,
  Building2,
  UserRound,
  ClipboardCheck,
} from 'lucide-react';
import { PublicNav, PublicFooter } from '@/components/public';
import { Button } from '@/components/ui/button';
export default function Home() {
  return (
    <>
      <PublicNav />
      <main id="main" className="public-main">
        <section className="hero">
          <div>
            <span className="eyebrow">For individuals. For organizations.</span>
            <h1>
              Your research.
              <br />A clear way forward.
            </h1>
            <p className="muted">
              A dedicated workspace for research services, from defining your
              requirements to reviewing your deliverables.
            </p>
            <div className="row">
              <Button asChild>
                <Link href="/register">
                  Create your workspace
                  <ArrowUpRight size={16} />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/services">Explore services</Link>
              </Button>
            </div>
          </div>
          <div className="hero-panel">
            <p className="eyebrow">Your research journey</p>
            {[
              {
                title: 'Define your requirements',
                text: 'Keep your research brief in one place.',
              },
              {
                title: 'Follow your progress',
                text: 'Know when your input is needed.',
              },
              {
                title: 'Review and move forward',
                text: 'Review outputs and request revisions.',
              },
            ].map((s, i) => (
              <div key={s.title} className="hero-step">
                <span>0{i + 1}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p className="muted">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="features grid three">
          <article className="card">
            <UserRound />
            <h2>For individuals</h2>
            <p className="muted small">
              Your own research requests, progress updates, and deliverables in
              a private workspace.
            </p>
          </article>
          <article className="card">
            <Building2 />
            <h2>For organizations</h2>
            <p className="muted small">
              A shared workspace with invitation-only membership and clear
              request approval.
            </p>
          </article>
          <article className="card">
            <ClipboardCheck />
            <h2>A structured process</h2>
            <p className="muted small">
              Requirements, quality review, and client acceptance are distinct
              steps with a recorded history.
            </p>
          </article>
        </section>
        <p className="notice small" style={{ marginTop: '2rem' }}>
          Development status: registration is available, but email verification,
          payment checkout, and file services are not yet enabled.
        </p>
      </main>
      <PublicFooter />
    </>
  );
}
