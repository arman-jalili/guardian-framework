# Guardian Architect — The Architecture Tool

> **From canonical architecture to running code, fully validated, zero babysitting.**

Guardian Architect is Guardian's flagship feature. It turns your `.pi/architecture/modules/*.md` files into an automated implementation pipeline where every slice must prove architectural conformance before it can merge.

---

## Table of Contents

1. [What Is Guardian Architect?](#1-what-is-guardian-architect)
2. [Quick Start (5 Minutes)](#2-quick-start-5-minutes)
3. [The Full Process](#3-the-full-process)
4. [Architecture Setup](#4-architecture-setup)
5. [Commands Reference](#5-commands-reference)
6. [The Hardening Pipeline](#6-the-hardening-pipeline)
7. [Custom Validators](#7-custom-validators)
8. [Git Integration](#8-git-integration)
9. [Configuration Reference](#9-configuration-reference)
10. [Language Support](#10-language-support)
11. [Full Walkthrough: Auth Module](#11-full-walkthrough-auth-module)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. What Is Guardian Architect?

Guardian Architect is the **single entry point** that chains the full process from architecture documentation to running, validated, merged code:

```
Architecture Docs  →  Epic Draft  →  Validation  →  Issues  →  Implementation  →  Hardening  →  Merge  →  Next Epic
```

### What Makes It Different

| Traditional Development | Guardian Architect |
|------------------------|-------------------|
| Code first, docs later | Architecture first, code follows |
| Ad-hoc validation | 10 mandatory hardening stages per MR |
| Manual MR review | Agent implements, validates, creates MR, merges on green |
| No architectural conformance checks | 11+ conformance checks enforced at CI level |
| Babysitting required | Zero babysitting — fully automated loop |

### Core Principles

1. **Architecture-first** — Every piece of code traces back to canonical architecture docs
2. **Deterministic validation** — Scripts decide if something is ready, not LLMs
3. **Self-driving execution** — Once you approve the epic draft, everything runs automatically
4. **Architecture readiness is mandatory** — No epic closes without runbook, DR plan, docs, and canonical sync
5. **Infinite loop** — When one epic completes, the next one starts automatically

---

## 2. Quick Start (5 Minutes)

### Step 1: Initialize Guardian

```bash
cd your-project
npx guardian-framework init
```

This creates `.pi/` — your source of truth.

### Step 2: Add Your First Architecture Module

Create `.pi/architecture/modules/auth-system.md`:

```markdown
# Auth System

## JWT Token Validation
status: planned
description: Validates JWT tokens from request headers, checks expiry, signature, and claims.
depends: none

## OAuth2 Provider Integration
status: planned
description: Integrates with Google, GitHub OAuth2 providers for SSO.
depends: JWT Token Validation

## Session Management
status: planned
description: Manages user sessions with Redis-backed storage, automatic expiry.
depends: JWT Token Validation

## Architecture Observability
status: planned
description: Runbook, DR plan, metrics, tracing for the auth module.
depends: OAuth2 Provider Integration, Session Management
```

### Step 3: Start Your First Epic

```
/architect --epic "Auth Module v1"
```

Guardian discovers your module, finds 4 planned components, generates 5 issues (4 implementation + 1 architecture readiness), and validates the epic draft.

### Step 4: Run the Pipeline

```
/pipeline "Auth Module v1" --items "jwt-token-validation,oauth2-provider-integration,session-management,architecture-readiness" --steps "implement,validate,create-mr,merge" --merge-on-valid
```

The agent implements each issue, runs 10 hardening stages, creates MRs, merges on green, and closes the epic.

### Step 5: Start the Next Epic

```
/architect next-epic
▶ Next epic: api-gateway (3 components planned)

/architect --epic "API Gateway v1"
```

---

## 3. The Full Process

### Phase 1: Epic Generation

```
┌─────────────────────────────────────────────────────────────┐
│  1. DISCOVER: Read .pi/architecture/modules/*.md            │
│  2. PLAN: Generate epic draft + issue drafts                 │
│  3. VALIDATE: Run deterministic validators on epic draft     │
│  4. GENERATE: Create epic + issue markdown files             │
│  5. PUBLISH: Create issues/epics on GitLab/GitHub            │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Execution (per issue)

```
┌─────────────────────────────────────────────────────────────┐
│  6. IMPLEMENT → VALIDATE → CREATE MR → MERGE-ON-GREEN       │
│     After each: 10 hardening stages must pass               │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: Architecture Readiness (final issue)

```
┌─────────────────────────────────────────────────────────────┐
│  7. runbook → DR plan → docs → canonical → observability    │
│     validate-architecture-readiness.sh must pass            │
└─────────────────────────────────────────────────────────────┘
```

### Phase 4: Close & Next

```
┌─────────────────────────────────────────────────────────────┐
│  8. CLOSE Epic + Tracking Issue → 9. NEXT EPIC (loop)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Architecture Setup

### Module File Format

```markdown
# Module Name

## Component Name
status: planned
description: What this component does.
depends: Other Component Name

## Another Component
status: implemented
description: Already done.
depends: Component Name
```

### Status Values

| Status | Meaning |
|--------|---------|
| `planned` | Not yet implemented — will appear in next epic |
| `in-progress` | Currently being worked on |
| `implemented` | Done, verified |
| `deprecated` | Being phased out |

### Directory Structure

```
.pi/
├── architecture/
│   ├── modules/
│   │   ├── auth-system.md
│   │   ├── api-gateway.md
│   │   └── user-service.md
│   └── decisions/
│       ├── ADR-001-auth-pattern.md
│       └── ADR-002-db-strategy.md
├── scripts/
│   ├── validate-ci.sh
│   ├── validate-security.sh
│   ├── validate-architecture-readiness.sh
│   ├── ci/
│   │   ├── check_architecture_conformance.sh
│   │   └── run_hardening_stages.sh
│   └── git/
│       ├── create-tracking-issue.sh
│       ├── update-tracking-issue.sh
│       ├── close-issue.sh
│       ├── close-epic.sh
│       └── link-issue-to-epic.sh
├── extensions/
│   ├── architect.ts
│   ├── pipeline.ts
│   └── goal-loop.ts
└── prompts/
    ├── epic-plan.md
    ├── issue-implementation-series.md
    └── issue-closeout.md
```

### Canonical References

Every implementation file must reference its architecture source:

```python
"""
Canonical Reference: .pi/architecture/modules/auth-system.md#jwt-token-validation
Implements: AC-1, AC-2
Last Sync: 2026-05-16
"""
```

The `validate-canonical.sh` script checks that all implementation files have these references.

---

## 5. Commands Reference

### `/architect`

| Command | Effect |
|---------|--------|
| `/architect --epic "Name"` | Start a new epic from the next architecture slice |
| `/architect --epic "Name" --tracking-issue 100` | Start epic linked to existing tracking issue |
| `/architect status` | Show current epic progress |
| `/architect next-epic` | Discover the next logical epic |
| `/architect abort` | Kill the current epic |

### `/pipeline`

| Command | Effect |
|---------|--------|
| `/pipeline <name> --items "id1,id2" --steps "implement,validate"` | Start pipeline |
| `/pipeline status` | Show current pipeline progress |
| `/pipeline pause` | Pause at current step |
| `/pipeline resume` | Resume from where paused |
| `/pipeline skip-step` | Skip current step, move to next |
| `/pipeline retry-step` | Retry current step |
| `/pipeline abort` | Kill pipeline |

### `/goal`

| Command | Effect |
|---------|--------|
| `/goal <text>` | Set a standing goal |
| `/goal <text> --validators=ci,tests,security` | Set goal with specific validators |
| `/goal <text> --validators=all` | Run every available validator |
| `/goal` or `/goal status` | Show current goal |
| `/goal validators --discover` | List all available validators |
| `/goal validators ci,tests` | Set validators on active goal |
| `/subgoal <text>` | Add criteria to active goal |

---

## 6. The Hardening Pipeline

Every MR must pass **10 mandatory stages** before it can merge.

### The 10 Stages

| Stage | Name | What It Checks | Conditional |
|-------|------|---------------|-------------|
| 1 | `docs_policy` | MR traceability, docs sync guard | Always |
| 2 | `architecture_conformance` | 11+ architectural contract checks | Always |
| 3 | `lint` | Language-specific linting + format | Always |
| 4 | `static_analysis` | Type checking, import boundaries, sanity | Always |
| 5 | `unit` | Domain, application, contract, verification tests | Always |
| 6 | `integration` | Integration tests | Always |
| 7 | `security` | SBOM, Trivy scan, secret scan, dependency audit | Always |
| 8 | `migration_verify` | Migration apply + index/policy check | Only if migration files changed |
| 9 | `package_build` | Docker build | Only on main branch |
| 10 | `release_readiness` | Runbook, observability, release policy | Always |

### Running the Hardening Pipeline

```bash
# Run all stages
bash .pi/scripts/ci/run_hardening_stages.sh

# Run specific stages
bash .pi/scripts/ci/run_hardening_stages.sh --stages lint,security,unit

# Verbose output
bash .pi/scripts/ci/run_hardening_stages.sh --verbose
```

### Architecture Conformance (Stage 2)

| Check | What It Verifies |
|-------|-----------------|
| `tenant_isolation` | Tenant-scoped data never crosses tenant boundaries |
| `event_ordering` | Events processed in correct causal/temporal order |
| `outbox_dlq` | Outbox pattern and dead-letter queues properly implemented |
| `replay_upcaster` | Event replay and schema upcasting work correctly |
| `runstarted_publication` | Run-started events published correctly |
| `runstarted_worker_activation` | Workers activate correctly on run-started events |
| `bounded_execution` | AI executions bounded (timeout, token, step limits) |
| `artifact_proof_surfaces` | Artifact proof surfaces properly exposed |
| `runtime_baseline` | Runtime environment meets baseline requirements |
| `controlled_stage_progression` | State machines progress through defined stages only |
| `architecture_sanity` | No orphaned imports, concurrency safety, no env collisions |
| `import_boundaries` | No cross-layer violations (domain→infrastructure→api) |

---

## 7. Custom Validators

### Simple Script Validators

Create `.pi/scripts/validate-coverage.sh`:

```bash
#!/bin/bash
set -euo pipefail
npm run coverage -- --threshold=80
```

```bash
chmod +x .pi/scripts/validate-coverage.sh
/goal Increase coverage --validators ci,tests,coverage
/goal validators --discover   # shows coverage under 'Custom'
```

### Architecture Conformance Checks

Create `.pi/scripts/ci/check_my_conformance.py`:

```python
#!/usr/bin/env python3
"""Check that all database models have tenant_id scoping."""
import sys, os

violations = 0
for root, dirs, files in os.walk("app"):
    for f in files:
        if f.endswith(".py"):
            path = os.path.join(root, f)
            with open(path) as fh:
                content = fh.read()
                if "tenant_id" in content and "WHERE" not in content:
                    violations += 1
                    print(f"FAIL: {path} has tenant_id but no tenant-scoped queries")

if violations > 0:
    sys.exit(1)
print("PASS: All tenant-scoped models have proper filtering")
sys.exit(0)
```

The conformance runner auto-discovers and runs it in Stage 2.

---

## 8. Git Integration

### Setup

```bash
# GitHub
gh auth login

# GitLab
glab auth login
```

### Scripts

| Script | Purpose |
|--------|---------|
| `create-tracking-issue.sh` | Create epic tracking issue |
| `update-tracking-issue.sh` | Post progress updates |
| `close-issue.sh` | Close individual issue |
| `close-epic.sh` | Close epic + tracking issue |
| `link-issue-to-epic.sh` | Link issue to epic |

### Platform Detection

Guardian auto-detects:
- `gh auth status` works → GitHub
- `glab auth status` works → GitLab
- Neither → local tracking files in `.pi/.tracking/`

Override with `GIT_PLATFORM=github` or `GIT_PLATFORM=gitlab`.

---

## 9. Configuration Reference

### AGENTS.md Front Matter

```yaml
# Workspace settings
workspace:
  root: ".pi/workspaces"
  hooks:
    timeout_ms: 60000

# Agent settings
agent:
  max_turns: 20
  max_retry_backoff_ms: 300000
  stall_timeout_ms: 300000

# Goal settings
goal:
  enabled: true
  max_turns: 20
  judge_validator: true

# Kanban settings
kanban:
  enabled: true
  auto_create_tasks: true

# Shell hooks
hooks:
  pre_tool_call:
    - command: "~/.pi/hooks/block-rm-rf.sh"
      matcher: "bash"
      timeout: 5

# Curator settings
curator:
  enabled: true
  stale_after_days: 30
  archive_after_days: 90
  auto_review: true

# Delegation settings
delegation:
  max_spawn_depth: 1
  max_concurrent_children: 3
  max_iterations: 50
  child_timeout_ms: 600000
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | GitHub API authentication |
| `GITLAB_TOKEN` | GitLab API authentication |
| `GIT_PLATFORM` | Force platform: `github` or `gitlab` |
| `COVERAGE_THRESHOLD` | Minimum coverage percentage (default: 80) |
| `SONAR_TOKEN` | SonarQube authentication |
| `SONAR_HOST_URL` | SonarQube host URL |

---

## 10. Language Support

Guardian's hardening pipeline and architecture conformance checks work with **Python, TypeScript, Rust, and Go**.

### Auto-Detection

Guardian auto-detects the project language from:
- `pyproject.toml`, `requirements.txt`, `Pipfile` → **Python**
- `package.json`, `tsconfig.json` → **TypeScript**
- `Cargo.toml` → **Rust**
- `go.mod` → **Go**

### Language-Specific Validators

Each architecture conformance check tries a language-specific validator first, then falls back to grep-based pattern matching:

| Check | Python | TypeScript | Rust/Go | Fallback |
|-------|--------|------------|---------|----------|
| `tenant_isolation` | `check_tenant_isolation.py` | `check_tenant_isolation.ts` | `check_tenant_isolation.sh` | grep for `tenant_id` |
| `event_ordering` | `check_event_ordering.py` | `check_event_ordering.ts` | — | grep for `sequence` |
| `outbox_dlq` | `check_outbox_dlq.py` | `check_outbox_dlq.ts` | — | grep for `outbox` |
| ... | ... | ... | ... | ... |

### Language-Specific Linting

| Language | Lint | Format | Type Check | Test | Runtime |
|----------|------|--------|------------|------|---------|
| **Python** | ruff/flake8 | ruff format | mypy | pytest | Python 3.10+ |
| **TypeScript** | biome/eslint | biome format | tsc | bun test | Node 18+ |
| **Rust** | cargo clippy | cargo fmt | cargo check | cargo test | rustc |
| **Go** | golangci-lint | gofmt | go vet | go test | go |

---

## 11. Full Walkthrough: Auth Module

### Step 1: Set Up Architecture

```bash
cd your-project
npx guardian-framework init
```

Create `.pi/architecture/modules/auth-system.md`:

```markdown
# Auth System

## JWT Token Validation
status: planned
description: Validates JWT tokens from request headers, checks expiry, signature, and claims.
depends: none

## OAuth2 Provider Integration
status: planned
description: Integrates with Google, GitHub OAuth2 providers for SSO.
depends: JWT Token Validation

## Session Management
status: planned
description: Manages user sessions with Redis-backed storage, automatic expiry.
depends: JWT Token Validation

## Architecture Observability
status: planned
description: Runbook, DR plan, metrics, tracing for the auth module.
depends: OAuth2 Provider Integration, Session Management
```

### Step 2: Discover Next Slice

```
/architect next-epic

Next epic: auth-system (4 components planned)
Components: JWT Token Validation, OAuth2 Provider Integration, Session Management, Architecture Observability
```

### Step 3: Start the Epic

```
/architect --epic "Auth Module v1"

▶ Epic "Auth Module v1" started
Module: auth-system
Components to implement:
  - JWT Token Validation (Validates JWT tokens from request headers...)
  - OAuth2 Provider Integration (Integrates with Google, GitHub OAuth2...)
  - Session Management (Manages user sessions with Redis-backed...)
  - Architecture Observability (Runbook, DR plan, metrics, tracing...)

Issues generated: 5 (4 implementation + 1 architecture readiness)
```

### Step 4: Validate Epic Draft

Guardian automatically runs:
- `validate-architecture.sh` — Checks ADR compliance, module boundaries
- `validate-security.sh` — Checks threat model, auth patterns
- `validate-operations.sh` — Checks observability, tracing

If any fail, Guardian halts and shows the failures. Fix them, then continue.

### Step 5: Publish to GitHub/GitLab

```bash
# Guardian auto-creates tracking issue if gh/glab is configured
TRACKING_ID=100  # Created automatically
```

### Step 6: Run the Pipeline

```
/pipeline "Auth Module v1" --items "issue-jwt-token-validation,issue-oauth2-provider-integration,issue-session-management,issue-architecture-readiness" --steps "implement,validate,create-mr,merge" --merge-on-valid
```

What happens:

```
[1/20] Item: issue-jwt-token-validation → Step: implement
  Agent: [loads issue-implementation-series.md, creates auth/jwt_validator.py]
  [CI passes] → ✓

[2/20] Item: issue-jwt-token-validation → Step: validate
  Agent: [runs 10 hardening stages]
  Stage 1: docs_policy → ✓
  Stage 2: architecture_conformance → ✓ (11 checks pass)
  Stage 3: lint → ✓
  Stage 4: static_analysis → ✓
  Stage 5: unit → ✓
  Stage 6: integration → ✓
  Stage 7: security → ✓
  Stage 8: migration_verify → ⊘ skipped (no migration changes)
  Stage 9: package_build → ⊘ skipped (not on main)
  Stage 10: release_readiness → ✓
  → ✓ All stages pass

[3/20] Item: issue-jwt-token-validation → Step: create-mr
  Agent: [creates MR #102]
  → ✓

[4/20] Item: issue-jwt-token-validation → Step: merge
  Agent: [validates MR, merges]
  → ✓ Issue #102 closed. Tracking issue #100 updated.

[5/20] Item: issue-oauth2-provider-integration → Step: implement
  ...continues for each issue...

[17/20] Item: issue-architecture-readiness → Step: implement
  Agent: [creates docs/runbook.md, docs/dr-plan.md, updates architecture docs]

[18/20] Item: issue-architecture-readiness → Step: validate
  Agent: [runs validate-architecture-readiness.sh]
  ✓ Runbook readiness
  ✓ DR plan readiness
  ✓ Documentation sync
  ✓ Canonical references
  ✓ Observability: tracing detected
  ✓ Observability: metrics detected
  ✓ Architecture conformance

[20/20] Item: issue-architecture-readiness → Step: merge
  ✓ Merged! Epic complete.

✅ Epic "Auth Module v1" complete. 5/5 issues done.
```

### Step 7: Close Epic

```bash
bash .pi/scripts/git/close-epic.sh --epic-id 101 --tracking-id 100 --comment "Auth Module v1 complete. 5/5 issues done. 0 retries."
```

### Step 8: Next Epic

```
/architect next-epic

Next epic: api-gateway (3 components planned)

/architect --epic "API Gateway v1"
# ... same process repeats
```

---

## 12. Troubleshooting

### "No architecture modules found"

Create `.pi/architecture/modules/` with at least one module file:

```bash
mkdir -p .pi/architecture/modules
cat > .pi/architecture/modules/my-module.md << 'EOF'
# My Module

## Component
status: planned
description: Description here.
depends: none
EOF
```

### "Hardening stage failed"

Check which stage failed:

```bash
bash .pi/scripts/ci/run_hardening_stages.sh --verbose
```

Fix the issue, then `/pipeline retry-step`.

### "Git platform not detected"

Install and authenticate the CLI:

```bash
# GitHub
brew install gh
gh auth login

# GitLab
brew install glab
glab auth login
```

Or set `GIT_PLATFORM=github` or `GIT_PLATFORM=gitlab`.

### "Validator not found"

Custom validators must be in `.pi/scripts/` and start with `validate-`:

```bash
# Correct
.pi/scripts/validate-coverage.sh

# Wrong (won't be auto-discovered)
.pi/scripts/check-coverage.sh
```

### "Pipeline stuck on a step"

```
/pipeline skip-step    # Skip and move to next step
/pipeline retry-step   # Retry the current step
/pipeline abort        # Kill the pipeline
```

### "Goal loop not continuing"

Check the goal status:

```
/goal status
```

If validators are failing, fix them. If the turn budget is exhausted:

```
/goal resume   # Resets counter, continues
```
