import type { Metadata } from 'next';
import type { JSX } from 'react';
import '@rag-extension/ui/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'RAG Extension API',
  description: 'AI-powered Chrome extension API for generating X.com replies',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
