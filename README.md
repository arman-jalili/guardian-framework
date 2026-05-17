# Guardian

**Token-Optimized Agentic Framework Scaffolder**

A CLI that scaffolds deterministic, validated AI-assisted development workflows. Uses **pi-first architecture** where `.pi/` is the version-controlled source of truth, with generated exports for Claude Code, OpenCode, GitHub Copilot, and Antigravity.

---

## Why Guardian

Multi-agent AI workflows produce excellent results but burn tokens quadratically and drift from architecture. Guardian solves this:

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
| Unbounded context growth | **Context compaction** — budget-aware elision, read cache |
| No tool scoping for subagents | **Subagent delegation** — read-only whitelists, anti-recursion |
| Monolithic system prompts | **Tiered prompts** — full/lite by model capability |
| Blind file mutations | **Plan mode** — queued edits for batch review |
| Token-heavy skill loading | **Snippet expansion** — `#handle` tokens (70–90% savings) |
| Secret leakage in output | **Redaction layer** — API keys, tokens, JWTs auto-stripped |
| Verbosity in command output | **TOML filter pipeline** — declarative 8-stage output compression |
| No runtime token accounting | **SQLite tracking** — per-validator token savings + USD estimation |

**Result: significant token reduction** compared to traditional multi-agent workflows. See the [Token Reduction Methodology](#token-reduction-methodology) section for details.

---

## Token Reduction Methodology

Token savings come from several mechanisms:

| Mechanism | How It Works | Typical Savings |
|-----------|-------------|----------------|
| **DRY Context** | Shared templates loaded once per session instead of per-agent | 20–40% |
| **Snippet Expansion** | `#handle` tokens replace full skill files | 70–90% per skill |
| **TOML Filters** | 8-stage pipeline compresses command output | 30–60% of output |
| **Validator Scripts** | Shell scripts replace LLM-based checks | 100% for mechanical checks |
| **Tiered Prompts** | Lite prompts for fast models | ~750 tokens/turn |
| **Context Compaction** | Budget-aware elision at thresholds | 15–30% of context |

Actual savings vary by project size, language, and AI tool configuration.

---

## Installation

```bash
# Run directly (no installation needed)
npx guardian-framework init

# Or install globally
npm install -g guardian-framework
```

---

## Quick Start

### 1. Scaffold a project

```bash
cd your-project
npx guardian-framework init
```

Interactive prompts guide you through project name, language, AI tools, validators, and workflows.

### 2. Run validators

```bash
bash .pi/scripts/validate-ci.sh
bash .pi/scripts/validate-canonical.sh
```

### 3. Update framework

```bash
npx guardian-framework update
```

Smart-merges new template versions into your project — preserves user edits, merges YAML config.

### 4. Generate exports

```bash
npx guardian-framework generate
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
| `update` | Smart merge new templates, preserving user edits |
| `upgrade` | Migrate to new framework version |
| `uninstall` | Remove Guardian-managed files |
| `info` | Display manifest status, token stats, coverage |

### `update` — Smart Merge

Updates `.pi/` files from new Guardian templates without losing your work:

```bash
# See what would change (safe, no writes)
guardian update --dryRun

# Apply changes (shows confirmation prompt)
guardian update

# Force overwrite everything, including user-modified files
guardian update --force

# Update + regenerate all exports in one step
guardian update --regenerate
```

**How it decides what to do:**

| File State | Action | Example |
|------------|--------|-------|
| New template file | **Add** to project | New skills, new validators |
| Unchanged framework file | **Update** to new version | Bugfix in validate-ci.sh |
| User file with YAML front matter | **Merge** — keep user config, new body | `AGENTS.md` with custom workspace/agent config |
| User file without front matter | **Preserve** — keep as-is | Custom `patterns.md` edits |
| Generated export | **Mark** for regeneration | `.claude/`, `.opencode/` files |
| Removed from templates | **Orphan** — noted, not deleted | Deprecated files |

**Front-matter merge example:**

If your `AGENTS.md` has custom config:
```yaml
---
agent:
  max_turns: 30
---
# My custom project context...
```

Update preserves your config (`max_turns: 30`) and replaces the body with the new template.

### Key options

```bash
guardian-framework init --tool pi,claude --lang typescript --nonInteractive
guardian-framework generate --tool all --dryRun
guardian-framework update --regenerate
guardian-framework info
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
| `config-reload.ts` | Watches AGENTS.md for changes, reloads config without restart. `/reload-config` for manual trigger. |
| `coordinator.ts` | guardian_scope, guardian_validate, guardian_coordinate tools + lightweight bash-guard. |
| `validation-runner.ts` | `/validate` command for running validator scripts directly. |
| `plan-mode.ts` | Queues file mutations for batch review. `/plan` to toggle, `/plan-apply` to review and apply. Shell refused in plan mode. |
| `slash-commands.ts` | `/init`, `/validate`, `/scope`, `/snippet` commands with `send-prompt` outcome model. |
| `session-persistence.ts` | Structured session lifecycle with lazy-loaded history, auto-derived titles, `/sessions` command. |
| `snippets.ts` | `#handle` token expansion and management. `/snippet list\|add\|remove\|edit`. |
| `redaction.ts` | Automatic secret redaction in tool results and user input. Covers API keys, tokens, JWTs, env assignments. |
| `goal-loop.ts` | Standing goals with validator-backed judge (`/goal`, `/subgoal`). Auto-iterates until validated. |
| `kanban.ts` | Durable task board with state machine, dependencies, comments (`kanban_*` tools, `/kanban`). |
| `hooks.ts` | Shell-script hooks for lifecycle events (block tools, inject context, observe). |
| `curator.ts` | Skill lifecycle management: usage tracking, stale detection, archival (`/curator`). |
| `pipeline.ts` | Multi-step workflow engine with per-step acceptance gates (`/pipeline`). |

Zero external npm dependencies — all self-contained.

---

## RTK-Adopted Patterns

Guardian incorporates production-tested patterns from [RTK](https://github.com/rtk-ai/rtk), a high-performance CLI proxy for LLM token reduction:

| # | Pattern | Impact |
|---|---------|--------|
| 1 | **TOML Filter Pipeline** | 8-stage declarative output compression (strip → replace → match → filter → truncate → head/tail → cap → empty) |
| 2 | **Inline Test-Driven Validators** | Self-verifying validators with `[[tests.*]]` blocks, `guardian validate --verify` |
| 3 | **JSON Token Tracking** | Runtime token accounting with `guardian stats`, daily/weekly reports, USD estimation |
| 4 | **Language-Aware Code Filtering** | 3-level read filtering (None/Minimal/Aggressive) for 11 languages |
| 5 | **Tee-on-Failure** | Raw validator output preserved on failure for debugging |
| 6 | **Trust-Gated Project Config** | Prevents malicious extension injection — `guardian trust` workflow |
| 7 | **File Integrity Verification** | SHA-256 hash verification, detects tampering/drift — `guardian verify` |
| 8 | **Economic Analytics** | Estimated USD savings based on API pricing — shown in `guardian info` |

---

## Hermes-Adopted Patterns

Guardian incorporates production-tested patterns from [Hermes-Agent](https://github.com/nousresearch/hermes-agent), a full-featured AI agent framework by Nous Research:

| # | Pattern | Guardian Implementation |
|---|---------|------------------------|
| 1 | **`/goal` Standing Goals** | `goal-loop.ts` — persistent goals with validator-backed judge, turn budget, `/subgoal` criteria |
| 2 | **Kanban Task Board** | `kanban.ts` — durable state machine with dependencies, comments, priority, workspaces |
| 3 | **Shell Hook System** | `hooks.ts` — declarative hooks for pre/post tool, pre/post LLM, lifecycle events |
| 4 | **Subagent Roles** | `subagent-registry.md` — leaf vs orchestrator roles with `max_spawn_depth` control |
| 5 | **Skill Curator** | `curator.ts` — usage telemetry, stale detection, archival with pin/restore protection |
| 6 | **Pipeline Engine** | `pipeline.ts` — multi-step workflow across items, per-step gates, merge-on-valid |

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

## Terax-Adopted Patterns

Guardian incorporates production-tested patterns from [Terax AI](https://github.com/crynta/terax-ai), an AI-native terminal:

| # | Pattern | Impact |
|---|---------|--------|
| 1 | **Subagent Delegation + Tool Scoping** | Read-only tool whitelists per agent type, anti-recursion guards |
| 2 | **Context Compaction** | Budget-aware elision at 55/70/90% thresholds, superseded read dropping |
| 3 | **Security Guards** | Pre-execution path safety (15 secret patterns, 9 protected dirs), 12-item command deny-list |
| 4 | **Tiered System Prompts** | Full vs Lite prompts by model capability (~750 tokens/turn saved on fast models) |
| 5 | **Plan Mode + Queued Edits** | Mutations queued for batch review, shell refused in plan mode |
| 6 | **Snippet Token Expansion** | `#handle` → XML block expansion, 70–90% token savings vs full skill files |
| 7 | **Session Persistence** | Lazy-loaded history, auto-derived titles, per-session state isolation |
| 8 | **Read-Before-Edit Invariant** | Must read file before editing, read cache invalidation on mutation |
| 9 | **Slash Command System** | `/init`, `/validate`, `/scope`, `/snippet` with `send-prompt` outcome |
| 10 | **Tool Labeling** | Human-readable tool call labels for progress display |
| 11 | **Model Registry** | Intelligence/speed/cost scoring, auto-selection by task type |
| 12 | **Redaction Layer** | Automatic secret redaction (API keys, tokens, JWTs, env assignments) |

See [CHANGELOG.md](CHANGELOG.md) for implementation details.

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
| **Retry persistence** | Queue stored in `.pi/.guardian-retry-state.json`, survives restarts |

---

## Token Accounting

```bash
npx guardian-framework info
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

- **Source:** https://github.com/arman-jalili/guardian-framework
- **Design Spec:** [docs/guardian-framework-design.md](docs/guardian-framework-design.md)
- **Architecture:** [docs/architecture.md](docs/architecture.md)
- **Pi Framework:** https://github.com/badlogic/pi-mono
