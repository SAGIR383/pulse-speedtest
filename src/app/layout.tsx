import type { Metadata, Viewport } from 'next';
import { Sora, Manrope, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import ServiceWorkerRegister from '@/components/layout/ServiceWorkerRegister';

// Distinctive display + refined body + mono for metrics. No Inter/Roboto.
const display = Sora({ subsets: ['latin'], weight: ['300', '400', '600'], variable: '--font-display' });
const body = Manrope({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Pulse — Network Intelligence',
  description:
    'A futuristic AI-powered network intelligence platform. Real browser-based speed testing with cinematic visuals, intelligent diagnostics, and live maps.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pulse',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#05060a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-sans antialiased grain min-h-screen relative overflow-x-hidden">
        <div className="ambient-mesh" />
        <div className="relative z-10">{children}</div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
