# TypeScript/JavaScript Code Patterns

> **Purpose:** Reusable TypeScript patterns for Guardian projects.
> **Generic:** Adapt for your framework (Node.js, Bun, etc.).

---

## Error Handling

```typescript
// Use custom error classes
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NetworkError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Result type pattern (never throw in library)
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function parseConfig(input: string): Result<Config, ValidationError> {
  try {
    const config = JSON.parse(input);
    return { ok: true, value: config };
  } catch (e) {
    return { ok: false, error: new ValidationError('Invalid JSON', 'config') };
  }
}
```

---

## Tracing / Logging

```typescript
// Structured logging
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

const logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date(),
      context
    }));
  },
  error: (message: string, error?: Error, context?: Record<string, unknown>) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      timestamp: new Date(),
      error: error?.message,
      stack: error?.stack,
      context
    }));
  }
};

// Usage
logger.info('Processing request', { userId, requestId });
```

---

## Cancellation / Cleanup

```typescript
// AbortController pattern
async function fetchWithTimeout(
  url: string,
  timeout: number,
  signal?: AbortSignal
): Promise<Response> {
  const abortController = new AbortController();

  // Link external signal
  if (signal) {
    signal.addEventListener('abort', () => abortController.abort());
  }

  // Timeout abort
  const timeoutId = setTimeout(() => abortController.abort(), timeout);

  try {
    const response = await fetch(url, { signal: abortController.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('Request cancelled');
    }
    throw e;
  }
}
```

---

## Atomic Writes

```typescript
// Write-rename pattern (Node.js/Bun)
import { writeFileSync, renameSync } from 'fs';
import { join } from 'path';

function atomicWrite(filePath: string, content: string): void {
  const tempPath = join(filePath + '.tmp');

  // Write to temp file
  writeFileSync(tempPath, content, 'utf-8');

  // Atomic rename
  renameSync(tempPath, filePath);
}

// Async version (Bun)
async function atomicWriteAsync(filePath: string, content: string): Promise<void> {
  const tempPath = filePath + '.tmp';
  await Bun.write(tempPath, content);
  await Bun.file(tempPath).rename(filePath);
}
```

---

## Async Patterns

```typescript
// Promise patterns
async function parallelTasks(): Promise<void> {
  // Run in parallel
  const [a, b, c] = await Promise.all([
    taskA(),
    taskB(),
    taskC()
  ]);
}

// Sequential with error handling
async function sequentialTasks(): Promise<void> {
  for (const task of tasks) {
    await task();
  }
}

// Concurrent limit
async function concurrentLimit(tasks: Task[], limit: number): Promise<void> {
  const executing = new Set<Promise<void>>();

  for (const task of tasks) {
    const p = task().then(() => executing.delete(p));
    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}
```

---

## Testing

```typescript
// Vitest (Bun-compatible)
import { describe, it, expect } from 'vitest';

describe('MyModule', () => {
  it('should parse correctly', () => {
    const result = parse('input');
    expect(result.ok).toBe(true);
  });

  it('should handle errors', async () => {
    const result = await riskyOperation();
    expect(result).rejects.toThrow();
  });
});

// Mock patterns
vi.mock('./dependency', () => ({
  fetch: vi.fn().mockResolvedValue({ data: 'mock' })
}));
```

---

## Anti-Patterns (NEVER DO)

```typescript
// ❌ Throwing in library code
function parse(input: string): Config {
  if (!input) throw new Error('No input');  // BAD
}

// ✅ Return Result type
function parse(input: string): Result<Config, ValidationError> {
  if (!input) return { ok: false, error: new ValidationError('No input') };
  return { ok: true, value: JSON.parse(input) };
}

// ❌ Unhandled promise rejection
async function bad() {
  fetch('/api').then(r => r.json());  // BAD - no catch
}

// ✅ Always handle errors
async function good() {
  try {
    const response = await fetch('/api');
    return await response.json();
  } catch (e) {
    logger.error('Fetch failed', e);
    return null;
  }
}

// ❌ Callback hell
function bad(callback: (err, result) => void) {
  step1((err1, r1) => {
    step2(r1, (err2, r2) => {
      step3(r2, callback);  // BAD
    });
  });
}

// ✅ Use async/await
async function good() {
  const r1 = await step1();
  const r2 = await step2(r1);
  return await step3(r2);
}
```

---

## Build Commands

```bash
# Build (Bun)
bun build ./src/index.ts --outdir ./dist

# Build (npm/ts)
npm run build

# Test (Bun)
bun test

# Test (Vitest)
vitest run

# Lint
biome check .          # Bun/Biome
eslint .               # npm

# Format
biome format . --write  # Bun/Biome
prettier --write .     # npm

# Type check
tsc --noEmit

# Security audit
bun audit              # Bun
npm audit              # npm
```

---

## Dependencies

```json
// package.json (Bun)
{
  "dependencies": {
    "@clack/prompts": "^0.7.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "vitest": "^1.0.0"
  }
}

// package.json (npm)
{
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```