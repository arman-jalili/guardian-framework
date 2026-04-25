# Code Patterns

> Code templates for reference. Agents read this to match patterns.
> **Language-specific patterns** are in `.pi/languages/{{LANGUAGE}}-patterns.md`.

## Error Handling

{{ERROR_HANDLING_SECTION}}

**Rule:** {{ERROR_HANDLING_RULE}}

## Tracing

{{TRACING_SECTION}}

**Rule:** {{TRACING_RULE}}

## Cancellation

{{CANCELLATION_SECTION}}

**Rule:** {{CANCELLATION_RULE}}

## Atomic Writes

{{ATOMIC_WRITE_SECTION}}

**Rule:** {{ATOMIC_WRITE_RULE}}

## Retry Logic

```{{LANGUAGE}}
// Exponential backoff: base_delay * 2^retry
// Jitter: ±25% to prevent thundering herd
// Max retries: 3
```

**Rule:** Max 3 retries. Exponential backoff with jitter.