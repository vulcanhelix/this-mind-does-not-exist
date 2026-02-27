// ============================================================
// This Mind Does Not Exist — Root Layout
// ============================================================
// App Router root layout with dark theme, Inter font, and
// global navigation.
// ============================================================

import type { Metadata } from 'next';
// import { Inter } from 'next/font/google';
// import './globals.css';

// const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'This Mind Does Not Exist',
  description: 'Frontier reasoning that doesn\'t exist… until you run it locally.',
  keywords: ['AI', 'reasoning', 'local', 'open-source', 'debate', 'LLM'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        {/* TODO: Add navigation header */}
        {/* TODO: Add sidebar for traces */}
        <main>{children}</main>
        {/* TODO: Add footer */}
      </body>
    </html>
  );
}
