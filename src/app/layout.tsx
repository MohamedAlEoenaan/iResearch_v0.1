import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'iResearch V0.1', template: '%s · iResearch' },
  description: 'Research services for individuals and organizations.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
