import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "Santa's ML Arena - GDG Christmas Special",
  description: 'A festive AI-powered pose battle experience where AI, motion, and fun collide.',
  keywords: ['GDG', 'Google Developer Groups', 'Machine Learning', 'AI', 'Christmas', 'Interactive Experience'],
  authors: [{ name: 'Google Developer Groups' }],
  applicationName: "Santa's ML Arena",
  category: 'technology',
  openGraph: {
    title: "Santa's ML Arena",
    description: 'Step into a Christmas playground where AI, motion, and fun collide.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: "Santa's ML Arena",
    description: 'A festive AI-powered pose battle experience for GDG events.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
