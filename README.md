# AI Reply Composer

A production-ready Chrome extension with a Next.js backend that generates AI-powered replies for X.com (Twitter) posts using Groq and Gemini AI models.

## Overview

- **Chrome Extension (Manifest V3)**: Detects the active tweet being replied to, extracts its text, and inserts an AI-generated reply into X's compose box.
- **Next.js Backend**: Provides the `/api/generate` endpoint with Groq/Gemini fallback provider pattern.
- **Provider Pattern**: Pluggable AI provider abstraction (Groq primary, Gemini fallback, easy to add OpenAI/Claude/etc.).
- **Production-Grade**: Strict TypeScript, structured logging, typed errors, security-first architecture, comprehensive validation.

## Project Structure

```
├── apps/
│   ├── extension/          # Chrome Extension (Manifest V3, Vite + CRXJS)
│   └── web/                # Next.js App Router backend
├── packages/
│   ├── shared/             # Shared utilities, errors, logging, env
│   ├── api/                # Wire contracts, Zod schemas, isomorphic client
│   ├── ai/                 # AI provider abstraction, Groq/Gemini implementations
│   ├── ui/                 # Design tokens + React components
│   └── config/             # ESLint, Prettier, TypeScript, Tailwind configs
├── pnpm-workspace.yaml     # Monorepo root
├── turbo.json              # Turborepo task pipeline
└── .env.example            # Environment template
```

## Setup

### Prerequisites

- Node.js 22.x (required for `@google/genai` v3)
- pnpm 10.x
- Groq API key (free at https://console.groq.com)
- Gemini API key (free at https://ai.google.dev)

### Installation

```bash
# Clone the repository
git clone <repo>
cd rag-extension

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your API keys
# GROQ_API_KEY=...
# GEMINI_API_KEY=...
# ALLOWED_EXTENSION_ORIGINS=chrome-extension://<dev-id>,chrome-extension://<prod-id>

# Install dependencies
pnpm install

# Build all packages and apps
pnpm build
```

### Environment Variables

**Server-side (`.env.local`)**:
```bash
GROQ_API_KEY=<your-groq-key>
GEMINI_API_KEY=<your-gemini-key>
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_MODEL=gemini-3-flash
GROQ_TIMEOUT_MS=8000
GEMINI_TIMEOUT_MS=12000
MAX_POST_LENGTH=4000
MAX_PAYLOAD_BYTES=16384
REQUEST_TIMEOUT_MS=20000
ALLOWED_EXTENSION_ORIGINS=chrome-extension://<dev-id>,chrome-extension://<prod-id>
LOG_LEVEL=info
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Extension build-time (`.env` in `apps/extension/`)**:
```bash
VITE_API_BASE_URL=http://localhost:3000
```

## Development

### Start the Next.js backend

```bash
pnpm --filter @rag-extension/web dev
# Runs on http://localhost:3000
```

### Build the Chrome Extension

```bash
pnpm --filter @rag-extension/extension build
# Output: apps/extension/dist/
```

### Load into Chrome

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `apps/extension/dist/`
5. Visit x.com, open a reply box, click the extension icon

## API

### `POST /api/generate`

Generate an AI reply for a tweet/post.

**Request**:
```json
{
  "post": "The tweet text you're replying to (1-4000 chars)"
}
```

**Success Response** (200):
```json
{
  "reply": "An AI-generated reply under 280 characters"
}
```

**Error Response** (4xx/5xx):
```json
{
  "error": {
    "code": "VALIDATION_ERROR|INVALID_JSON|PAYLOAD_TOO_LARGE|ALL_PROVIDERS_FAILED|INTERNAL_ERROR",
    "message": "Human-readable error message",
    "requestId": "unique-request-id",
    "details": [
      { "path": "post", "message": "Field is required" }
    ]
  }
}
```

## Architecture Decisions

### Provider Pattern

The AI layer (`packages/ai`) defines an `AIProvider` interface:
```typescript
interface AIProvider {
  readonly name: string;
  readonly timeoutMs: number;
  generateReply(params: GenerateReplyParams, signal: AbortSignal): Promise<GenerateReplyOutput>;
}
```

- **Groq** (primary): 8-second timeout, Llama 3.3 70B
- **Gemini** (fallback): 12-second timeout, Gemini 3 Flash

On Groq timeout/rate-limit/network/unavailable, automatically falls back to Gemini. If both fail, returns `AllProvidersFailedError` (502).

**Adding a new provider**:
1. Create `packages/ai/providers/<name>-provider.ts` implementing `AIProvider`
2. Add one line to the array in `createProviderChain()`
3. No other changes needed

### Extension Architecture

Strict separation of concerns:
- **Content script**: DOM manipulation only (extract tweet, insert reply)
- **Background worker**: Network only (calls the backend API)
- **Popup**: UI orchestration and state management

Message-passing via `chrome.runtime.sendMessage` with typed message union.

### Security

- **No secrets on the client**: API keys never reach the extension. The background worker talks to the backend only.
- **CORS enforcement**: Middleware checks `Origin` header against `ALLOWED_EXTENSION_ORIGINS` allowlist.
- **Prompt injection guardrails**: User-provided tweet text is framed with HTML delimiters and escaped.
- **Validation**: All inputs validated with Zod at the API boundary.
- **Error handling**: Never leaks stack traces or sensitive data to the client.

## Testing

Run unit tests:
```bash
pnpm test
```

Covers:
- AI provider fallback/retry logic
- Zod schema validation
- HTTP client error handling
- Retry/timeout utilities
- Error classification

## Linting & Type Checking

```bash
pnpm lint      # ESLint with strict TS rules
pnpm type-check  # TypeScript full check
```

## Building for Production

### Next.js Backend (Vercel)

```bash
pnpm --filter @rag-extension/web build
```

Configuration:
- `runtime = 'nodejs'` (AI SDKs need Node, not Edge)
- `maxDuration = 25` seconds (Vercel Pro plan)
- Provider timeouts: Groq 8s + Gemini 12s (worst case ~20s)

**Vercel Deployment**:
1. Set root directory: `apps/web`
2. Build command: `pnpm turbo run build --filter=@rag-extension/web`
3. Set environment variables in project settings
4. Deploy

### Chrome Extension

```bash
pnpm --filter @rag-extension/extension build
```

Output: `apps/extension/dist/manifest.json` + bundled content/background scripts.

**Publishing**:
1. Create a developer account on Chrome Web Store
2. Upload `dist/` as a new extension
3. Submit for review
4. Update `ALLOWED_EXTENSION_ORIGINS` in backend `.env` with published extension ID

## Performance Considerations

- **Extension bundle size**: Vanilla TypeScript + DOM (no React), using CSS design tokens only → ~50KB total gzipped
- **Backend latency**: Provider timeouts (Groq 8s + Gemini 12s) with a 20s hard timeout for Vercel
- **Prompt length**: Max 4000 characters (tweet context) to bound token usage and latency
- **Structured logging**: JSON logs to stdout (Vercel captures as function logs) with request ID correlation

## Extensibility

The architecture is designed for seamless addition of:

- **Authentication**: Middleware plugin for JWT/OAuth
- **Rate limiting**: In-memory counter (pre-Redis placeholder)
- **Persistence**: Postgres backend for storing conversation history
- **Streaming**: Optional `generateReplyStream()` method on `AIProvider`
- **Multi-platform**: Already abstracted via `PlatformAdapter` (LinkedIn/Reddit/etc. support)
- **Tone/style selector**: Optional request fields + model parameter
- **Multiple suggestions**: Batch generation with model `n` parameter
- **New AI providers**: OpenAI, Claude, DeepSeek, Mistral, local LLMs (one file + one line in coordinator)

No refactoring required for any of these — all are additive.

## Troubleshooting

### Extension popup shows "Open a reply on X.com to use this extension"
- Ensure you're on x.com or twitter.com
- Click on a tweet to open the reply dialog
- X.com's DOM structure may have changed → check `src/content/dom/selectors.ts`

### "Request timeout" or "All providers failed"
- Check `GROQ_API_KEY` and `GEMINI_API_KEY` in `.env.local`
- Verify network connectivity
- Check backend logs: `pnpm --filter @rag-extension/web dev`

### "Invalid JSON" or "Validation error"
- Ensure request body is valid JSON
- Post text is 1-4000 characters
- No extra fields in the request

### Type errors during build
- Ensure all packages are built: `pnpm build`
- Check `tsconfig.base.json` for path aliases
- Run `pnpm type-check` for full TypeScript diagnostics

## Future Enhancements

- [ ] User authentication (OAuth with GitHub/Google)
- [ ] Conversation history (PostgreSQL + Drizzle ORM)
- [ ] Redis caching for rate limiting
- [ ] Streaming responses for real-time reply generation
- [ ] WebSocket support for live collaboration
- [ ] Multi-platform support (LinkedIn, Reddit, Threads)
- [ ] Advanced tone/style selector UI
- [ ] Model selector (switch between providers at runtime)
- [ ] Usage analytics dashboard

## License

MIT

## Contributing

Contributions welcome. Please ensure:
- Strict TypeScript (`no-any`, `no-non-null-assertions`)
- All public functions have JSDoc comments
- New features come with unit tests
- Follow the architecture seams for extensibility
