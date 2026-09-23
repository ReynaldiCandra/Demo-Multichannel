import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ShellGate } from '@/components/shell-gate';
import { ErrorBoundary } from '@/components/error-boundary';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dashboard Multichannel',
  description:
    'Dashboard pribadi untuk POS dropship, jobs freelance, Meta Ads, live selling, dan ledger profit bulanan.',
  icons: { icon: '/branding/websensial-mark.png' },
  openGraph: {
    title: 'Dashboard Multichannel',
    description: 'POS, jobs, Meta Ads, live selling, dan ledger dalam satu tempat.',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>
          <ShellGate>
            <ErrorBoundary>{children}</ErrorBoundary>
          </ShellGate>
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
