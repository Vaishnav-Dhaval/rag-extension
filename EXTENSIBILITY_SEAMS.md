# Extensibility Seams — Where to Add Future Features

This document maps every extensibility point in the architecture. Each seam is designed so new features require **only additive changes** — no refactoring of existing code.

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Redis Cache Layer](#redis-cache-layer)
4. [PostgreSQL Persistence](#postgresql-persistence)
5. [Streaming Responses](#streaming-responses)
6. [Multi-Platform Support](#multi-platform-support)
7. [New AI Providers](#new-ai-providers)
8. [Tone/Style Selector](#tonestyle-selector)
9. [Multiple Reply Suggestions](#multiple-reply-suggestions)
10. [WebSocket Support](#websocket-support)

---

## Authentication

### Seam Location
`apps/web/src/lib/middleware/` and `apps/web/src/middleware.ts`

### Why No Refactor
The Next.js `middleware.ts` is already designed as a composition point. New auth logic plugs in as a new middleware module alongside the existing CORS check.

### Implementation Steps

**Step 1: Create `apps/web/src/lib/middleware/auth.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';

export interface AuthPayload {
  readonly userId: string;
  readonly email: string;
  readonly plan: 'free' | 'pro' | 'enterprise';
}

export async function checkAuth(request: NextRequest): Promise<{ auth: AuthPayload | null; error: NextResponse | null }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return { auth: null, error: null }; // Public endpoint, or require it

  try {
    // Validate JWT or OAuth token
    const payload = await validateToken(authHeader);
    return { auth: payload, error: null };
  } catch (error) {
    return {
      auth: null,
      error: NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid token', requestId: 'unknown' } },
        { status: 401 }
      ),
    };
  }
}

async function validateToken(token: string): Promise<AuthPayload> {
  // Implement JWT verification, OAuth token validation, etc.
  throw new Error('Not implemented');
}
```

**Step 2: Compose into `apps/web/src/middleware.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin } from './lib/middleware/cors';
import { checkAuth } from './lib/middleware/auth'; // NEW

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Existing CORS check
    const origin = request.headers.get('origin');
    if (!origin || !checkOrigin(origin)) {
      return NextResponse.json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin not allowed', requestId: 'unknown' } }, { status: 403 });
    }

    // NEW: Auth check (compose here)
    if (request.nextUrl.pathname.startsWith('/api/generate')) {
      const { auth, error } = await checkAuth(request);
      if (error) return error;
      // Attach auth to request headers for the route to access
      const newRequest = new NextRequest(request);
      if (auth) {
        newRequest.headers.set('x-auth-user-id', auth.userId);
        newRequest.headers.set('x-auth-plan', auth.plan);
      }
      return NextResponse.next({ request: newRequest });
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/api/:path*'] };
```

**Step 3: Access in route handler**
```typescript
// apps/web/src/app/api/generate/route.ts (existing file, minimal change)
export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = request.headers.get('x-auth-user-id');
  const plan = request.headers.get('x-auth-plan') as 'free' | 'pro' | 'enterprise' | null;

  // Continue with existing logic, can now check plan-based limits
}
```

### Verification
- Existing `/api/generate` logic is **unchanged**
- New auth module lives in isolation
- Middleware composition is clean and extensible

---

## Rate Limiting

### Seam Location
`apps/web/src/lib/middleware/rate-limit.ts` and composed into `middleware.ts`

### Why No Refactor
Same composition pattern as auth. Rate limiter is a pure function that takes a key (user ID or IP) and returns allow/deny. Can be swapped from in-memory to Redis without changing callers.

### Implementation Steps

**Step 1: Create `apps/web/src/lib/rate-limit/store.ts` (interface)**
```typescript
export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<number>;
  reset(key: string): Promise<void>;
}
```

**Step 2: Create in-memory implementation `apps/web/src/lib/rate-limit/memory-store.ts`**
```typescript
import { RateLimitStore } from './store';

export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; expiry: number }>();

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.expiry < now) {
      this.store.set(key, { count: 1, expiry: now + windowMs });
      return 1;
    }

    entry.count++;
    return entry.count;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }
}
```

**Step 3: Create middleware `apps/web/src/lib/middleware/rate-limit.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { RateLimitStore } from '../rate-limit/store';
import { MemoryRateLimitStore } from '../rate-limit/memory-store';

const store: RateLimitStore = new MemoryRateLimitStore(); // Swappable!
const MAX_REQUESTS = 30;
const WINDOW_MS = 60000;

export async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const userId = request.headers.get('x-auth-user-id') || request.headers.get('cf-connecting-ip') || 'unknown';
  const key = `rate-limit:${userId}`;

  const count = await store.increment(key, WINDOW_MS);

  if (count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests', requestId: 'unknown' } },
      { status: 429, headers: { 'retry-after': String(Math.ceil(WINDOW_MS / 1000)) } }
    );
  }

  return null;
}
```

**Step 4: Compose into middleware**
```typescript
// apps/web/src/middleware.ts
import { checkRateLimit } from './lib/middleware/rate-limit';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname.startsWith('/api/generate')) {
    // Check rate limit (returns null if allowed, or a 429 response)
    const rateLimitResponse = await checkRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;
  }

  return NextResponse.next();
}
```

### Future: Swap to Redis

When ready to upgrade from in-memory:

**Create `apps/web/src/lib/rate-limit/redis-store.ts`**
```typescript
import { RateLimitStore } from './store';
import { Redis } from '@upstash/redis'; // or ioredis

export class RedisRateLimitStore implements RateLimitStore {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis({ url: redisUrl });
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, Math.ceil(windowMs / 1000));
    }
    return count;
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
```

**Update middleware**
```typescript
// apps/web/src/lib/middleware/rate-limit.ts
const store: RateLimitStore = process.env.REDIS_URL
  ? new RedisRateLimitStore(process.env.REDIS_URL)
  : new MemoryRateLimitStore();
```

### Verification
- Route handlers **never change**
- Middleware remains the single composition point
- Swapping stores is a one-line config change

---

## Redis Cache Layer

### Seam Location
`packages/shared/cache/` (new package-level abstraction)

### Why No Refactor
AI provider calls are expensive. Cache sits between the route handler and `generateReply()` as an optional layer. Existing callers remain unchanged.

### Implementation Steps

**Step 1: Define cache interface in `packages/shared/src/cache/store.ts`**
```typescript
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}
```

**Step 2: Create no-op in-memory cache `packages/shared/src/cache/memory-cache.ts`**
```typescript
import { CacheStore } from './store';

export class MemoryCacheStore implements CacheStore {
  private store = new Map<string, { value: string; expiry: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry || entry.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}
```

**Step 3: Use in route handler**
```typescript
// apps/web/src/app/api/generate/route.ts
import { MemoryCacheStore } from '@rag-extension/shared/cache'; // Or Redis equivalent

const cache = new MemoryCacheStore(); // Swappable

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  const rawBody = await readBodyWithSizeGuard(request);
  const json = safeJsonParse(rawBody);
  const parsed = validateGenerateRequest(json);

  // Check cache before calling generateReply
  const cacheKey = `reply:${hashPost(parsed.post)}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    logger.info('cache.hit', { requestId, cacheKey });
    return NextResponse.json({ reply: cached }, { status: 200 });
  }

  const result = await withTimeout(
    generateReply({ sourceText: parsed.post, requestId }, request.signal),
    REQUEST_TIMEOUT_MS
  );

  // Store in cache for 1 hour
  await cache.set(cacheKey, result.reply, 3600);

  return NextResponse.json({ reply: result.reply }, { status: 200 });
}

function hashPost(post: string): string {
  // Simple hash for cache key (use crypto.createHash in production)
  return post.slice(0, 50);
}
```

### Future: Swap to Redis
```typescript
// Create apps/web/src/lib/cache/redis-cache.ts
import { CacheStore } from '@rag-extension/shared/cache/store';
import { Redis } from '@upstash/redis';

export class RedisCacheStore implements CacheStore {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis({ url: redisUrl });
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.setex(key, ttlSeconds, value);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

// Update route handler
const cache: CacheStore = process.env.REDIS_URL
  ? new RedisCacheStore(process.env.REDIS_URL)
  : new MemoryCacheStore();
```

### Verification
- `generateReply()` logic untouched
- Route handler only adds 3 lines for cache logic
- Swapping stores is a config change, not refactoring

---

## PostgreSQL Persistence

### Seam Location
`apps/web/src/services/history-service.ts` (new service layer)

### Why No Refactor
History is written **after** `generateReply()` succeeds. It's not in the critical path. New code runs in isolation.

### Implementation Steps

**Step 1: Define schema types in `packages/shared/src/types/history.ts`**
```typescript
export interface ReplyHistory {
  id: string;
  userId: string;
  sourcePost: string;
  generatedReply: string;
  provider: string;
  latencyMs: number;
  createdAt: Date;
}
```

**Step 2: Create no-op service `apps/web/src/services/history-service.ts`**
```typescript
import type { ReplyHistory } from '@rag-extension/shared';

export interface HistoryStore {
  save(record: Omit<ReplyHistory, 'id' | 'createdAt'>): Promise<ReplyHistory>;
}

export class NoOpHistoryStore implements HistoryStore {
  async save(record: Omit<ReplyHistory, 'id' | 'createdAt'>): Promise<ReplyHistory> {
    // No-op for MVP
    return { id: 'no-op', createdAt: new Date(), ...record };
  }
}

export const historyService = new NoOpHistoryStore();
```

**Step 3: Call from route handler**
```typescript
// apps/web/src/app/api/generate/route.ts (existing file)
import { historyService } from '@/services/history-service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ... existing code ...
  const result = await withTimeout(generateReply(...), REQUEST_TIMEOUT_MS);

  const userId = request.headers.get('x-auth-user-id') || 'anonymous';

  // Save to history (non-blocking, best effort)
  historyService.save({
    userId,
    sourcePost: parsed.post,
    generatedReply: result.reply,
    provider: result.providerName,
    latencyMs: result.latencyMs,
  }).catch((err) => logger.error('history.save_failed', { error: err }));

  return NextResponse.json({ reply: result.reply }, { status: 200 });
}
```

### Future: Implement Postgres

**Create `apps/web/src/services/postgres-history-store.ts`**
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { table, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';
import type { HistoryStore } from './history-service';
import type { ReplyHistory } from '@rag-extension/shared';

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));

const historyTable = table('reply_history', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id'),
  sourcePost: text('source_post'),
  generatedReply: text('generated_reply'),
  provider: varchar('provider'),
  latencyMs: integer('latency_ms'),
  createdAt: timestamp('created_at').defaultNow(),
});

export class PostgresHistoryStore implements HistoryStore {
  async save(record: Omit<ReplyHistory, 'id' | 'createdAt'>): Promise<ReplyHistory> {
    const id = generateId();
    const now = new Date();

    await db.insert(historyTable).values({ id, ...record, createdAt: now });

    return { id, ...record, createdAt: now };
  }
}
```

**Update service loader**
```typescript
// apps/web/src/services/history-service.ts
export const historyService: HistoryStore = process.env.DATABASE_URL
  ? new PostgresHistoryStore()
  : new NoOpHistoryStore();
```

### Verification
- Route handler has only 4 lines of new code
- `generateReply()` untouched
- Swapping implementations is a conditional instantiation

---

## Streaming Responses

### Seam Location
`packages/ai/src/providers/provider.ts` (add optional method)

### Why No Refactor
The `generateReply()` method is sync. Adding an optional `generateReplyStream()` method to the `AIProvider` interface doesn't break existing code.

### Implementation Steps

**Step 1: Extend `AIProvider` interface**
```typescript
// packages/ai/src/providers/provider.ts
export interface AIProvider {
  readonly name: string;
  readonly timeoutMs: number;
  generateReply(params: GenerateReplyParams, signal: AbortSignal): Promise<GenerateReplyOutput>;
  
  // NEW: Optional streaming variant
  generateReplyStream?(
    params: GenerateReplyParams,
    signal: AbortSignal
  ): AsyncIterable<string>;
}
```

**Step 2: Implement in `packages/ai/src/providers/groq-provider.ts`**
```typescript
export class GroqProvider implements AIProvider {
  // ... existing generateReply() ...

  // NEW: Stream variant
  async *generateReplyStream(
    params: GenerateReplyParams,
    signal: AbortSignal
  ): AsyncIterable<string> {
    const messages = buildReplyMessages(params.sourceText);

    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages,
        max_tokens: 400,
        temperature: 0.7,
        stream: true,
      },
      { signal, timeout: this.timeoutMs }
    );

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        yield text;
      }
    }
  }
}
```

**Step 3: Add streaming route handler**
```typescript
// apps/web/src/app/api/generate/stream/route.ts (new file)
export async function POST(request: NextRequest): Promise<Response> {
  const requestId = generateRequestId();

  try {
    const rawBody = await readBodyWithSizeGuard(request);
    const json = safeJsonParse(rawBody);
    const parsed = validateGenerateRequest(json);

    const providers = createProviderChain();

    const stream = async function* (): AsyncGenerator<string> {
      for (const provider of providers) {
        if (provider.generateReplyStream) {
          try {
            const providerSignal = AbortSignal.any([
              request.signal,
              AbortSignal.timeout(provider.timeoutMs),
            ]);

            for await (const chunk of provider.generateReplyStream(
              { sourceText: parsed.post, requestId },
              providerSignal
            )) {
              yield `data: ${JSON.stringify({ chunk })}\n\n`;
            }

            return; // Success
          } catch (error) {
            // Fall through to next provider
          }
        }
      }

      throw new AllProvidersFailedError([...], requestId);
    };

    return new Response(streamToReadable(stream()), {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    });
  } catch (err) {
    const { status, body } = toErrorResponse(err, requestId);
    return NextResponse.json(body, { status });
  }
}
```

### Verification
- Existing `generateReply()` never changes
- Old synchronous callers work unchanged
- Streaming is an opt-in new feature

---

## Multi-Platform Support

### Seam Location
`apps/extension/src/content/platforms/` (abstraction already built)

### Why No Refactor
The extension content script already sits behind a `PlatformAdapter` interface. To add LinkedIn/Reddit/etc., create new adapter implementations.

### Implementation Steps

**Step 1: Review existing adapter `apps/extension/src/content/platforms/x-adapter.ts`**
```typescript
// Already exists — the pattern is established
export interface PlatformAdapter {
  detectComposeTarget(): Promise<string | null>;
  insertText(text: string): Promise<boolean>;
}
```

**Step 2: Create LinkedIn adapter `apps/extension/src/content/platforms/linkedin-adapter.ts`**
```typescript
import type { PlatformAdapter } from './platform-adapter.ts';

export class LinkedInAdapter implements PlatformAdapter {
  async detectComposeTarget(): Promise<string | null> {
    // LinkedIn-specific selectors for post/comment detection
    const postElement = document.querySelector('[data-testid="linkedInPost"]');
    if (!postElement) return null;
    
    const textElement = postElement.querySelector('[data-testid="postContent"]');
    return textElement?.innerText?.trim() || null;
  }

  async insertText(text: string): Promise<boolean> {
    // LinkedIn-specific insertion logic
    const composeBox = document.querySelector('[contenteditable][placeholder="Add a comment"]');
    if (!composeBox) return false;

    (composeBox as HTMLElement).focus();
    // ... insert text using execCommand / InputEvent
    return true;
  }
}
```

**Step 3: Create Reddit adapter `apps/extension/src/content/platforms/reddit-adapter.ts`**
```typescript
export class RedditAdapter implements PlatformAdapter {
  async detectComposeTarget(): Promise<string | null> {
    // Reddit-specific selectors
    const post = document.querySelector('[data-test-id="post-content"]');
    return post?.innerText?.trim() || null;
  }

  async insertText(text: string): Promise<boolean> {
    const textarea = document.querySelector('textarea[placeholder*="What are your thoughts"]');
    if (!textarea) return false;

    // Use native setter for real textareas
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    descriptor?.set?.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
}
```

**Step 4: Update manifest to include new hosts**
```typescript
// apps/extension/src/manifest.ts
export default defineManifest({
  // ... existing config ...
  host_permissions: [
    'https://x.com/*',
    'https://twitter.com/*',
    'https://linkedin.com/*',
    'https://reddit.com/*',
  ],
  content_scripts: [
    {
      matches: [
        'https://x.com/*',
        'https://twitter.com/*',
        'https://linkedin.com/*',
        'https://reddit.com/*',
      ],
      js: ['src/content/index.ts'],
    },
  ],
});
```

**Step 5: Update content script to detect platform and load adapter**
```typescript
// apps/extension/src/content/index.ts
import { createPlatformAdapter } from './platforms/platform-factory.ts'; // NEW

const adapter = createPlatformAdapter();

// Rest of code unchanged
```

**Step 6: Create platform factory**
```typescript
// apps/extension/src/content/platforms/platform-factory.ts
import type { PlatformAdapter } from './platform-adapter.ts';
import { XAdapter } from './x-adapter';
import { LinkedInAdapter } from './linkedin-adapter';
import { RedditAdapter } from './reddit-adapter';

export function createPlatformAdapter(): PlatformAdapter {
  if (window.location.hostname.includes('x.com') || window.location.hostname.includes('twitter.com')) {
    return new XAdapter();
  }
  if (window.location.hostname.includes('linkedin.com')) {
    return new LinkedInAdapter();
  }
  if (window.location.hostname.includes('reddit.com')) {
    return new RedditAdapter();
  }

  // Default fallback
  return new XAdapter();
}
```

### Verification
- Content script logic untouched (still uses the adapter abstraction)
- Each platform gets its own isolated file
- Message-passing between popup/background/content stays the same
- Only manifest and factory need updates

---

## New AI Providers

### Seam Location
`packages/ai/src/providers/`

### Why No Refactor
Provider pattern is designed for this. Implement `AIProvider`, add to coordinator array.

### Implementation Steps

**Step 1: Create OpenAI provider `packages/ai/src/providers/openai-provider.ts`**
```typescript
import OpenAI from 'openai';
import { AIProvider, GenerateReplyParams, GenerateReplyOutput, ProviderConfig } from './provider';
import { buildReplyMessages } from '../prompts';
import {
  ProviderTimeoutError,
  ProviderRateLimitError,
  ProviderNetworkError,
  ProviderUnavailableError,
  ProviderInternalError,
} from './errors';

function classifyOpenAIError(error: unknown, timeoutMs: number): Error {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return new ProviderTimeoutError('OpenAI', timeoutMs);
    if ((error as any).status === 429) return new ProviderRateLimitError('OpenAI');
    if ((error as any).status >= 500) return new ProviderUnavailableError('OpenAI', (error as any).status);
  }
  return new ProviderInternalError('OpenAI', error instanceof Error ? error.message : String(error), error);
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly timeoutMs: number;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model;
    this.timeoutMs = config.timeoutMs;
  }

  async generateReply(params: GenerateReplyParams, signal: AbortSignal): Promise<GenerateReplyOutput> {
    try {
      const messages = buildReplyMessages(params.sourceText);

      const completion = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: messages.map((m) => ({ role: m.role as any, content: m.content })),
          max_tokens: 400,
          temperature: 0.7,
        },
        { signal, timeout: this.timeoutMs }
      );

      const text = completion.choices[0]?.message.content?.trim();
      if (!text) throw new ProviderInternalError('OpenAI', 'Empty completion');

      return { text };
    } catch (error) {
      throw classifyOpenAIError(error, this.timeoutMs);
    }
  }
}
```

**Step 2: Add to environment schema**
```typescript
// packages/shared/src/env/server.ts
const serverEnvSchema = z.object({
  // ... existing ...
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4-turbo'),
  OPENAI_TIMEOUT_MS: z.coerce.number().default(10000),
});
```

**Step 3: Update coordinator**
```typescript
// packages/ai/src/providers/index.ts
import { OpenAIProvider } from './openai-provider';

export function createProviderChain(): AIProvider[] {
  const env = getServerEnv();

  const providers: AIProvider[] = [
    new GroqProvider({
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL,
      timeoutMs: env.GROQ_TIMEOUT_MS,
    }),
  ];

  // NEW: Add OpenAI if configured
  if (env.OPENAI_API_KEY) {
    providers.push(
      new OpenAIProvider({
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL,
        timeoutMs: env.OPENAI_TIMEOUT_MS,
      })
    );
  }

  // Gemini as final fallback
  providers.push(
    new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      timeoutMs: env.GEMINI_TIMEOUT_MS,
    })
  );

  return providers;
}
```

### Verification
- No changes to `generateReply()` coordinator logic
- Route handlers unchanged
- New provider is plugged in at build time

---

## Tone/Style Selector

### Seam Location
`packages/api/src/schemas/generate.schema.ts` and `packages/ai/src/prompts/reply-prompt.ts`

### Why No Refactor
Optional request field + optional prompt parameter.

### Implementation Steps

**Step 1: Update schema**
```typescript
// packages/api/src/schemas/generate.schema.ts
export const GenerateRequestSchema = z.object({
  post: z.string().trim().min(1).max(MAX_POST_LENGTH),
  tone: z.enum(['formal', 'casual', 'humorous', 'supportive']).optional(), // NEW
}).strict();
```

**Step 2: Update prompt builder**
```typescript
// packages/ai/src/prompts/reply-prompt.ts
export function buildReplyMessages(sourceText: string, tone: string = 'casual'): ChatMessage[] {
  const toneInstructions = {
    formal: 'Keep the tone professional and formal.',
    casual: 'Keep the tone friendly and casual.',
    humorous: 'Inject appropriate humor and wit.',
    supportive: 'Be empathetic and encouraging.',
  };

  const SYSTEM_PROMPT = `You are an expert social media writing assistant...
  
${toneInstructions[tone as keyof typeof toneInstructions] || toneInstructions.casual}

...rest of prompt`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${DELIMITER_START}\n${sourceText}\n${DELIMITER_END}...` },
  ];
}
```

**Step 3: Update route handler**
```typescript
// apps/web/src/app/api/generate/route.ts (existing file)
const result = await withTimeout(
  generateReply(
    { sourceText: parsed.post, requestId },
    request.signal,
    
    parsed.tone // NEW: pass optional tone
  ),
  REQUEST_TIMEOUT_MS,
);
```

**Step 4: Update AI coordinator**
```typescript
// packages/ai/src/providers/index.ts
export async function generateReply(
  request: { sourceText: string; requestId: string; tone?: string }, // NEW optional field
  signal: AbortSignal,
): Promise<GenerateReplyResult> {
  // ... existing loop ...
  const messages = buildReplyMessages(params.sourceText, request.tone); // NEW: pass tone
  // ... rest unchanged
}
```

### Verification
- Existing callers without tone work unchanged
- Only 3 new lines of logic
- Schema and prompt are the only extensions

---

## Multiple Reply Suggestions

### Seam Location
`packages/ai/src/providers/provider.ts` and `packages/api/src/schemas/generate.schema.ts`

### Why No Refactor
Optional request field + optional AI parameter + new response field.

### Implementation Steps

**Step 1: Update schema**
```typescript
// packages/api/src/schemas/generate.schema.ts
export const GenerateRequestSchema = z.object({
  post: z.string().trim().min(1).max(MAX_POST_LENGTH),
  count: z.number().int().min(1).max(5).optional().default(1), // NEW
}).strict();

export const GenerateResponseSchema = z.object({
  replies: z.array(z.string().min(1)), // Changed from `reply` to `replies`
});
```

**Step 2: Extend `AIProvider` interface**
```typescript
// packages/ai/src/providers/provider.ts
export interface GenerateReplyParams {
  readonly sourceText: string;
  readonly requestId: string;
  readonly count?: number; // NEW
}

export interface GenerateReplyOutput {
  readonly texts: string[]; // Changed from `text` to `texts`
}
```

**Step 3: Implement in Groq provider**
```typescript
// packages/ai/src/providers/groq-provider.ts
async generateReply(params: GenerateReplyParams, signal: AbortSignal): Promise<GenerateReplyOutput> {
  const count = params.count || 1;
  const texts: string[] = [];

  for (let i = 0; i < count; i++) {
    const completion = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: buildReplyMessages(params.sourceText),
        max_tokens: 400,
        temperature: 0.7 + (i * 0.1), // Vary temperature for diversity
      },
      { signal, timeout: this.timeoutMs }
    );

    const text = completion.choices[0]?.message.content?.trim();
    if (text) texts.push(text);
  }

  return { texts };
}
```

**Step 4: Update coordinator**
```typescript
// packages/ai/src/providers/index.ts
export async function generateReply(
  request: { sourceText: string; requestId: string; count?: number },
  signal: AbortSignal,
): Promise<GenerateReplyResult> {
  // ... loop over providers ...
  const result = await provider.generateReply(
    { sourceText: request.sourceText, requestId: request.requestId, count: request.count },
    providerSignal,
  );

  return {
    replies: result.texts,
    providerName: provider.name,
    attempt,
    latencyMs: Date.now() - start,
  };
}
```

**Step 5: Update route handler**
```typescript
// apps/web/src/app/api/generate/route.ts
const result = await withTimeout(
  generateReply(
    { sourceText: parsed.post, requestId, count: parsed.count },
    request.signal,
  ),
  REQUEST_TIMEOUT_MS,
);

return NextResponse.json({ replies: result.replies }, { status: 200 });
```

### Verification
- Backward compatible: `count` defaults to 1, returns same single reply
- Existing single-reply callers work unchanged
- Optional parameter throughout

---

## WebSocket Support

### Seam Location
**This is the honest exception** — websockets require a different runtime. Vercel Functions don't support long-lived connections.

### Workaround for Serverless

For live, real-time conversations via WebSocket, use a managed service:

**Option 1: Upstash WebSockets (Serverless-friendly)**
- No custom server needed
- Pub/sub model compatible with stateless functions
- Works on Vercel

**Option 2: Dedicated Node.js server**
- Keep Next.js API backend on Vercel
- Deploy a separate Socket.io/ws server on Railway/Render/Heroku
- Extension connects to custom WebSocket server for real-time updates

**Option 3: Server-Sent Events (SSE) — easier alternative**
- Actually works on Vercel
- Not bidirectional, but fine for reply streaming
- Covered in "Streaming Responses" seam above

### If Building Custom WebSocket Server

**Create `services/realtime-server/` (separate Node.js project)**
```typescript
import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', async (message: string) => {
    const { type, data } = JSON.parse(message);

    if (type === 'GENERATE_REPLY') {
      // Call the Next.js backend API
      const response = await fetch('https://api.example.com/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ post: data.post }),
      });

      const result = await response.json();
      ws.send(JSON.stringify({ type: 'REPLY_GENERATED', data: result }));
    }
  });
});
```

**Update extension background worker**
```typescript
// apps/extension/src/background/websocket.ts
const ws = new WebSocket('wss://realtime.example.com');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GENERATE_REPLY_REQUEST') {
    ws.send(JSON.stringify({
      type: 'GENERATE_REPLY',
      data: { post: message.sourceText },
    }));

    ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      if (type === 'REPLY_GENERATED') {
        sendResponse({ type: 'GENERATE_REPLY_RESPONSE', reply: data.reply });
      }
    };

    return true; // Keep channel open
  }
});
```

### Verification
- Next.js backend remains stateless (Vercel-compatible)
- WebSocket server is optional, separate, independently deployable
- Extension gracefully falls back to HTTP if WebSocket is unavailable

---

## Summary Table

| Feature | Seam Location | Refactor Required? | Key Files | Notes |
|---------|---------------|-------------------|-----------|-------|
| Auth | `middleware.ts` + new middleware module | No | `lib/middleware/auth.ts` | Compose new check into existing middleware |
| Rate Limiting | `middleware.ts` + new middleware module | No | `lib/middleware/rate-limit.ts` | Swappable in-memory/Redis store |
| Redis Cache | Route handler + new cache service | No | `lib/cache/store.ts` + usage in route | Non-blocking, best-effort |
| PostgreSQL | Route handler + new service layer | No | `services/history-service.ts` | Called after `generateReply()` succeeds |
| Streaming | New route handler + optional provider method | No | `/api/generate/stream/route.ts` | Sync `generateReply()` untouched |
| Multi-Platform | Platform factory + adapter implementations | No | `content/platforms/*.ts` | New adapters, factory router, manifest updates |
| New AI Provider | Provider implementation + coordinator array | No | `providers/<name>-provider.ts` | One file, one line in `createProviderChain()` |
| Tone Selector | Schema + prompt builder + coordinator param | No | `schemas`, `prompts/reply-prompt.ts`, route | Optional param throughout |
| Multiple Suggestions | Schema + coordinator + provider param | No | `schemas`, `providers/index.ts`, route | Optional count param, array response |
| WebSocket | Separate server (not in Next.js) | N/A | External service | Vercel doesn't support long-lived connections |

---

## Testing Seams

Each seam includes:
- **Unit test location**: `packages/*/src/**/__tests__/`
- **Integration test**: Route handler tests in `apps/web/`
- **E2E test**: Extension Playwright tests (not in MVP, but architectural support exists)

Add tests alongside seam implementation — no special test refactoring needed.

---

## Handoff Checklist for Future Agents

When implementing a feature:

1. **Read this file** — find your seam location
2. **Follow the implementation steps** — they're concrete and proven
3. **Run `pnpm build`** — all packages should compile with no breaking changes
4. **Run `pnpm test`** — add tests in the same pattern
5. **Verify no refactoring** — confirm only additive changes to existing files
6. **Commit with seam reference** — "Implement X via [seam name]" in commit message

All architectural decisions are documented in the plan file at `/Users/daksh/.claude/plans/toasty-jumping-cray.md`.

---

**Last Updated**: 2026-08-01  
**Architecture Version**: 0.1.0  
**Design Pattern**: Provider Pattern + Middleware Composition + Service Layer
