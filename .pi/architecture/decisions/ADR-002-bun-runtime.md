# ADR-002: Bun Runtime

**Status:** Accepted
**Date:** 2026-04-25
**Deciders:** arman-jalili

## Context

The CLI needs a runtime for TypeScript execution. Options include Node.js (standard), Deno (secure-by-default), and Bun (fast, TypeScript-native). Key requirements: fast startup times (sub-second for CLI responsiveness), native TypeScript without a build step during development, and npm ecosystem compatibility for publishing.

## Decision

Use **Bun** as the primary runtime and build target.

### Rationale

1. **Startup speed** — Bun's ~30ms cold start vs Node's ~300ms matters for a CLI tool that users run interactively
2. **Native TypeScript** — no `tsc` compilation step during development; Bun runs `.ts` directly
3. **Bun test** — built-in test runner compatible with Jest/Vitest expectations, zero-config
4. **npm compatibility** — `bunx` replaces `npx`, `bun install` replaces `npm install`, publishable to npm
5. **Bun.file()** — first-class file I/O that simplifies template loading (no manual `fs.readFile` + encoding juggling)

### What this means for development

```bash
bun build ./src/index.ts --outdir ./dist   # Production build (npm-compatible)
bun test                                    # Run tests
bun run src/index.ts                        # Development run
```

## Consequences

**Positive:**
- Fast iteration cycle (no compile step)
- Single tool for runtime, test, package management
- Smaller `node_modules` footprint
- Future Bun features (bundler, package manager) reduce dependencies

**Negative:**
- Falls back to Node.js for npm distribution (build step compiles to JS)
- Some npm packages may have Bun-specific edge cases
- Team members need Bun installed

**Mitigation:**
- Build target generates Node-compatible JS (`--target=bun` flag in builds)
- CI runs tests in both Bun and Node environments
- Documented in CONTRIBUTING.md

