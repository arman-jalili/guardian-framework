# GuardianCLI Architecture

**Version:** 2.0
**Status:** Living Document
**Last Updated:** 2026-04-30

---

## 1. Overview

GuardianCLI is a **token-optimized agentic framework scaffolder** that generates deterministic, validated AI-assisted development workflows. It uses a **pi-first architecture** where `.pi/` is the version-controlled source of truth and all other formats (`.claude/`, `.opencode/`, `.agents/`, `.github/`) are generated exports.

### Design Goals

1. **Token efficiency** — 50–65% reduction vs traditional multi-agent workflows
2. **Architecture traceability** — every implementation file references its architecture source
3. **Validation shift-left** — validate plans before code, not after
4. **Pi-first** — single source of truth, multiple export targets
5. **Production safety** — workspace hooks, path invariants, retry with backoff, reconciliation

### Inspirations

GuardianCLI's orchestration model is inspired by the [OpenAI Symphony specification](https://github.com/openai/symphony), adapted for a scaffolding CLI rather than a long-running daemon:

| Symphony Concept | Guardian Adaptation |
|------------------|---------------------|
| `WORKFLOW.md` with YAML front matter | `.pi/agent/AGENTS.md` front matter config |
| Workspace lifecycle hooks | `before_run`/`after_run`/`after_create`/`before_remove` |
| Exponential backoff retry | `retry.ts` with configurable cap |
| Reconciliation before dispatch | External modification detection before overwrite |
| `$VAR` env indirection | Template `$VAR_NAME` resolution from `process.env` |
| Path safety invariants | Workspace root containment + identifier sanitization |
| Stall detection | Hook timeout + no-output stall kill |

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
│  │workspace    │ │retry.ts      │ │logger.ts         │   │
│  │-hooks.ts    │ │(backoff)     │ │(structured JSON) │   │
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
│  ├── skills/ (agent definitions + codex skills)            │
│  ├── prompts/ (workflow templates)                        │
│  ├── scripts/ (validator shell scripts)                   │
│  └── extensions/ (pi TypeScript extensions)               │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Component Detail

### 3.1 CLI Entry Point (`src/index.ts`)

**Responsibility:** Parse command-line arguments, dispatch to command handlers.

```
Arguments: parseArgs({ allowPositionals: true, options: {...} })
Commands:  init | generate | update | upgrade | uninstall | info
Dispatch:  switch (command) → runXxx(targetDir, options)
```

No state. Pure routing layer.

### 3.2 Init Command (`src/commands/init.ts`)

**Responsibility:** Scaffold `.pi/` directory structure and export targets from templates.

```
Flow:
1. Check existing framework → overwrite | merge | cancel
2. Run interactive prompts (or use --nonInteractive flags)
3. Create manifest (guardian-manifest.json)
4. Scaffold .pi/ directory:
   a. Render templates with project context
   b. Apply language-specific patterns
   c. Filter scripts/validators by selection
5. Generate exports for selected tools (claude, opencode, agents, github)
6. Track all scaffolded files in manifest
7. Write manifest (atomic write via temp file + rename)
```

**Export Generation During Init:**

```
.pi/ → .claude/  (CLAUDE.md, agents/, context/, workflows/, scripts/)
.pi/ → .opencode/ (context.md, prompts/*.txt, workflows/)
.pi/ → .agents/  (agents/*.md, context/, scripts/)
.pi/ → .github/  (copilot-instructions.md, agents/, settings.json)
.pi/ → .agents/skills/ (pi skills as SKILL.md packages)
```

### 3.3 Generate Command (`src/commands/generate.ts`)

**Responsibility:** Regenerate exports from `.pi/` source with reconciliation and retry.

```
Flow:
1. Read manifest
2. Load workflow config (AGENTS.md front matter)
3. Reconciliation: detect externally modified exports
   - on_conflict=warn: warn and proceed
   - on_conflict=skip: abort
   - on_conflict=overwrite: proceed silently
4. Ensure workspace directory exists (run after_create hook if new)
5. Run before_run hook (fatal on failure)
6. For each tool:
   a. Create export directory structure
   b. Map .pi/ source files → export target files
   c. Apply transformations (frontmatter stripping, compression)
   d. Add canonical reference header
   e. Retry with exponential backoff on failure
7. Copy validator scripts
8. Update manifest (files + exports + timestamp)
9. Run after_run hook (best effort)
10. Write manifest
```

**Export Mappings (per tool):**

| Source (.pi/) | Claude Export | OpenCode Export | Agents Export | GitHub Export | Pi Export |
|---------------|---------------|-----------------|---------------|---------------|-----------|
| `agent/AGENTS.md` | `CLAUDE.md` | `context.md` | `context/project.md` | `copilot-instructions.md` | — |
| `context/patterns.md` | `context/patterns.md` | `context/patterns.md` | `context/patterns.md` | — | — |
| `skills/agents/*.md` | `agents/{role}/*.md` | `prompts/*.txt` | `agents/*.md` | `agents/*.agent.md` | `skills/*/SKILL.md` |
| `prompts/*.md` | `workflows/*.md` | — | — | — | — |
| `INDEX.md` | `context/INDEX.md` | `INDEX.md` | `INDEX.md` | — | — |

### 3.4 Update Command (`src/commands/update.ts`)

**Responsibility:** Smart merge framework updates, preserving user edits.

```
Flow:
1. Read current manifest
2. Fetch updated templates
3. For each framework file:
   a. Check hash: unchanged → auto-update
   b. Check hash: modified → preserve, show diff
4. Regenerate exports if --regenerate
5. Update manifest
```

### 3.5 Workflow Config (`src/lib/workflow-config.ts`)

**Responsibility:** Parse YAML front matter from `AGENTS.md`, provide typed config with defaults and `$VAR` resolution.

```
Architecture:
1. loadWorkflowConfig(piDir)
   → Read AGENTS.md
   → parseFrontMatter(content)
   → deepMerge(DEFAULTS, frontMatter)
   → validateWorkflowConfig(config)
2. parseFrontMatter(content)
   → Extract YAML block between --- markers
   → parseSimpleYaml(yamlBlock)  // minimal parser, no deps
3. resolveEnvVars(value)
   → Replace $VAR_NAME with process.env[VAR_NAME]
```

**Config Schema:**

```yaml
workspace:
  root: string           # ".pi/workspaces"
  hooks:
    after_create?: string
    before_run?: string
    after_run?: string
    before_remove?: string
    timeout_ms: number    # 60000

agent:
  max_turns: number       # 20
  max_retry_backoff_ms: number   # 300000
  stall_timeout_ms: number       # 300000

generate:
  on_conflict: "overwrite" | "warn" | "skip"   # "warn"
  atomic_writes: boolean                          # true

validate:
  fail_fast: boolean    # false
  timeout_ms: number    # 300000
```

### 3.6 Workspace Hooks (`src/lib/workspace-hooks.ts`)

**Responsibility:** Execute lifecycle hooks with timeout and stall detection.

```
Hook Contract:
- Run in workspace directory (cwd)
- Execute via: bash -lc <script>
- Timeout: hooks.timeout_ms (default 60s)
- Stall detection: SIGTERM after 60s of no stdout/stderr output

Failure Semantics:
- after_create: fatal (abort workspace creation)
- before_run: fatal (abort current operation)
- after_run: logged, ignored (best effort)
- before_remove: logged, cleanup proceeds

Safety Invariants:
- Workspace path MUST stay within workspace root
- Workspace keys sanitized to [A-Za-z0-9._-]
- Hook output truncated at 4KB in logs
```

### 3.7 Retry (`src/lib/retry.ts`)

**Responsibility:** Exponential backoff retry for transient failures.

```
Algorithm:
  attempt 1: delay 0 (immediate)
  attempt 2: delay 10s
  attempt 3: delay 20s
  attempt n: delay min(10000 * 2^(n-1), maxBackoffMs)

Configuration:
  maxAttempts: 3
  maxBackoffMs: 300000 (5 min)
  baseDelayMs: 10000
```

### 3.8 Manifest (`src/lib/manifest.ts`)

**Responsibility:** Track framework state, file hashes, export records, token stats.

```
Structure:
{
  schemaVersion: "1.0",
  frameworkVersion: "1.0.0",
  source: "pi",
  tools: ["pi", "claude", ...],
  language: "typescript",
  validators: ["ci", "tests", ...],
  workflows: ["feature-development", ...],
  files: {
    ".pi/agent/AGENTS.md": {
      category: "user" | "framework" | "generated",
      originalHash: "sha256:...",
      status: "unchanged" | "modified" | "deleted"
    }
  },
  exports: {
    claude: {
      path: ".claude/",
      generatedAt: "ISO-8601",
      sourceHash: "sha256:..."
    }
  },
  tokenStats: {
    totalTokens: number,
    byCategory: { user: N, framework: N, generated: N },
    byFile: { ".pi/agent/AGENTS.md": N, ... },
    lastCalculatedAt: "ISO-8601"
  },
  scaffoldedAt: "ISO-8601",
  lastUpdatedAt: "ISO-8601"
}
```

**File Categories:**
- `user` — user-editable (AGENTS.md, project.md, patterns.md)
- `framework` — Guardian-controlled (scripts, extensions, architecture docs)
- `generated` — generated exports (.claude/, .opencode/, .agents/)

### 3.9 Templates (`src/lib/templates.ts`)

**Responsibility:** Load template files, render with context, apply language patterns.

```
Template Resolution:
1. findTemplateDir() — try dist/../, src/../, linked bin, cwd
2. getPiTemplateFiles() — walk templates/pi/ recursively
3. readTemplate(path) — read file content
4. renderTemplate(content, context) — substitute placeholders

Placeholder Formats:
- {{PLACEHOLDER}} — uppercase (e.g., {{PROJECTNAME}})
- [Project Name] — title case (e.g., [Build Command])
- [project name] — lowercase (e.g., [build command])
- $VAR_NAME — env var from process.env

Language Patterns:
- templates/languages/{typescript,rust,python,go}-patterns.md
- Auto-selected during init based on language
- Rendered into .pi/context/patterns.md
```

### 3.10 Logger (`src/lib/logger.ts`)

**Responsibility:** Structured JSON logging with context.

```
Output: JSON lines to stderr

Format:
{"timestamp":"ISO-8601","level":"info|warn|error|debug","message":"...","context":{...}}

Helpers:
- logger.issue(issueId, message, context) — adds issue_id to context
- logger.tool(tool, message, context) — adds tool name to context
- logger.action(action, outcome, reason?) — structured action logging
```

---

## 4. Data Flow

### 4.1 Init Flow

```
User Input (prompts/flags)
    │
    ▼
┌─ runInitPrompts() ──────────────────────────────────────────┐
│  projectName, version, type, repository, repoTool, tools,    │
│  language, validators, workflows                             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─ getDefaultContext(language, projectName, repoTool) ───────┐
│  Merges language defaults (build/test/lint/format commands, │
│  error handling patterns, tracing patterns, etc.)           │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─ scaffoldPiDirectory() ────────────────────────────────────┐
│  For each template file:                                    │
│    readTemplate() → renderTemplate(context) → write file    │
│  Apply language patterns → context/patterns.md              │
│  Write INDEX.md, README.md                                  │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─ generateExport() (for each tool != pi) ───────────────────┐
│  createExportStructure() → getExportMappings() →            │
│  copy+transform files → add canonical header                │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─ updateManifestAfterScaffold() ─────────────────────────────┐
│  Add file records → add export records → write manifest     │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Generate Flow

```
┌─ runGenerate() ─────────────────────────────────────────────┐
│                                                              │
│  1. readManifest()                                          │
│  2. loadWorkflowConfig() → parse AGENTS.md front matter     │
│  3. detectExternallyModifiedExports() → warn/skip/overwrite │
│  4. ensureWorkspace() + runAfterCreateHook()                │
│  5. runBeforeRunHook()  ← fatal if fails                    │
│  6. for each tool:                                          │
│     a. retry(generateExport())  ← exponential backoff       │
│     b. addExportRecord()                                    │
│  7. for each generated file: addFileRecord()                │
│  8. writeManifest() (atomic)                                │
│  9. runAfterRunHook()  ← best effort                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Reconciliation Flow

```
┌─ detectExternallyModifiedExports() ────────────────────────┐
│                                                              │
│  For each tool in toolsToGenerate:                          │
│    For each file in manifest.files starting with .{tool}/:  │
│      Read current file content                              │
│      Compute current hash                                   │
│      Compare with stored hash (isFileModified)              │
│      If modified → add to modified list                     │
│                                                              │
│  Return list of modified file paths                         │
│                                                              │
│  Action based on generate.on_conflict:                      │
│    "warn"    → log warning, proceed                         │
│    "skip"    → abort generation                             │
│    "overwrite" → proceed silently                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Template System

### 5.1 Directory Layout

```
templates/pi/
├── agent/
│   └── AGENTS.md              ← Project instructions + YAML front matter config
├── architecture/
│   ├── CHANGELOG.md           ← Architecture change log template
│   ├── decisions/
│   │   └── ADR-template.md    ← ADR template
│   ├── diagrams/
│   │   └── system-overview.md ← System diagram template
│   └── modules/
│       └── module-template.md ← Module doc template
├── context/
│   ├── checklists.md          ← Validation checklists
│   ├── output-formats.md      ← Report templates
│   ├── patterns-base.md       ← Base patterns (all languages)
│   ├── patterns.md            ← Language-specific patterns (overwritten)
│   └── project.md             ← Project facts template
├── extensions/                ← Pi TypeScript extensions
│   ├── ask-user-question.ts   ← Structured question tool
│   ├── bash-guard.ts          ← Destructive command blocking
│   ├── coordinator.ts         ← Scope + validation tools
│   ├── filechanges.ts         ← File change tracking
│   ├── read-only-mode.ts      ← Safe exploration mode
│   └── validation-runner.ts   ← Validation command
├── github/                    ← GitHub Copilot CLI templates
├── prompts/                   ← Workflow templates (16 files)
├── scripts/                   ← Validator shell scripts (13 files)
├── skills/
│   ├── agents/                ← Agent definitions (15 files)
│   └── validators/            ← Validator definitions (6 files)
├── INDEX.md                   ← Quick reference
└── README.md                  ← Framework docs
```

### 5.2 Placeholder Substitution

```
Template:  [Build Command] → Context: buildCommand → "bun build ./src/index.ts --outdir ./dist"
Template:  {{PROJECTNAME}}  → Context: projectName  → "my-project"
Template:  $GITHUB_TOKEN    → process.env           → "ghp_..." (if set)

Supported placeholder formats:
  {{UPPERCASE}}       → Direct mapping
  [Title Case]        → camelCase → "Title Case" conversion
  [lowercase]         → camelCase → "lowercase" conversion
  $VAR_NAME           → process.env[VAR_NAME] (explicit only)

Aliases:
  [audit command]     → securityAuditCommand
  [build command]     → buildCommand
  [format command]    → formatCommand
  [format check command] → formatCheckCommand
  [lint command]      → lintCommand
  [security audit command] → securityAuditCommand
  [test command]      → testCommand
```

### 5.3 Export Transformation

```
Source: .pi/skills/agents/architecture-coordinator.md
  → Claude:    .claude/agents/orchestrators/architecture-coordinator.md  (copy + header)
  → OpenCode:  .opencode/prompts/architecture-coordinator.txt           (strip frontmatter)
  → Agents:    .agents/architecture-coordinator.md                      (copy + header)
  → GitHub:    .github/agents/architecture-coordinator.agent.md         (add YAML frontmatter)
  → Pi Skills: .agents/skills/architecture-coordinator/SKILL.md         (copy + header)

Source: .pi/prompts/feature-development.md
  → Claude:    .claude/workflows/feature-development.md  (copy + header)
  → Others:    not exported
```

---

## 6. Extension System

### 6.1 Pi Extensions

Extensions are TypeScript files in `.pi/extensions/` loaded by pi at startup. They register tools, commands, and event handlers.

```typescript
export default function (pi: ExtensionAPI) {
  // Register a tool (callable by the agent)
  pi.registerTool({
    name: "my_tool",
    label: "My Tool",
    description: "...",
    parameters: Type.Object({...}),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // ...
      return { content: [{ type: "text", text: "result" }] };
    },
  });

  // Register a command (user-invoked: /my_command)
  pi.registerCommand("my_command", {
    description: "...",
    handler: async (args, ctx) => { /* ... */ },
  });

  // Listen to events
  pi.on("session_start", async (event, ctx) => { /* ... */ });
  pi.on("tool_call", async (event, ctx) => { /* ... */ });
  pi.on("tool_result", async (event, ctx) => { /* ... */ });
}
```

### 6.2 Extension Contracts

| Extension | Tools Registered | Commands Registered | Events Listened |
|-----------|-----------------|---------------------|-----------------|
| `bash-guard.ts` | — | — | `tool_call` (bash) |
| `coordinator.ts` | guardian_scope, guardian_validate, guardian_coordinate | — | `session_start`, `tool_call` (bash) |
| `filechanges.ts` | — | filechanges, filechanges-accept, filechanges-decline | session_start, session_switch, session_fork, tool_call, tool_result |
| `read-only-mode.ts` | read, grep, find, ls (override) | read-only | before_agent_start, tool_call, session_start/switch/fork |
| `ask-user-question.ts` | ask_user_question | — | — |
| `validation-runner.ts` | — | validate | session_start |

### 6.3 Tool Result Format

Pi expects tool results to have `{ content: [{ type: "text", text: "..." }] }`. Returning `{ type: "success", result: {...} }` causes a crash in pi's renderer.

```typescript
// ✅ Correct
return { content: [{ type: "text", text: "Scope: **moderate**\n- Files: 3" }] };

// ❌ Wrong (crashes pi renderer)
return { type: "success", result: { scope: "moderate", fileCount: 3 } };
```

---

## 7. Safety Model

### 7.1 Path Safety

Three mandatory invariants (from Symphony spec Section 9.5):

1. **Agent cwd == workspace path** — generate/export operations run in the project directory
2. **Workspace path MUST stay under workspace root** — validated by `isWorkspacePathSafe()`
3. **Workspace keys sanitized to `[A-Za-z0-9._-]`** — enforced by `sanitizeWorkspaceKey()`

### 7.2 Hook Safety

| Aspect | Policy |
|--------|--------|
| Execution context | `bash -lc <script>` in workspace directory |
| Timeout | `hooks.timeout_ms` (default 60s) |
| Stall detection | SIGTERM after 60s of no stdout/stderr output |
| Output logging | Truncated at 4KB per hook |
| Secret handling | `$VAR` indirection — env vars never logged |

### 7.3 Reconciliation Safety

```
Conflict Detection:
  - Compare current file hash with stored manifest hash
  - If modified externally → action based on on_conflict setting

User Protection:
  - "warn": shows modified files, proceeds (user can Ctrl-C)
  - "skip": aborts generation, tells user to use --force
  - "overwrite": proceeds silently (for CI/automated use)
```

### 7.4 Extension Safety

| Extension | Trust Boundary | Approval Required |
|-----------|---------------|-------------------|
| `bash-guard.ts` | Blocks destructive commands | User chooses Run/Abort in TUI |
| `read-only-mode.ts` | Restricts tool access | User toggles /read-only |
| `filechanges.ts` | Tracks changes only | User accepts/declines |

---

## 8. Token Accounting

### 8.1 Estimation

```
Algorithm: tokens ≈ ceil(text.length / 4)
Accuracy: ±15% vs actual LLM tokenization
Purpose: Relative comparison, not billing
```

### 8.2 Stats Collection

```
TokenStats:
  totalTokens: sum of all file token estimates
  byCategory: { user: N, framework: N, generated: N }
  byFile: { ".pi/agent/AGENTS.md": N, ... }
  lastCalculatedAt: ISO-8601 timestamp

Calculated during:
  - init: after scaffolding all files
  - info: on demand
```

---

## 9. Error Handling

### 9.1 Error Classes

| Category | Examples | Recovery |
|----------|----------|----------|
| Config errors | Missing manifest, invalid YAML | Fail startup, emit error |
| Template errors | Missing template file | Fail scaffold, emit error |
| Filesystem errors | Permission denied, disk full | Fail operation, emit error |
| Hook errors | before_run fails | Abort operation, emit error |
| Generation errors | Write fails | Retry with backoff, then fail |
| Validation errors | Validator script missing | Log warning, continue |

### 9.2 Retry Policy

```
Retry applies to:
  - generate export operations

Retry does NOT apply to:
  - Config validation (fail fast)
  - Template loading (fail fast)
  - Hook failures (fail fast for before_run/after_create)

Backoff formula:
  delay = min(10000 * 2^(attempt-1), 300000)
  maxAttempts = 3
```

---

## 10. Testing Strategy

### 10.1 Current Tests

```
tests/uninstall.test.ts — 5 tests
  - Plans only manifest-managed files
  - Detects modified files before removal
  - Accepts records with only currentHash
  - Blocks records with no comparable hash
  - Applies uninstall plan safely

tests/templates.test.ts — 5 tests
  - Renders command placeholders
  - Uses plural tests validator
  - Preserves scaffold template context
  - Pi extensions are self-contained (no external imports)
  - Pi templates don't point at generated script folders
```

### 10.2 Test Philosophy

- **No external dependencies** in extensions (verified by test)
- **Self-contained** TypeScript — no `@mariozechner/pi-coding-agent` imports in templates
- **Deterministic** template rendering — same context always produces same output

---

## 11. Future Work

| Priority | Feature | Description |
|----------|---------|-------------|
| 🔴 | Dynamic config reload | File watch on AGENTS.md, re-apply without restart |
| 🔴 | Persist retry queue | Survive process restarts |
| 🟡 | HTTP observability | `GET /api/v1/state` for runtime snapshot |
| 🟡 | Pluggable trackers | Beyond GitHub/GitLab (Linear, Jira) |
| 🟡 | Tracker write APIs | State transitions, comments from orchestrator |
| 🟢 | SSH worker extension | Execute agent runs on remote hosts |
| 🟢 | Token billing | Accurate tokenization vs estimation |

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| **pi-first** | `.pi/` is the source of truth; other formats are generated exports |
| **Canonical Reference** | Comment/header in implementation files pointing to architecture docs |
| **WORKFLOW.md** | Symphony term — single file containing config (front matter) + prompt (body) |
| **ADRs** | Architecture Decision Records — documented design decisions |
| **Workpad** | Persistent session progress tracker (plan, AC, validation, notes) |
| **Skill** | Self-contained agent definition with front matter + body |
| **Extension** | TypeScript plugin for pi (tools, commands, event handlers) |
| **Reconciliation** | Checking external state before overwriting (detects drift) |
| **Workspace** | Isolated directory for agent execution (within workspace root) |
