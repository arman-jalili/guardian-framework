# ADR-007: Test Strategy

**Status:** Accepted
**Date:** 2026-04-25
**Deciders:** arman-jalili

## Context

The framework must be reliable across platforms, Node.js versions, and project configurations. Traditional testing approaches (heavy mocking, extensive fixtures) can obscure real integration issues. The test strategy must balance confidence with maintainability.

## Decision

Use a **three-layer test strategy** with no external dependencies in tests:

### Layer 1: Unit Tests (fast, targeted)

- **What:** Individual functions and utilities in `src/lib/` (retry, manifest, export-mappings, templates, integrity, tracking, trust, code-filter, toml-filter, workflow-config)
- **Pattern:** Pure function inputs → outputs. No mocks unless interfacing with system APIs (fs, crypto).
- **Tools:** Bun test runner (built-in, no Vitest/Jest dependency)
- **Coverage target:** 90%+ for library code, 70%+ for command handlers
- **Tests:** `/Users/arman/project/guardian-framework/tests/`

### Layer 2: Integration Tests (guarded, real)

- **What:** Command lifecycle — init → generate → update → uninstall
- **Pattern:** Run `guardian-framework init` in a temp directory, verify file structure, run `generate`, verify exports, run `update --dryRun`, verify merge behavior, run `uninstall`, verify cleanup
- **Guard:** Skip on missing `GUARDIAN_INTEGRATION=1` env var or in CI without network (default: skip)
- **Tests:** `/Users/arman/project/guardian-framework/tests/integration/`

### Layer 3: E2E / Validator Tests (CI-only)

- **What:** Verify template rendering parity, export consistency, validator script behavior
- **Pattern:** Scaffold a project, render all templates, compare against known-good snapshots, run validators, verify exit codes
- **Guard:** Only runs in CI with `GUARDIAN_E2E=1`

### Testing Principles

1. **Zero external dependencies** in extension templates — verified by test (`templates.test.ts`: "pi extensions are self-contained")
2. **Deterministic rendering** — same template context always produces same output (hash-verified)
3. **No filesystem pollution** — tests use `Bun.spawnSync` in temp dirs or `mkdtemp`
4. **Atomic write verification** — test that partial writes don't produce corrupt output

### Key Test Files

| File | What it tests |
|------|---------------|
| `tests/templates.test.ts` | Template loading, placeholder rendering, extension self-containment |
| `tests/uninstall.test.ts` | Plan-based file removal, hash comparison, edge cases |
| Integration tests | Lifecycle: init → generate → update → uninstall |

## Consequences

**Positive:**
- Fast unit tests (sub-second) for immediate feedback during development
- Integration tests catch real filesystem/interaction bugs
- No external test framework dependencies
- Extensions are verifiably self-contained (no import leakage)

**Negative:**
- Integration tests require temp directory setup/teardown (slower)
- CI-only E2E tests mean local E2E requires manual CI invocation
- Template rendering tests need snapshot maintenance on template changes

**Mitigation:**
- Unit tests run on every save during development
- Integration tests run in CI and locally when explicitly enabled
- Snapshot tests are in committed test fixtures, auto-updated on `bun test -u`

