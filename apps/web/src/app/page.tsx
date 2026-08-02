import type { JSX } from 'react';

export default function Home(): JSX.Element {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">RAG Extension API</h1>
        <p className="text-lg text-neutral-600 mb-8">
          AI-powered reply generation for X.com
        </p>
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">API Endpoint</h2>
          <code className="block bg-neutral-100 p-4 rounded text-sm text-neutral-900 break-words">
            POST /api/generate
          </code>
          <p className="text-sm text-neutral-600 mt-4">
            Send a tweet/post text and receive an AI-generated reply.
          </p>
        </div>
      </div>
    </main>
  );
}
