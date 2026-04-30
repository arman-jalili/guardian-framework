# GuardianCLI

**Token-Optimized Agentic Framework Scaffolder**

A CLI that scaffolds deterministic, validated AI-assisted development workflows. Uses **pi-first architecture** where `.pi/` is the version-controlled source of truth, with generated exports for Claude Code, OpenCode, GitHub Copilot, and Antigravity.

---

## Why GuardianCLI

Multi-agent AI workflows produce excellent results but burn tokens quadratically and drift from architecture. GuardianCLI solves this:

| Problem | Solution |
|---------|----------|
| Repeated context across agents | **DRY context** — shared templates loaded once |
| Validation at every step | **Shift-left validation** — validate plans, inherit for code |
| LLM doing mechanical checks | **Automated validators** — shell scripts replace LLM calls |
| Multiple AI tools | **Pi-first architecture** — single source → multiple exports |
| Orphaned code without docs | **Canonical references** — all code traces to architecture |
| Ad-hoc agent configuration | **WORKFLOW.md contract** — versioned prompt + runtime config |
| No safety for agent runs | **Workspace hooks + path safety** — isolated, bounded execution |
| Silent failures | **Retry with backoff + reconciliation** — recover from transient errors |

**Result: 50–65% token reduction** compared to traditional multi-agent workflows.

---

## Installation

```bash
# Run directly (no installation needed)
npx guardian-framework-cli init

# Or install globally
bun add -g guardian-framework-cli
```

---

## Quick Start

### 1. Scaffold a project

```bash
cd your-project
npx guardian-framework-cli init
```

Interactive prompts guide you through project name, language, AI tools, validators, and workflows.

### 2. Run validators

```bash
bash .pi/scripts/validate-ci.sh
bash .pi/scripts/validate-canonical.sh
```

### 3. Generate exports

```bash
npx guardian-framework-cli generate
```

Creates `.claude/`, `.opencode/`, `.agents/`, `.github/` from `.pi/` source.

---

## Architecture at a Glance

```
.pi/                          ← Source of truth (version-controlled)
├── agent/AGENTS.md           ← Project instructions + runtime config (YAML front matter)
├── architecture/             ← Module docs, ADRs, CHANGELOG, diagrams
├── context/                  ← Shared knowledge loaded once per session
├── skills/                   ← Agent definitions + codex skills (commit, push, pull, land, debug)
├── prompts/                  ← Workflow templates (feature, bugfix, epic, blueprint)
├── scripts/                  ← Automated validators (CI, tests, security, ops, architecture, canonical)
├── extensions/               ← Pi extensions (bash-guard, filechanges, read-only, ask-user)
└── workpad.md                ← Persistent session progress tracker
```

Read the full [Architecture Document](docs/architecture.md) for system design, data flow, component interactions, and the Symphony-inspired orchestration model.

---

## Commands

| Command | Purpose |
|---------|---------|
| `init` | Scaffold `.pi/` + exports interactively |
| `generate` | Regenerate exports from `.pi/` source |
| `update` | Smart merge framework updates, preserving user edits |
| `upgrade` | Migrate to new framework version |
| `uninstall` | Remove Guardian-managed files |
| `info` | Display manifest status, token stats, coverage |

### Key options

```bash
init --tool pi,claude --lang typescript --nonInteractive
generate --tool all --dry-run
update --regenerate
info
```

---

## Workflow Config (YAML Front Matter)

`.pi/agent/AGENTS.md` carries a YAML front matter that defines runtime settings — parsed and applied without restart:

```yaml
workspace:
  root: ".pi/workspaces"
  hooks:
    timeout_ms: 60000

agent:
  max_turns: 20
  max_retry_backoff_ms: 300000
  stall_timeout_ms: 300000

generate:
  on_conflict: warn       # overwrite | warn | skip
  atomic_writes: true

validate:
  fail_fast: false
  timeout_ms: 300000
```

Environment variables are referenced with `$VAR_NAME` — resolved at runtime from `process.env`. No global override; only explicit references are resolved.

---

## Workspace Hooks

Lifecycle hooks run around generate/update operations:

| Hook | Timing | Failure |
|------|--------|---------|
| `after_create` | Workspace first created | Fatal |
| `before_run` | Before each generate | Fatal |
| `after_run` | After each generate | Logged (best effort) |
| `before_remove` | Before workspace cleanup | Logged (best effort) |

Example `before_run` in front matter:

```yaml
hooks:
  before_run: |
    git stash push --include-untracked
    npm install
  after_run: |
    git stash pop || true
```

---

## Extensions

| Extension | Purpose |
|-----------|---------|
| `bash-guard.ts` | Blocks destructive commands (`rm -rf`, `sudo`, `git reset --hard`) with risk analysis TUI. Hard-blocks in subagents. |
| `filechanges.ts` | Tracks all file modifications. `/filechanges` to review diffs, `/filechanges-accept` to keep, `/filechanges-decline` to revert. |
| `read-only-mode.ts` | Enforces read/grep/find/ls only. Safe codebase exploration. `/read-only on|off|toggle`. |
| `ask-user-question.ts` | Structured questions: free-text, single-select, multi-select with "Other" escape hatch. |
| `coordinator.ts` | guardian_scope, guardian_validate, guardian_coordinate tools + lightweight bash-guard. |
| `validation-runner.ts` | `/validate` command for running validator scripts directly. |

Zero external npm dependencies — all self-contained.

---

## Codex Skills

| Skill | Purpose |
|-------|---------|
| `commit` | Clean, logical commits with Conventional Commits |
| `push` | Sync with remote, merge main, publish updates |
| `pull` | Sync with latest origin/main before implementation |
| `land` | PR merge loop with full validation — never `gh pr merge` directly |
| `debug` | Systematic debugging: observe → reproduce → hypothesize → verify → fix |

---

## Validators

| Validator | Checks | When |
|-----------|--------|------|
| **CI** | Build, lint, format, audit | All tasks |
| **Test** | Unit, integration, coverage | Moderate+ scope |
| **Security** | Secrets, injection, path traversal | Complex+ scope |
| **Operations** | Tracing, cancellation, atomic writes | Plan review |
| **Architecture** | Layer structure, ADR compliance, module boundaries | Moderate+ scope |
| **Canonical** | Reference integrity, coverage, ADR cross-references | All tasks |

### Scope Classification

| Scope | Files | Lines | Validators |
|-------|-------|-------|------------|
| Simple | 1 | < 50 | CI + canonical |
| Moderate | 2–5 | 50–200 | CI + architecture + canonical |
| Complex | 5–15 | 200–500 | CI + architecture + security + canonical |
| Critical | 15+ | 500+ | All + canonical + human approval |

---

## Epic Planning (Multi-Module)

Three modes for multi-module projects (backend + frontend + infra):

```bash
# 1. Cross-module overview — discovers all architecture docs, maps dependencies
/epic-plan --overview

# 2. Module-specific slice — plans next epic from a specific architecture doc
/epic-plan --module frontend docs/frontend-architecture.md

# 3. Quick feature plan
/epic-plan "add OAuth login"
```

---

## Canonical Reference System

Every implementation file references its architecture source:

```typescript
/**
 * Canonical Reference: .pi/architecture/modules/auth-system.md#token-validation
 * Implements: AC-1, AC-2
 * Last Sync: 2026-04-26
 */
```

`validate-canonical.sh` checks reference integrity, coverage ≥ 50%, and ADR cross-references.

---

## Retry & Reconciliation

| Mechanism | Behavior |
|-----------|----------|
| **Exponential backoff** | 10s × 2^(attempt-1), capped at 5 min |
| **Continuation retry** | 1 s after clean exit, checks if work remains |
| **Reconciliation** | Detects externally modified exports before clobbering |
| **Stall detection** | SIGTERM after 60 s of no output from hooks |

---

## Token Accounting

```bash
npx guardian-framework-cli info
```

Shows token stats per category and per file, with total context size estimation (~4 chars/token).

---

## Structured Logging

All operations emit JSON log lines:

```json
{"timestamp":"2026-04-27T12:00:00.000Z","level":"info","message":"generate completed","context":{"tool":"claude","files":12}}
```

Helpers: `logger.issue()`, `logger.tool()`, `logger.action(outcome)`.

---

## Supported Languages

| Language | Build | Test | Lint | Format |
|----------|-------|------|------|--------|
| TypeScript | `bun build` | `bun test` | `biome check` | `biome format` |
| Rust | `cargo build` | `cargo test --all` | `cargo clippy` | `cargo fmt` |
| Python | `python -m build` | `pytest` | `ruff check` | `ruff format` |
| Go | `go build ./...` | `go test ./...` | `golangci-lint` | `gofmt` |

---

## Development

```bash
bun install
bun run build        # bun build --target=bun ./src/index.ts --outdir ./dist
bun test
bun run lint         # biome check .
bun run format       # biome format . --write
bun run typecheck    # bunx tsc --noEmit
```

---

## License

MIT

## Links

- **Source:** https://github.com/arman-jalili/guardian-cli
- **Design Spec:** [docs/guardian-cli-design.md](docs/guardian-cli-design.md)
- **Architecture:** [docs/architecture.md](docs/architecture.md)
- **Pi Framework:** https://github.com/badlogic/pi-mono
