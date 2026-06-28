# Guardian Architecture

**Version:** 2.3
**Status:** Living Document
**Last Updated:** 2026-06-27

---

## 1. Overview

Guardian is a **token-optimized agentic framework scaffolder** that generates deterministic, validated AI-assisted development workflows. It uses a **pi-first architecture** where `.pi/` is the version-controlled source of truth and all other formats (`.claude/`, `.opencode/`, `.agents/`, `.github/`) are generated exports.

### Design Goals

1. **Token efficiency** — DRY context, snippet expansion, TOML filters: 50–70% reduction vs traditional multi-agent workflows
2. **Architecture traceability** — every implementation file references its architecture source via canonical reference headers
3. **Validation shift-left** — validate plans before code, not after. 7 validator categories (scope auto-selects)
4. **Pi-first** — single `.pi/` source of truth → multiple export targets
5. **Production safety** — workspace hooks with timeout/stall detection, path invariants, retry with backoff, reconciliation before overwrite

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLI Entry Point                           │
│                        src/index.ts (parseArgs)                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────┐ ┌──────▼──────┐ ┌─────▼──────┐
     │   init.ts   │ │ generate.ts │ │ update.ts  │
     │  (scaffold) │ │  (export)   │ │  (merge)   │
     └──────┬──────┘ └──────┬──────┘ └─────┬──────┘
            │               │              │
            ▼               ▼              ▼
┌──────────────────────────────────────────────────────────┐
│                      Core Libraries                       │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐   │
│  │templates.ts │ │manifest.ts   │ │workflow-config.ts│   │
│  │(load/render)│ │(state/hash)  │ │(YAML front matter)│  │
│  └─────────────┘ └──────────────┘ └──────────────────┘   │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐   │
│  │workspace    │ │retry.ts      │ │retry-queue.ts    │   │
│  │-hooks.ts    │ │(backoff)     │ │(persistence)     │   │
│  └─────────────┘ └──────────────┘ └──────────────────┘   │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐   │
│  │logger.ts    │ │integrity.ts  │ │toml-filter.ts    │   │
│  │(structured) │ │(tamper detect)│ │(output compress) │  │
│  └─────────────┘ └──────────────┘ └──────────────────┘   │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐   │
│  │code-filter  │ │trust.ts      │ │tracking.ts       │   │
│  │(11 languages)│ │(SHA-256 gate)│ │(token analytics) │  │
│  └─────────────┘ └──────────────┘ └──────────────────┘   │
└──────────────────────────────────────────────────────────┘
            │               │              │
            ▼               ▼              ▼
┌──────────────────────────────────────────────────────────┐
│                     Template Source                       │
│  templates/pi/                                            │
│  ├── agent/AGENTS.md (project instructions + config)      │
│  ├── architecture/ (module docs, ADRs, CHANGELOG)         │
│  ├── context/ (shared knowledge)                          │
│  ├── skills/ (agent definitions + codex skills)           │
│  ├── prompts/ (workflow templates)                        │
│  ├── scripts/ (validator shell scripts)                   │
│  └── extensions/ (pi TypeScript extensions)               │
└──────────────────────────────────────────────────────────┘
```

### Key Principle: Export Generation

```
.pi/ (source of truth)
  ├── agent/AGENTS.md       → .claude/CLAUDE.md
  │                         → .opencode/context.md
  │                         → .github/copilot-instructions.md
  ├── skills/agents/*.md    → .claude/agents/{role}/*.md
  │                         → .agents/{role}.md
  │                         → .agents/skills/{name}/SKILL.md
  ├── prompts/*.md          → .claude/workflows/*.md
  └── scripts/              → .claude/scripts/
```

---

## 3. Component Detail

### 3.1 CLI Entry Point (`src/index.ts`)

Pure routing layer. No state.

```
Arguments: parseArgs({ allowPositionals: true, options: {...} })
Commands:  init | generate | update | upgrade | uninstall | info | stats | validate | verify | trust | domain | project
Dispatch:  switch (command) -> runXxx(targetDir, options)
```

### 3.2 Init Command (`src/commands/init.ts`)

Scaffolds the full `.pi/` directory structure and generates exports for selected AI tools.

**Flow:**
1. Check existing framework → overwrite | merge | cancel
2. Run interactive prompts (or use `--nonInteractive` flags)
3. Create `guardian-manifest.json`
4. Scaffold `.pi/` directory: render templates with project context, apply language-specific patterns, filter scripts/validators by selection
5. Generate exports for selected tools (pi, claude, opencode, agents, github)
6. Track all scaffolded files in manifest (atomic write via temp file + rename)

**Interactive Prompts:**
- Project name, version, repository, Git tool (gh/gl)
- AI tools to scaffold (multi-select)
- Language (typescript, python, java, rust, go)
- Validators (ci, tests, operations, security, integration, architecture, canonical)
- Workflows (feature-development, hotfix, release)

### 3.3 Generate Command (`src/commands/generate.ts`)

Regenerates exports from `.pi/` source with reconciliation and retry.

**Flow:**
1. Read manifest → load workflow config (AGENTS.md front matter)
2. **Reconciliation**: detect externally modified exports
3. Run `before_run` hook (fatal on failure)
4. For each tool: export files with canonical reference headers
5. Copy validator scripts → update manifest → run `after_run` hook

**Retry:** Exponential backoff on transient failures (3 attempts, max 5min).

### 3.4 Update Command (`src/commands/update.ts`)

Smart merge of new template versions into existing projects, preserving user edits.

**Change classification:**

| Condition | Action |
|-----------|--------|
| File not in manifest + exists in templates | **add** — render + write |
| File in manifest + hash unchanged | **update** — safe to overwrite |
| File in manifest + hash changed + has YAML front matter | **merge-frontmatter** — user's config stays, new body applied |
| File in manifest + hash changed + no front matter | **preserve** — don't risk losing user content |
| File in manifest + category=generated | **regenerate** — re-generate from `.pi/` |
| File in manifest but NOT in templates | **orphan** — deprecated, don't delete |

### 3.5 Workflow Config (`src/lib/workflow-config.ts`)

Parses YAML front matter from `AGENTS.md`:

```yaml
workspace:
  root: ".pi/workspaces"
  hooks:
    timeout_ms: 60000
    after_create?: string  # shell script
    before_run?: string
    after_run?: string

agent:
  max_turns: 20
  max_retry_backoff_ms: 300000
  stall_timeout_ms: 300000

generate:
  on_conflict: "warn" | "skip" | "overwrite"
  atomic_writes: true

validate:
  fail_fast: false
  timeout_ms: 300000
```

Supports `$VAR_NAME` resolution from `process.env`.

### 3.6 Manifest (`src/lib/manifest.ts`)

Tracks framework state with SHA-256 file hashes:

```
{
  schemaVersion: "1.0",
  frameworkVersion: "0.1.0",
  source: "pi",
  tools: ["pi", "claude", ...],
  language: "typescript",
  files: {
    ".pi/agent/AGENTS.md": {
      category: "user" | "framework" | "generated",
      originalHash: "sha256:...",
      status: "unchanged" | "modified" | "deleted"
    }
  },
  exports: { claude: { path: ".claude/", generatedAt: "ISO-8601", sourceHash: "sha256:..." } },
  tokenStats: { totalTokens: N, byCategory: {...}, byFile: {...} }
}
```

### 3.7 Templates (`src/lib/templates.ts`)

Path-safe template loader with containment validation:

```typescript
findTemplateDir() → resolved path (always within package directory)
renderTemplate(content, context) → substitutes:
  {{PLACEHOLDER}} — direct mapping
  [Title Case]    — camelCase lookup
  [lowercase]     — camelCase lookup
  $VAR_NAME       — process.env[VAR_NAME]
```

### 3.8 Workspace Hooks (`src/lib/workspace-hooks.ts`)

Lifecycle hooks with safety:

| Hook | Timing | Failure |
|------|--------|---------|
| `after_create` | After workspace dir created | Fatal |
| `before_run` | Before generate/export | Fatal |
| `after_run` | After generate/export | Best-effort |
| `before_remove` | Before workspace removal | Logged |

Each runs via `bash -lc <script>` in workspace dir with configurable timeout (default 60s) and stall detection (SIGTERM after 60s of no output). Output truncated at 4KB in logs.

### 3.9 Retry (`src/lib/retry.ts` + `retry-queue.ts`)

Exponential backoff: `delay = min(10000 * 2^(n-1), 300000ms)`, 3 attempts max.

`retry-queue.ts` persists pending retries to `.pi/.guardian-retry-state.json` so operations survive process restarts. Atomic write via temp file + rename.

### 3.10 TOML Filter System (`src/lib/toml-filter.ts`)

Declarative output compression pipeline:

```toml
[[filters]]
name = "logback-pattern"
match = "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}"
replace = "<timestamp>"
cost = 4.0

[[filters.tests]]
input = "2026-05-14 10:30:00 INFO started"
expected = "<timestamp> INFO started"
```

Three tiers: **built-in** (framework defaults) → **global** (`~/.config/guardian/filters.toml`) → **project** (`.pi/validators/*.toml`, trust-gated).

### 3.11 Code Filter (`src/lib/code-filter.ts`)

Language-aware three-level filtering for 11 languages (typescript, python, java, rust, go, csharp, cpp, ruby, php, swift, kotlin).

### 3.12 Trust System (`src/lib/trust.ts`)

SHA-256 hash verification for project-level TOML validators. Must be explicitly trusted before execution.

### 3.13 Tracking (`src/lib/tracking.ts`)

Per-validator token savings tracking with USD estimation. Output via `guardian stats`.

---

## 4. Data Flows

### 4.1 Init Flow

```
User Input (prompts/flags)
    │
    ▼
runInitPrompts() → project metadata (name, version, tools, language, validators)
    │
    ▼
getDefaultContext(language, projectName) → merges language defaults (build/test/lint commands)
    │
    ▼
scaffoldPiDirectory() → for each template: readTemplate() → renderTemplate(context) → write file
    │
    ▼
generateExport() → for each tool: create structure → map & transform files → add canonical header
    │
    ▼
updateManifestAfterScaffold() → add file records → add export records → atomic write
```

### 4.2 Generate Flow

```
runGenerate():
  1. readManifest()
  2. loadWorkflowConfig() — parse AGENTS.md front matter
  3. detectExternallyModifiedExports() → warn/skip/overwrite per config
  4. runBeforeRunHook() — fatal if fails
  5. For each tool: retry(generateExport()) — exponential backoff
  6. Add file records → atomic writeManifest()
  7. runAfterRunHook() — best effort
```

### 4.3 Update Flow

```
runUpdate():
  1. readManifest()
  2. analyzeChanges() — classify each file (add/update/merge/preserve/orphan/regenerate)
  3. If --dryRun: print plan, exit
  4. If not --force: confirm with user
  5. Apply changes: render + write | merge front matter | preserve with status
  6. writeManifest()
  7. If --regenerate: regenerateAllExports()
```

---

## 5. Safety Model

### 5.1 Path Safety

Three mandatory invariants:
1. Agent cwd == workspace path
2. Workspace path must stay under workspace root (validated by `isWorkspacePathSafe()`)
3. Workspace keys sanitized to `[A-Za-z0-9._-]`

Template paths are contained within package directory via `isPathInPackage()` (no CWD fallback).

### 5.2 Hook Safety

| Aspect | Policy |
|--------|--------|
| Execution context | `bash -lc <script>` in workspace directory |
| Timeout | `hooks.timeout_ms` (default 60s) |
| Stall detection | SIGTERM after 60s of no output |
| Secret handling | `$VAR` indirection — env vars never logged |

### 5.3 Reconciliation Safety

```
Conflict Detection:
  - Compare current file hash with stored manifest hash
  - If modified externally → action based on on_conflict setting

User Protection:
  - "warn": shows modified files, proceeds (user can Ctrl-C)
  - "skip": aborts generation
  - "overwrite": proceeds silently (CI/automated use)
```

### 5.4 Trust-Gated TOML Config

Project-level TOML validators and filters require explicit SHA-256 trust before execution. No arbitrary code runs without user approval or prior trust registration.

---

## 6. Extension System (Pi)

Extensions are TypeScript files in `.pi/extensions/` loaded at pi startup. They register tools, commands, and event handlers.

**Extension API surface:**
- `pi.registerTool({ name, label, description, parameters, execute })`
- `pi.registerCommand(name, { description, handler })`
- `pi.on("session_start" | "tool_call" | "tool_result" | ...)`

### Extension Contracts

| Extension | Purpose |
|-----------|---------|
| `bash-guard.ts` | Blocks destructive commands (rm -rf, dd, mkfs) |
| `coordinator.ts` | Scope classification + validation orchestration |
| `goal-loop.ts` | Persistent standing goals with dual validator+LLM judge |
| `kanban.ts` | JSON-backed task board with state machine, dependencies, comments |
| `pipeline.ts` | Multi-step workflow engine with per-step acceptance gates |
| `curator.ts` | Skill lifecycle management: usage tracking, stale detection, archival |
| `domain-explorer.ts` | DDD domain exploration with LLM |
| `project-scaffolder.ts` | Project scaffolding from architecture docs |
| `plan-mode.ts` | Queued edit batch review |
| `hooks.ts` | 3-layer shell-script hooks (pre/post tool, pre/post LLM, lifecycle) |
| `filechanges.ts` | File change tracking with accept/decline |
| `session-persistence.ts` | Session history with auto-titling |
| `snippets.ts` | `#handle` → XML block expansion (70–90% token savings) |
| `redaction.ts` | Auto-strip API keys, tokens, JWTs from output |
| `slash-commands.ts` | `/init`, `/validate`, `/scope`, `/snippet` |
| `read-only-mode.ts` | Safe exploration mode (read-only tools) |
| `architect.ts` | Epic lifecycle management |

---

## 7. Error Handling

| Category | Examples | Recovery |
|----------|----------|----------|
| Config errors | Missing manifest, invalid YAML | Fail startup |
| Template errors | Missing template file | Fail scaffold |
| Filesystem errors | Permission denied, disk full | Fail operation |
| Hook errors | before_run fails | Abort operation |
| Generation errors | Write fails | Retry with backoff, then fail |
| Validation errors | Validator script missing | Log warning, continue |

**Retry applies to:** generate export operations only.
**No retry for:** config validation, template loading, hook failures (fail fast).

---

## 8. What Guardian Can Do

| Capability | How |
|-----------|-----|
| **Scaffold a full AI-assisted dev workflow** | `guardian init` → interactive prompts → full `.pi/` + exports for pi, Claude Code, OpenCode, GitHub Copilot |
| **Generate exports from single source** | `guardian generate` → `.pi/` → `.claude/`, `.opencode/`, `.agents/`, `.github/` |
| **Smart template updates** | `guardian update` → preserves user edits via front-matter merge algorithm |
| **Multi-language project scaffolding** | `guardian project create` → source tree from architecture for 5 languages |
| **Domain-driven exploration** | `guardian domain --explore` → bounded contexts, entities, ubiquitous language |
| **Architecture validation** | 7 validator categories, scope-based auto-selection |
| **Token optimization** | DRY context, snippet expansion, TOML filters, tiered prompts — 50–70% savings |
| **Output compression** | 8-stage TOML filter pipeline for LLM output |
| **Production safety** | Path containment, trust-gated config, hook timeouts, retry with backoff |
| **Multi-tool export** | Single `.pi/` → Claude Code, OpenCode, GitHub Copilot, oh-my-pi |
