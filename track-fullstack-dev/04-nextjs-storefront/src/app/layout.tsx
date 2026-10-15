import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { CartStatus } from '@/components/CartStatus';
import { SearchForm } from '@/components/SearchForm';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} - sponsored picks and everyday gear`, template: `%s | ${SITE_NAME}` },
  description: 'AdFlow Shop is a fictional storefront used to demonstrate Next.js rendering strategies.',
  openGraph: { siteName: SITE_NAME, type: 'website' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="site">
          <Link href="/"><strong>{SITE_NAME}</strong></Link>
          <nav aria-label="Primary">
            <Link href="/category/audio">Audio</Link>
            <Link href="/category/home-office">Home office</Link>
            <Link href="/category/outdoor">Outdoor</Link>
            <Link href="/advertiser">Advertisers</Link>
            <CartStatus />
          </nav>
          <SearchForm />
        </header>
        <main id="main" tabIndex={-1}>{children}</main>
      </body>
    </html>
  );
}
