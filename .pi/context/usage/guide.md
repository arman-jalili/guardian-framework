# Guardian — Practical Guide

**Version:** 2.2
**Audience:** Developers who want to use Guardian in a real project

---

## Table of Contents

1. [Install & Scaffold](#1-install--scaffold)
2. [Define Your Architecture](#2-define-your-architecture)
3. [Configure Your Project](#3-configure-your-project)
4. [Work on a Feature](#4-work-on-a-feature)
5. [Validate & Ship](#5-validate--ship)
6. [Maintain & Update](#6-maintain--update)
7. [Advanced: RTK Validators](#7-advanced-rtk-validators)
8. [Advanced: Terax Patterns](#8-advanced-terax-patterns)
9. [Real-World Example](#9-real-world-example)

---

## 1. Install & Scaffold

### 1.1 Scaffold your project

```bash
cd your-project
npx guardian-framework init
```

You'll get interactive prompts:

```
│  Welcome to Guardian
│
◆  Select AI tools:
│  ● pi (Full features: extensions, skills)
│  ○ claude (Static export)
│  ○ opencode (Static export)
│  ○ agents (Static export)
└
◆  Select language:
│  ● TypeScript
│  ○ Rust
│  ○ Python
│  ○ Go
└
◆  Select validators (CI always included):
│  ● ci
│  ○ tests
│  ○ security
│  ○ operations
│  ○ architecture
│  ○ integration
└
```

### 1.2 What you get

```
your-project/
├── .pi/                          ← Source of truth
│   ├── agent/AGENTS.md           ← Your project context
│   ├── architecture/             ← Module docs, ADRs, diagrams
│   ├── context/                  ← Shared knowledge
│   ├── skills/                   ← Agent definitions
│   ├── prompts/                  ← Workflow templates
│   ├── scripts/                  ← Validator shell scripts
│   ├── extensions/               ← pi TypeScript extensions
│   └── validators/               ← TOML declarative validators
├── .agents/skills/               ← pi skill exports
└── guardian-manifest.json        ← State tracking
```

### 1.3 First edit: customize AGENTS.md

Open `.pi/agent/AGENTS.md` and replace placeholders:

```yaml
---
# Keep the front-matter — it's runtime config
agent:
  max_turns: 20
---

# Project Context

## Project Overview

- **Name:** My API Server
- **Language:** TypeScript
- **Type:** REST API
- **Repository:** myorg/my-api

## Core Principles

1. **Zero-trust auth** — every endpoint validates tokens
2. **Typed errors** — Result<T, E> pattern, never throw
3. **Structured logging** — JSON with request IDs
4. **Atomic writes** — temp file + rename for all mutations
5. **No secrets in code** — env vars only, validated at startup
```

---

## 2. Define Your Architecture

### 2.1 Create module docs

Each module in your system gets a file in `.pi/architecture/modules/`:

```bash
mkdir -p .pi/architecture/modules
```

Create `.pi/architecture/modules/auth.md`:

```markdown
# Auth Module Architecture

## Overview
Handles user authentication via JWT tokens with refresh token rotation.
Supports OAuth2 providers (Google, GitHub) and email/password.

## Components
| Component | File | Purpose |
|-----------|------|---------|
| `TokenService` | `src/auth/token-service.ts` | Issue, verify, rotate tokens |
| `AuthMiddleware` | `src/auth/middleware.ts` | Validate tokens on each request |
| `OAuthHandler` | `src/auth/oauth-handler.ts` | OAuth2 callback flow |
| `PasswordHasher` | `src/auth/password-hasher.ts` | bcrypt with argon2 fallback |

## Data Flow
```
Request → AuthMiddleware → TokenService.verify() → attach user to context → handler
                                                         ↓
                                              invalid? → 401 Unauthorized
```

## Dependencies
- Depends on: `config` (JWT secret), `db` (user lookup), `logger`
- Used by: all HTTP handlers, WebSocket connections

## Security Considerations
- JWT secret loaded from `JWT_SECRET` env var — validated at startup
- Refresh tokens rotated on every use (single-use, stored in DB)
- Rate limiting: 5 failed attempts per IP per minute
- Password hashing: bcrypt cost 12, argon2id cost 2

## Testing Requirements
- Unit: token issuance, verification, rotation, expiry
- Integration: OAuth2 flow with mock provider
- E2E: full login → access → refresh → logout cycle
```

Create `.pi/architecture/modules/api.md`:

```markdown
# API Module Architecture

## Overview
REST API router with OpenAPI schema generation and request validation.

## Components
| Component | File | Purpose |
|-----------|------|---------|
| `Router` | `src/api/router.ts` | Route definitions, middleware chain |
| `Validator` | `src/api/validator.ts` | Zod-based request validation |
| `ErrorHandler` | `src/api/error-handler.ts` | Unified error responses |
| `OpenAPI` | `src/api/openapi.ts` | Schema generation from Zod |

## Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "email is required",
    "details": [{ "field": "email", "issue": "required" }],
    "request_id": "req_abc123"
  }
}
```
```

### 2.2 Register ADRs (Architecture Decision Records)

Create `.pi/architecture/decisions/ADR-001-jwt-strategy.md`:

```markdown
# ADR-001: JWT Authentication Strategy

**Date:** 2026-05-14
**Status:** Accepted

## Context
We need stateless authentication for our microservices. Options:
- Session cookies (requires sticky sessions)
- JWT (stateless, widely supported)
- API keys (no user context)

## Decision
Use JWT with short-lived access tokens (15 min) and long-lived refresh tokens (30 days).
Access tokens are stateless; refresh tokens are stored in DB for revocation.

## Consequences
- ✅ Horizontal scaling without session sync
- ✅ Token verification is O(1)
- ⚠️ Access tokens can't be revoked until expiry (15 min window)
- ⚠️ Refresh token rotation adds DB write per request
```

### 2.3 Update the architecture CHANGELOG

Add to `.pi/architecture/CHANGELOG.md`:

```markdown
## 2026-05-14 - Initial Architecture

### Added
- Auth module: JWT + OAuth2 + password hashing
- API module: REST router with Zod validation
- ADR-001: JWT strategy decision
```

### 2.4 Link implementation to architecture

Every implementation file gets a canonical reference:

```typescript
/**
 * Canonical Reference: .pi/architecture/modules/auth.md#token-service
 * Implements: Token issuance, verification, rotation
 * ADR: ADR-001
 * Last Sync: 2026-05-14
 */
```

This enables `validate-canonical.sh` to check that all code traces back to architecture docs.

---

## 3. Configure Your Project

### 3.1 Select validators

Edit `.pi/agent/AGENTS.md` front matter:

```yaml
validate:
  fail_fast: false        # Run all validators, don't stop on first failure
  timeout_ms: 300000      # 5 min per validator
```

Or run interactively:

```bash
npx guardian-framework init  # re-run to change validator selection
```

### 3.2 Configure TOML validators (RTK pattern)

Create `.pi/validators/custom.toml`:

```toml
schema_version = 1

[filters.custom-lint]
command = "lint"
description = "Filter lint output to show errors only"
strip_ansi = true
keep_lines_matching = ["error", "Error", "✗", "failed"]
max_lines = 50
on_empty = "✅ No lint errors"

[[tests.custom-lint]]
name = "shows only errors"
input = "warning: unused var\nerror: type mismatch\ninfo: 123 files scanned"
expected = "error: type mismatch"
```

Trust it (first run requires review):

```bash
npx guardian-framework trust .pi/validators/custom.toml
```

Verify inline tests pass:

```bash
npx guardian-framework validate --verify
```

### 3.3 Customize validation scripts

Edit `.pi/scripts/validate-ci.sh` with your actual commands:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Building ==="
bun build ./src/index.ts --outdir ./dist

echo "=== Testing ==="
bun test

echo "=== Linting ==="
biome check .

echo "=== Security Audit ==="
bun audit
```

---

## 4. Work on a Feature

### 4.1 Start a session with an AI agent

Open pi (or Claude Code, or your tool of choice). The agent loads:

1. `.pi/agent/AGENTS.md` — project context (once)
2. `.pi/skills/` — skills loaded on-demand
3. `.pi/architecture/modules/*.md` — architecture docs (reference)
4. `.pi/context/patterns.md` — language patterns

### 4.2 Use slash commands

```
/init              — Scan workspace, generate project memory
/plan              — Toggle plan mode (queue edits for review)
/plan off          — Exit plan mode
/validate          — Run all validators
/scope add login   — Classify task scope
/snippet list      — List available snippet tokens
/sessions          — List conversation sessions
```

### 4.3 Use snippet tokens

Instead of loading full skill files, reference snippets:

```
#security-review — check the auth module for vulnerabilities
#test-first — implement with TDD
#no-comments — don't add comments unless WHY is non-obvious
```

These expand to XML blocks prepended to your message — 70-90% token savings.

### 4.4 Use subagents for research

When exploring large codebases, delegate to subagents:

```
run_subagent:
  type: explore
  prompt: "Trace the auth flow from middleware → token verification → user lookup"

run_subagent:
  type: code-review
  prompt: "Review src/auth/token-service.ts for correctness and edge cases"

run_subagent:
  type: security-review
  prompt: "Check auth module for injection, auth bypass, secret leakage"
```

Subagents get **read-only tools only** and a **fresh context** — they can't pollute your main session.

### 4.5 Work in plan mode for complex changes

```
/plan on
```

Now all file mutations are **queued** instead of executing. The agent reads, researches, and proposes changes. When done:

```
/plan-apply
```

Review all changes as a batch diff, accept or reject.

### 4.6 File change tracking

The `filechanges.ts` extension tracks all modifications:

```
/filechanges         — Review all changes
/filechanges-accept  — Keep all changes
/filechanges-decline — Revert all changes
```

### 4.7 Use read-only mode for safe exploration

```
/read-only on
```

Now only read/grep/find/ls commands are allowed. Safe for codebase exploration without risk of accidental mutations.

---

## 5. Validate & Ship

### 5.1 Run validators

```bash
# Run all validators
bash .pi/scripts/validate-ci.sh
bash .pi/scripts/validate-tests.sh
bash .pi/scripts/validate-security.sh
bash .pi/scripts/validate-architecture.sh
bash .pi/scripts/validate-canonical.sh

# Or via agent:
/validate
```

### 5.2 Run TOML validators

```bash
npx guardian-framework validate
```

Output:
```
✓ ci-build                   Filter build output to show errors only
✓ test-results               Show only test failures, hide passing tests
✓ security-scan              Filter security scan output to show only findings
✓ lint-output                Group lint issues by file and rule
✓ architecture-check         Filter architecture validation output
✓ integration-check          Filter integration test output
✓ git-status                 Compact git status output
✓ docker-ps                  Compact docker ps output
```

### 5.3 Check canonical references

```bash
bash .pi/scripts/validate-canonical.sh
```

Ensures every implementation file has a canonical reference pointing to valid architecture docs.

### 5.4 Check file integrity

```bash
npx guardian-framework verify
```

Output:
```
Verification complete: 42/45 verified
  ⚠️  Files without baseline (3):
    .pi/agent/AGENTS.md — run 'guardian hash' to store baseline
    .pi/architecture/modules/auth.md — run 'guardian hash' to store baseline
    .pi/architecture/modules/api.md — run 'guardian hash' to store baseline
```

### 5.5 View token stats

```bash
npx guardian-framework stats
```

Output:
```
┌─────────────────────────────────────────────────────────────┐
│ Token Savings Report (last 30 days)                          │
├─────────────────────────────────────────────────────────────┤
│ Commands tracked:    234                                     │
│ Avg savings:         78.5%                                   │
│ Total tokens saved:  45.6K                                   │
│ Est. USD saved:      $0.42                                    │
│ Total exec time:     2m14s                                   │
│ Avg exec time:       573ms                                   │
├─────────────────────────────────────────────────────────────┤
│ Top Validators                                               │
│ 1  ci-build                        89 runs                   │
│ 2  test-results                     56 runs                  │
│ 3  lint-output                      34 runs                  │
├─────────────────────────────────────────────────────────────┤
│ Daily Savings                                                │
│ 2026-05-12      2.3K tokens  $0.02                          │
│ 2026-05-13      4.1K tokens  $0.04                          │
│ 2026-05-14      8.7K tokens  $0.08                          │
└─────────────────────────────────────────────────────────────┘
```

### 5.6 Commit and push

Use the `commit` and `land` skills:

```
/commit          — Create clean, logical commits
/land            — PR merge loop with full validation
```

---

## 6. Maintain & Update

### 6.1 Update framework

When Guardian releases new templates:

```bash
# See what would change
npx guardian-framework update --dryRun

# Apply changes (preserves your edits)
npx guardian-framework update

# Update + regenerate exports
npx guardian-framework update --regenerate
```

**Smart merge behavior:**

| File State | Action |
|------------|--------|
| Unchanged framework file | Auto-update to new version |
| User-modified with YAML front matter | Keep your config, merge new body |
| User-modified without front matter | Preserve your changes, warn |
| New template file | Add to project |
| Removed from templates | Mark as orphaned, don't delete |

### 6.2 Regenerate exports

After editing `.pi/` files:

```bash
npx guardian-framework generate
```

Regenerates `.agents/skills/` (and `.claude/`, `.opencode/`, `.agents/` if configured).

### 6.3 Export integrity

Guardian tracks export sync status:

```bash
npx guardian-framework info
```

Shows whether exports are in sync with `.pi/` source. If out of sync:

```
⚠️  .agents/  Out of sync
```

Run `npx guardian-framework generate` to fix.

---

## 7. Advanced: RTK Validators

### 7.1 Pipeline stages

Each TOML filter applies 8 stages in order:

1. **strip_ansi** — Remove ANSI escape codes
2. **replace** — Regex substitutions, line-by-line, chainable
3. **match_output** — Short-circuit: if blob matches pattern, return message
4. **strip/keep_lines** — Filter lines by regex
5. **truncate_lines_at** — Truncate each line to N chars
6. **head/tail_lines** — Keep first/last N lines
7. **max_lines** — Absolute line cap
8. **on_empty** — Message if result is empty

### 7.2 Create a custom validator

```toml
# .pi/validators/my-tool.toml
schema_version = 1

[filters.my-tool]
command = "my-command"
description = "Filter my-tool output"
strip_ansi = true
match_output = [
  { pattern = "BUILD SUCCESS", message = "✅ Build passed" },
  { pattern = "BUILD FAILED", message = "❌ Build failed" }
]
keep_lines_matching = ["error", "warning", "failed"]
max_lines = 30
on_empty = "✅ All clean"

[[tests.my-tool]]
name = "success short-circuit"
input = "Compiling...\nLinking...\nBUILD SUCCESS"
expected = "✅ Build passed"

[[tests.my-tool]]
name = "filters to errors"
input = "Compiling...\nwarning: unused var\nerror: type mismatch\nLinking...\nBUILD SUCCESS"
expected = "warning: unused var\nerror: type mismatch"
```

### 7.3 Trust model

Project-local validators require explicit trust:

```bash
# Review and trust
npx guardian-framework trust .pi/validators/my-tool.toml

# Revoke trust
npx guardian-framework trust --revoke .pi/validators/my-tool.toml

# List trusted files
npx guardian-framework trust --list
```

For CI, bypass trust:

```bash
GUARDIAN_TRUST_OVERRIDE=1 npx guardian-framework validate
```

---

## 8. Advanced: Terax Patterns

### 8.1 System prompt tiers

Configure prompt tier based on model capability:

```yaml
# In .pi/agent/AGENTS.md front matter
system_prompt_tier: full    # For Opus, GPT-4/5, Gemini Pro
system_prompt_tier: lite    # For Haiku, Flash, nano, Cerebras, Groq
```

**Savings:** ~750 tokens/turn × 20 turns = 15,000 tokens/session on fast models.

### 8.2 Context compaction

When conversations grow large, the agent applies compaction:

| Context Usage | Action |
|---------------|--------|
| 0–55% | No compaction |
| 55–70% | Elide superseded read results |
| 70–90% | Elide all old tool results (keep last 24 messages) |
| 90%+ | Aggressive compaction |

### 8.3 Plan mode workflow

```
/plan on                    # Enable plan mode
[Agent reads, researches, queues mutations]
/plan-apply                # Review all queued changes as batch diff
[Accept/Reject changes]
/plan off                  # Exit plan mode, discard any remaining queue
```

### 8.4 Session management

```
/sessions                  # List all sessions
[Switch sessions in pi UI]
[Each session has isolated state: todos, shell, read cache]
```

---

## 9. Real-World Example

### Scenario: Add OAuth2 login to an API server

#### Step 1: Define the architecture

```markdown
# .pi/architecture/modules/oauth.md

## Overview
OAuth2 login flow supporting Google and GitHub providers.

## Flow
```
User → /auth/google → redirect to Google → callback → exchange code → JWT
```

## Components
| Component | File | Purpose |
|-----------|------|---------|
| `OAuthProvider` | `src/auth/oauth-provider.ts` | Provider abstraction |
| `GoogleOAuth` | `src/auth/google-oauth.ts` | Google OAuth2 client |
| `GitHubOAuth` | `src/auth/github-oauth.ts` | GitHub OAuth2 client |
| `CallbackHandler` | `src/auth/callback-handler.ts` | Handle OAuth callback, issue JWT |
```

#### Step 2: Create an ADR

```markdown
# .pi/architecture/decisions/ADR-002-oauth-providers.md

## Decision
Use passport.js abstraction for OAuth2 providers. Each provider implements
a common interface: `authenticate(code: string) → UserProfile`.

## Consequences
- ✅ Easy to add new providers (Facebook, Apple)
- ✅ Single callback handler for all providers
- ⚠️ passport.js dependency adds 2MB to bundle
```

#### Step 3: Update CHANGELOG

```markdown
## 2026-05-14 - OAuth2 Module

### Added
- OAuth2 module: Google + GitHub providers
- ADR-002: OAuth provider strategy

### Impact
- New files: src/auth/oauth-*.ts (4 files)
- Validators: security, integration, canonical
```

#### Step 4: Work with an agent

```
/init                    # Scan workspace, generate project memory
/scope add OAuth2 login  # Classify scope → "complex" (security + integration validators)
/plan on                 # Enable plan mode

[Agent reads architecture docs, creates implementation plan]

[Review queued changes, accept]

/validate                # Run all validators
```

#### Step 5: Validate

```bash
bash .pi/scripts/validate-ci.sh
bash .pi/scripts/validate-security.sh     # OAuth2-specific checks
bash .pi/scripts/validate-integration.sh  # OAuth2 callback flow
bash .pi/scripts/validate-canonical.sh    # Check canonical references
```

#### Step 6: Ship

```
/commit                  # Clean commit with conventional commit message
/land                    # PR merge loop with full validation
```

---

## Quick Reference

### Commands

| Command | Purpose |
|---------|---------|
| `npx guardian-framework init` | Scaffold framework |
| `npx guardian-framework update` | Smart merge updates |
| `npx guardian-framework generate` | Regenerate exports |
| `npx guardian-framework info` | Display status |
| `npx guardian-framework stats` | Token savings analytics |
| `npx guardian-framework validate` | Run TOML validators |
| `npx guardian-framework validate --verify` | Run inline tests |
| `npx guardian-framework verify` | File integrity check |
| `npx guardian-framework trust <file>` | Trust project-local config |

### Slash Commands (in pi)

| Command | Purpose |
|---------|---------|
| `/init` | Workspace scan |
| `/plan` | Toggle plan mode |
| `/validate` | Run validators |
| `/scope <task>` | Classify task scope |
| `/snippet list` | List snippets |
| `/sessions` | List sessions |
| `/filechanges` | Review file changes |
| `/read-only on\|off` | Toggle read-only mode |
| `/reload-config` | Reload AGENTS.md config |

### Validators

| Validator | Script | When |
|-----------|--------|------|
| CI | `validate-ci.sh` | All tasks |
| Tests | `validate-tests.sh` | Moderate+ scope |
| Security | `validate-security.sh` | Complex+ scope |
| Operations | `validate-operations.sh` | Plan review |
| Architecture | `validate-architecture.sh` | Moderate+ scope |
| Canonical | `validate-canonical.sh` | All tasks |
| TOML (custom) | `.pi/validators/*.toml` | All tasks |

---

**See also:**
- [Design Spec](docs/guardian-framework-design.md)
- [Architecture](docs/architecture.md)
- [CHANGELOG](CHANGELOG.md)
- [pi Extensions API](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md)
