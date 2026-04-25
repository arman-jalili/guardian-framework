# GuardianCLI — Design Specification

**Version:** 2.0.0
**Date:** 2026-04-25
**Status:** Final Draft
**Architecture:** Pi-First (Source of Truth)

---

## Overview

GuardianCLI is a CLI tool that scaffolds token-optimized agent frameworks for AI-assisted development. It enables developers to set up deterministic, validated workflows across multiple AI tools with a single command.

### Pi-First Architecture

GuardianCLI uses **pi as its native format and source of truth**. Other tool formats (`.claude/`, `.opencode/`, `.agents/`) are generated exports from the pi source.

| Tool | Status | Capabilities |
|------|--------|--------------|
| **pi** | Source of truth | Full features: extensions, skills, prompts, shell scripts |
| Claude Code | Generated export | Static subset: .md files, shell scripts (manual execution) |
| OpenCode | Generated export | Static subset: .txt prompts, shell scripts (manual execution) |
| Antigravity | Generated export | Static subset: .md files, shell scripts (manual execution) |

### Problem Statement

Multi-agent workflows produce excellent results but burn tokens quadratically. Developers need:
- A way to scaffold validated agent frameworks quickly
- Consistent structure across projects
- Easy updates when framework evolves
- Support for multiple AI tools
- **Integrated validation** (not just external scripts)

### Solution

GuardianCLI provides:
- Interactive scaffold with prompts for tool, language, validators, workflows
- **pi-native extensions** for integrated validation execution
- Smart merge updates that preserve user customizations
- Version migration for structural changes
- Template-based generation from proven patterns
- **Single source (pi) → multiple exports (claude, opencode, agents)**

---

## Clarifications

### 1. Template Source

Templates are **generic** and come from the Rigorix framework:

| Source | Status | Evidence |
|--------|--------|----------|
| `.claude/context/project.md` | Generic | Line 4: `> **Generic:** Replace bracketed placeholders` |
| `.claude/scripts/*.sh` | Generic | Placeholder commands like `[build command]` |
| `.claude/agents/*.md` | Generic | No project-specific content |
| `.claude/workflows/*.md` | Generic | Reusable workflow templates |

**Implementation:** Copy templates from Rigorix `~/project/rigorix/.claude/` → `~/project/guardian-cli/templates/pi/`. Templates have placeholders that users fill in during scaffold.

**Template placeholders:**

| Placeholder | Example | Filled by |
|-------------|---------|-----------|
| `[Project Name]` | User's project | Interactive prompt or `--lang` |
| `[build command]` | `cargo build` | Language-specific defaults |
| `[test command]` | `cargo test` | Language-specific defaults |
| `[lint command]` | `cargo clippy` | Language-specific defaults |
| `[audit command]` | `cargo audit` | Language-specific defaults |

### 2. npm Package Naming

**Package name:** `guardian-cli` (no scope)

| Scenario | Recommendation |
|----------|----------------|
| Private use | Works fine with unscoped name |
| Open source later | Can keep `guardian-cli` or migrate to `@guardian/cli` |
| Name collision risk | Low — `guardian-cli` not currently on npm |

**Effect on implementation:** None. Package name is purely branding/namespace. The CLI commands work identically:

```bash
npx guardian-cli init
bunx guardian-cli init
```

**If publishing later:** Use npm publish without scope. Can migrate to scoped package (`@guardian/cli`) if community grows, with backwards-compatibility alias.

### 3. Pi Extension API

**Actual pi API from [official docs](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md):**

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("event_name", async (event, ctx) => {...});
  pi.registerTool({...});
  pi.registerCommand("name", {...});
}
```

**Key differences from initially assumed API:**

| Initially Assumed | Actual pi API |
|-------------------|---------------|
| `interface Extension { name, commands, hooks }` | Factory function `(pi: ExtensionAPI) => void` |
| `ctx.run(command)` | Use `pi.registerTool()` + `node:child_process` |
| `ctx.readFile()` | Use `node:fs` directly |
| `ctx.manifest` | Load via `node:fs` in `session_start` event |
| `commands` object | `pi.registerCommand("name", {...})` |
| `hooks` object | `pi.on("event", handler)` |

**Impact:** Extension specifications in this doc are written using the actual pi API. Implementation will use:

- `pi.on("session_start", ...)` — Initialize state
- `pi.on("tool_call", ...)` — Intercept tool calls
- `pi.registerTool(...)` — LLM-callable validation tools
- `pi.registerCommand(...)` — User commands like `/validate`
- `node:fs`, `node:crypto`, `node:child_process` — Built-in Node.js modules

**Pi resources:**

| Resource | URL |
|----------|-----|
| Extensions docs | https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md |
| Examples | https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/ |
| Pi package docs | https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/packages.md |

---

## Core Principles

| Principle | Implementation |
|-----------|----------------|
| **DRY Context** | Single pi source, generated exports for other tools |
| **Shift-Left Validation** | Validate at plan time, inherit post-code |
| **Automated Validators** | pi extensions run validation; others use shell scripts manually |
| **Token Optimization** | 50-65% reduction vs traditional multi-agent |
| **Multi-Tool Support** | pi (native), Claude Code, OpenCode, Antigravity (exports) |
| **Pi Philosophy** | Minimal core, maximum extensibility |

---

## Technical Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Runtime | Bun | Native TypeScript, fast startup |
| Prompts | `@clack/prompts` | Industry standard, beautiful UX |
| Templates | File-based (pi source) | Easy updates, generates other formats |
| Distribution | npm | `npx guardian-cli` or `bunx guardian-cli` |
| Validation | pi extensions + shell scripts | Extensions run inside pi, scripts for other tools |

### Dependencies

```json
{
  "dependencies": {
    "@clack/prompts": "^0.7.0"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

---

## Architecture

### Pi as Source of Truth

All framework content originates in `templates/pi/`. Other formats are generated exports.

**Generation Flow:**

```
templates/pi/                    # SOURCE OF TRUTH
    │
    ├─── generator.ts ───────────┬──→ .claude/  (static .md export)
    │                            ├──→ .opencode/ (static .txt export)
    │                            └──→ .agents/   (static .md export)
    │
    └─── User edits pi source → regenerate exports
```

### Tool Directory Mapping

| CLI Tool Option | Output Directory | Source | Features |
|-----------------|------------------|--------|----------|
| `pi` | `.pi/` | `templates/pi/` | **Full**: extensions, skills, prompts, scripts |
| `claude` | `.claude/` | Generated from pi | Static: .md agents, scripts (manual) |
| `opencode` | `.opencode/` | Generated from pi | Static: .txt prompts, scripts (manual) |
| `agents` | `.agents/` | Generated from pi | Static: .md agents, scripts (manual) |

### Pi Source Structure

```
templates/pi/                     # SOURCE OF TRUTH
├── agent/
│   ├── AGENTS.md                 # Project instructions (→ context/project.md)
│   └── SYSTEM.md                 # System prompt override (optional)
│
├── skills/
│   ├── validators/               # Validation skills
│   │   ├── ci.md                 # CI validation skill
│   │   ├── test.md               # Test validation skill
│   │   ├── security.md           # Security validation skill
│   │   └── operations.md         # Operations validation skill
│   │   └── integration.md        # Integration validation skill
│   │
│   └── agents/                   # Agent definitions as skills
│       ├── architecture-coordinator.md
│       ├── architecture-validator.md
│       ├── security-validator.md
│       ├── operations-validator.md
│       ├── test-validator.md
│       ├── integration-validator.md
│       ├── ci-mr-validator.md
│       ├── code-developer.md
│       ├── issue-creator.md
│       └── documentation-maintainer.md
│
├── prompts/                      # Workflows as prompt templates
│   ├── feature.md                # /feature command
│   ├── bugfix.md                 # /bugfix command
│   ├── hotfix.md                 # /hotfix command
│   ├── refactoring.md            # /refactoring command
│   └── issue-implementation.md   # /issue-impl command
│
├── extensions/                   # TypeScript extensions (pi-only)
│   ├── validation-runner.ts      # Runs shell validators inside pi
│   ├── guardian-manifest.ts      # Manifest handling
│   ├── smart-merge.ts            # Update logic
│   └── scope-classifier.ts       # Task scope classification
│
├── scripts/                      # Shell scripts (called by extensions)
│   ├── validate-ci.sh            # CI validation
│   ├── validate-tests.sh         # Test validation
│   ├── validate-operations.sh    # Operations validation
│   ├── validate-security.sh      # Security validation
│   └── validation-cache.sh       # Retry optimization
│
├── context/                      # Shared context files
│   ├── checklists.md             # Validation checklists
│   └── output-formats.md         # Report templates
│
└── INDEX.md                      # Quick reference
```

### Generated Export: Claude Code

```
.claude/                          # GENERATED from templates/pi/
├── context/
│   ├── project.md                ← pi/agent/AGENTS.md
│   ├── patterns.md               ← pi/skills/validators + languages/
│   ├── checklists.md             ← pi/context/checklists.md
│   └── output-formats.md         ← pi/context/output-formats.md
│
├── agents/
│   ├── orchestrators/
│   │   └── architecture-coordinator.md  ← pi/skills/agents/architecture-coordinator.md
│   ├── validators/
│   │   ├── architecture-validator.md     ← pi/skills/agents/
│   │   ├── security-validator.md         ← pi/skills/agents/
│   │   ├── operations-validator.md       ← pi/skills/agents/
│   │   ├── test-validator.md             ← pi/skills/agents/
│   │   ├── integration-validator.md      ← pi/skills/agents/
│   │   └── ci-mr-validator.md            ← pi/skills/agents/
│   └── implementers/
│       ├── code-developer.md             ← pi/skills/agents/
│       ├── issue-creator.md              ← pi/skills/agents/
│       └── documentation-maintainer.md   ← pi/skills/agents/
│
├── workflows/
│   ├── feature-development.md    ← pi/prompts/feature.md
│   ├── bug-fix.md                ← pi/prompts/bugfix.md
│   ├── hotfix.md                 ← pi/prompts/hotfix.md
│   └── refactoring.md            ← pi/prompts/refactoring.md
│
├── scripts/                      ← pi/scripts/ (copied)
│   ├── validate-ci.sh
│   ├── validate-tests.sh
│   ├── validate-operations.sh
│   ├── validate-security.sh
│   └── validation-cache.sh
│
├── INDEX.md                      ← pi/INDEX.md
└── README.md                     ← Generated summary
```

### Generated Export: OpenCode

```
.opencode/                        # GENERATED from templates/pi/
├── context/
│   ├── project.md                ← pi/agent/AGENTS.md
│   ├── patterns.md               ← pi/skills/validators + languages/
│   ├── checklists.md             ← pi/context/checklists.md
│   └── output-formats.md         ← pi/context/output-formats.md
│
├── prompts/                      ← pi/skills/agents (as .txt)
│   ├── architecture-coordinator.txt
│   ├── architecture-validator.txt
│   ├── security-validator.txt
│   ├── [other agents as .txt]
│
├── workflows/                    ← pi/prompts/
│   ├── feature-development.md
│   ├── bug-fix.md
│   ├── hotfix.md
│   └── refactoring.md
│
├── scripts/                      ← pi/scripts/ (copied)
│
├── INDEX.md
└── README.md
```

### Generated Export: Antigravity (.agents/)

```
.agents/                          # GENERATED from templates/pi/
├── agents/                       ← pi/skills/agents (flat structure)
│   ├── architecture-coordinator.md
│   ├── architecture-validator.md
│   ├── security-validator.md
│   ├── operations-validator.md
│   ├── test-validator.md
│   ├── integration-validator.md
│   ├── ci-mr-validator.md
│   ├── code-developer.md
│   ├── issue-creator.md
│   └── documentation-maintainer.md
│
├── workflows/                    ← pi/prompts/
│   ├── feature-development.md
│   ├── bug-fix.md
│   ├── hotfix.md
│   └── refactoring.md
│
├── context/
│   ├── project.md                ← pi/agent/AGENTS.md
│   ├── patterns.md               ← pi/skills/validators + languages/
│   ├── checklists.md             ← pi/context/checklists.md
│   └── output-formats.md         ← pi/context/output-formats.md
│
├── scripts/                      ← pi/scripts/ (copied)
│
├── INDEX.md
└── README.md
```

### Language Patterns

```
templates/languages/              # Shared across all exports
├── rust-patterns.md
├── typescript-patterns.md
├── python-patterns.md
├── go-patterns.md
└── custom-patterns.md           # Placeholder for custom language
```

### Feature Comparison: pi vs Exports

| Feature | pi (Source) | Claude | OpenCode | .agents |
|---------|-------------|--------|----------|---------|
| **Extensions** (TypeScript) | ✅ Run inside pi | ❌ | ❌ | ❌ |
| **Skills** (on-demand load) | ✅ Full skills API | Static .md | Static .txt | Static .md |
| **Prompt templates** (/commands) | ✅ `/feature`, `/bugfix` | Static .md | Static .md | Static .md |
| **Shell scripts** | ✅ Called by extensions | Manual run | Manual run | Manual run |
| **Smart merge** | ✅ Package update | CLI checksum | CLI checksum | CLI checksum |
| **AGENTS.md/SYSTEM.md** | ✅ Full context engineering | Static project.md | Static project.md | Static project.md |
| **Session trees** | ✅ Native | ❌ | ❌ | ❌ |
| **Model switching** | ✅ `/model`, Ctrl+L | ❌ | ❌ | ❌ |

---

## Directory Structure (GuardianCLI)

```
guardian-cli/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/
│   │   ├── init.ts           # Scaffold command
│   │   ├── update.ts         # Smart merge update
│   │   ├── upgrade.ts        # Version migration
│   │   ├── info.ts           # Status display
│   │   └── generate.ts       # Export generator (pi → other formats)
│   ├── prompts/
│   │   ├── tool-select.ts    # AI tool selection
│   │   ├── language-select.ts # Language/framework selection
│   │   ├── validator-select.ts # Validator selection
│   │   └── workflow-select.ts # Workflow selection
│   ├── scaffold/
│   │   ├── generator.ts      # Template rendering
│   │   ├── exporter.ts       # Pi → Claude/OpenCode/Agents export
│   │   ├── file-writer.ts    # Atomic writes
│   │   ├── merge.ts          # Smart merge logic
│   │   ├── diff.ts           # Diff display
│   │   └── checksum.ts       # File hash calculation
│   ├── templates/
│   │   ├── pi/               # SOURCE OF TRUTH (see structure above)
│   │   ├── languages/        # Language-specific patterns
│   │   └── migrations/       # Version migration scripts
│   ├── config/
│   │   ├── version.ts        # Current framework version
│   │   ├── manifest.ts       # Manifest schema definition
│   │   ├── categories.ts     # File categorization rules
│   │   └── exit-codes.ts     # CLI exit codes
│   │   └── mappings.ts       # Pi → export mappings
│   └── utils/
│       ├── logger.ts         # Pretty console output
│       ├── validators.ts     # Input validation
│       ├── file-utils.ts     # Atomic writes, directory checks
│       ├── diff.ts           # Diff generation
│       └── checksum.ts       # SHA-256 file hashing
│
├── package.json
├── bun.lock
├── tsconfig.json
└── README.md
```

---

## Generation Mappings

### File Mapping: Pi → Claude

| Pi Source | Claude Destination | Transformation |
|-----------|--------------------|----------------|
| `pi/agent/AGENTS.md` | `.claude/context/project.md` | Copy |
| `pi/agent/SYSTEM.md` | ❌ Not exported | pi-only (system prompt override) |
| `pi/skills/agents/*.md` | `.claude/agents/**/*.md` | Nest into orchestrators/validators/implementers |
| `pi/skills/validators/*.md` | `.claude/context/patterns.md` | **Merge**: Append to language patterns |
| `pi/prompts/*.md` | `.claude/workflows/*.md` | Copy |
| `pi/scripts/*.sh` | `.claude/scripts/*.sh` | Copy |
| `pi/context/checklists.md` | `.claude/context/checklists.md` | Copy |
| `pi/context/output-formats.md` | `.claude/context/output-formats.md` | Copy |
| `pi/extensions/*.ts` | ❌ Not exported | pi-only feature |
| `languages/*.md` | `.claude/context/patterns.md` | **Merge**: Base patterns + validator skills |
| `pi/INDEX.md` | `.claude/INDEX.md` | Copy |
| (generated) | `.claude/README.md` | Generated from manifest + INDEX.md |

**patterns.md Merge Logic:**

```typescript
// Merge: language patterns + validator skills
const languagePatterns = await read(`languages/${lang}-patterns.md`);
const validatorSkills = await glob('pi/skills/validators/*.md');
const merged = languagePatterns + '\n\n## Validator Patterns\n\n' +
  validatorSkills.map(s => `### ${s.name}\n${s.content}`).join('\n\n');
await write('.claude/context/patterns.md', merged);
```

### File Mapping: Pi → OpenCode

| Pi Source | OpenCode Destination | Transformation |
|-----------|----------------------|----------------|
| `pi/agent/AGENTS.md` | `.opencode/context/project.md` | Copy |
| `pi/agent/SYSTEM.md` | ❌ Not exported | pi-only |
| `pi/skills/agents/*.md` | `.opencode/prompts/*.txt` | Convert to .txt |
| `pi/skills/validators/*.md` | `.opencode/context/patterns.md` | Merge with language patterns |
| `pi/prompts/*.md` | `.opencode/workflows/*.md` | Copy |
| `pi/scripts/*.sh` | `.opencode/scripts/*.sh` | Copy |
| `pi/context/*.md` | `.opencode/context/*.md` | Copy |
| `pi/extensions/*.ts` | ❌ Not exported | pi-only feature |
| `languages/*.md` | `.opencode/context/patterns.md` | Merge with validator skills |
| `pi/INDEX.md` | `.opencode/INDEX.md` | Copy |
| (generated) | `.opencode/README.md` | Generated from manifest + INDEX.md |

### File Mapping: Pi → .agents

| Pi Source | .agents Destination | Transformation |
|-----------|--------------------|----------------|
| `pi/agent/AGENTS.md` | `.agents/context/project.md` | Copy |
| `pi/agent/SYSTEM.md` | ❌ Not exported | pi-only |
| `pi/skills/agents/*.md` | `.agents/agents/*.md` | Copy flat |
| `pi/skills/validators/*.md` | `.agents/context/patterns.md` | Merge with language patterns |
| `pi/prompts/*.md` | `.agents/workflows/*.md` | Copy |
| `pi/scripts/*.sh` | `.agents/scripts/*.sh` | Copy |
| `pi/context/*.md` | `.agents/context/*.md` | Copy |
| `pi/extensions/*.ts` | ❌ Not exported | pi-only feature |
| `languages/*.md` | `.agents/context/patterns.md` | Merge with validator skills |
| `pi/INDEX.md` | `.agents/INDEX.md` | Copy |
| (generated) | `.agents/README.md` | Generated from manifest + INDEX.md |

**README.md Generation:**

```typescript
// Generate README.md for each export
const manifest = await readManifest();
const indexContent = await read('pi/INDEX.md');

const readme = `# GuardianCLI Framework (${tool})

Generated from .pi/ source at ${manifest.lastUpdatedAt}

## Quick Reference
${indexContent}

## Configuration
- Language: ${manifest.language}
- Validators: ${manifest.validators.join(', ')}
- Workflows: ${manifest.workflows.join(', ')}

## Commands
- \`npx guardian-cli generate --tool ${tool}\` — Regenerate from .pi/
- \`npx guardian-cli update\` — Update .pi/ source

---

Generated by GuardianCLI v${manifest.frameworkVersion}
`;

await write(`${exportDir}/README.md`, readme);
```

---

## Commands

### init

**Usage:**
```bash
npx guardian-cli init [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--dir <path>` | Target directory | Current directory |
| `--tool <name>` | AI tool (pi, claude, opencode, agents) | Interactive prompt |
| `--lang <name>` | Language (rust, typescript, python, go, custom) | Interactive prompt |
| `--validators <list>` | Validators (comma-separated) | Interactive prompt |
| `--workflows <list>` | Workflows (comma-separated) | Interactive prompt |
| `--non-interactive` | Use defaults/flags, skip prompts | false |

**Interactive Prompts:**

1. **Directory check:** If framework exists, ask to overwrite or merge
2. **Tool selection:** Multi-select (pi, claude, opencode, agents)
   - **pi recommended** with hint: "Full features: extensions, skills"
   - Others shown as: "Static export (no extensions)"
3. **Language selection:** Single-select with custom option
4. **Validator selection:** Multi-select, **CI pre-selected and locked**
5. **Workflow selection:** Multi-select (all optional)
6. **Confirmation:** Summary + confirm

**Non-Interactive Mode Defaults:**

| Flag | Default | Requirement |
|------|---------|-------------|
| `--tool` | `pi` | Optional, defaults if not provided |
| `--lang` | `null` | **Required** — must be explicitly provided |
| `--validators` | `ci` | Minimum required, CI always included |
| `--workflows` | `[]` | Optional, empty if not provided |

**Multi-Tool Scaffold:**

If user selects multiple tools:
```
User selects: pi, claude

Output:
  .pi/          (pi source - full features)
  .claude/      (generated export - static files)
  guardian-manifest.json (tracks both)
```

**Scaffold Process for pi:**

1. Copy `templates/pi/` to `.pi/`
2. Apply language selection (copy patterns.md)
3. Apply validator selection (filter scripts)
4. Apply workflow selection (filter prompts)
5. Write manifest with checksums

**Scaffold Process for Claude/OpenCode/Agents:**

1. Scaffold `.pi/` first (if not already selected, scaffold hidden as source)
2. Run exporter: `.pi/` → `.claude/` (or other)
3. User edits `.pi/` → regenerate exports with `guardian-cli generate`

**Output:**
- `.pi/` directory (source)
- `.claude/`/`.opencode/`/`.agents/` (if selected, generated exports)
- `guardian-manifest.json` with configuration

### generate

**Usage:**
```bash
npx guardian-cli generate [options]
```

**Purpose:** Regenerate exports from `.pi/` source after user edits.

**Options:**
| Option | Description |
|--------|-------------|
| `--tool <name>` | Target tool (claude, opencode, agents) or "all" |
| `--dry-run` | Show what would be generated without writing |
| `--force` | Overwrite existing exports |

**Flow:**

```
0. Validate prerequisites:
   a. .pi/ directory exists
   b. guardian-manifest.json exists

1. If --dry-run:
   a. Calculate all mappings
   b. Show file-by-file changes
   c. Show which exports would be updated
   d. Exit with code 0 (no changes made)

2. Read .pi/ directory
3. Read guardian-manifest.json

4. Determine target exports:
   a. If --tool specified: generate only that export
   b. If --tool "all": iterate over manifest.exports keys
   c. If no --tool: generate all exports in manifest

5. For each target export:
   a. Apply mappings (pi → target)
   b. Check existing files:
      - If --force: overwrite all
      - Else: warn on conflicts, skip unchanged
   c. Generate files (atomic writes)
   d. Calculate new sourceHash for this export
   e. On partial failure: keep successful files, report failed

6. Update manifest:
   a. Update exports[].generatedAt timestamps
   b. Update exports[].sourceHash checksums
   c. Write manifest atomically

7. Report summary:
   - Files generated per export
   - Any conflicts/warnings
   - Failed exports (if any)
```

**--dry-run Output:**

```
$ npx guardian-cli generate --dry-run

Calculating changes from .pi/ → exports...

=== .claude/ (12 files) ===
Changes:
  + project.md (new)
  + patterns.md (new, merged)
  ~ checklists.md (modified, 3 changes)
  = scripts/validate-ci.sh (unchanged)

=== .opencode/ (8 files) ===
Changes:
  = All files unchanged (sourceHash matches)

Summary:
  2 new files
  1 modified file
  15 unchanged files
  Exit code: 0 (dry-run, no changes applied)
```

**--tool all Handling:**

```typescript
// Generate for all exports
const manifest = await readManifest();
const targets = Object.keys(manifest.exports);

for (const target of targets) {
  try {
    await generateExport(target);
    results.success.push(target);
  } catch (error) {
    results.failed.push({ target, error });
    // Continue with other exports
  }
}

// Report partial failures
if (results.failed.length > 0) {
  log(`Failed: ${results.failed.map(f => f.target).join(', ')}`);
  exit(2); // Warning: partial success
}
```

**Partial Failure Handling:**

- Keep successful export files intact
- Do NOT rollback successful exports
- Report which exports failed with error
- Update manifest only for successful exports
- Exit with code 2 (warning/partial)

**Example:**

```
$ npx guardian-cli generate --tool claude

Reading .pi/ source...
Applying mappings:
  pi/agent/AGENTS.md → .claude/context/project.md
  pi/skills/agents/ → .claude/agents/**/*.md (nested)
  pi/prompts/ → .claude/workflows/
  pi/scripts/ → .claude/scripts/

Generated .claude/ (12 files)
Updated manifest checksums
```

### update

**Usage:**
```bash
npx guardian-cli update [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--dry-run` | Show changes without applying |
| `--force` | Overwrite user-editable files (dangerous) |
| `--verbose` | Show detailed diff |
| `--quiet` | Only show summary |
| `--regenerate` | Regenerate exports after updating pi source |

**Behavior:**

Updates `.pi/` source, then optionally regenerates exports.

| File Category | Behavior |
|---------------|----------|
| Framework-controlled (.pi/) | Auto-update from templates |
| User-editable (.pi/agent/AGENTS.md) | Preserve, show diff |
| Generated exports (.claude/, etc.) | Regenerate from updated .pi/ |

**Smart Merge Algorithm:**

```
1. Read manifest, get framework version and file checksums
2. Load latest templates/pi/
3. For each framework-controlled file in .pi/:
   a. Calculate checksum of current file
   b. If checksum == manifest checksum → auto-update
   c. If checksum != manifest checksum → WARN, skip
4. For user-editable files (AGENTS.md, patterns.md):
   a. Generate diff between template and current
   b. Preserve, show diff for manual merge
5. If --regenerate flag:
   a. Run generate command for all tracked exports
6. Update manifest checksums
```

### upgrade

**Usage:**
```bash
npx guardian-cli upgrade <version> [options]
```

**Version Argument:**
- Explicit version: `v2.0` — Upgrade to specific version
- `latest`: Upgrade to newest available version
- Multi-version chain: `v1 → v3` automatically chains through migrations

**Migration Process:**
1. Read current manifest version
2. Find migration scripts for target version
3. Apply transforms to `.pi/` source
4. Run update flow for content changes
5. Regenerate exports (if tracked in manifest)
6. Update manifest to new version

### info

**Usage:**
```bash
npx guardian-cli info [options]
```

**Output:**
```
GuardianCLI Status
─────────────────────────────
Project:      /Users/arman/project/my-app
Source:       .pi/ (pi-native)
Exports:      .claude/, .opencode/ (generated from .pi/)
Version:      v1.0.0 (latest: v1.1.0)
Language:     Rust
Validators:   ci, test, security, cache
Workflows:    feature, bugfix, hotfix

.pi/ Files:
  Framework-controlled: 15 files (12 unchanged, 3 modified)
  User-editable: 2 files
  Extensions: 4 files

Generated Exports:
  .claude/  (12 files, last generated: 2026-04-25)
  .opencode/ (8 files, last generated: 2026-04-25)

Commands:
  npx guardian-cli update            # Update .pi/ source
  npx guardian-cli generate          # Regenerate exports
  npx guardian-cli upgrade v1.1      # Version migration

─────────────────────────────
```

---

## Manifest Schema

```json
{
  "schemaVersion": "1.0",
  "frameworkVersion": "1.0.0",
  "source": "pi",
  "tools": ["pi", "claude"],
  "language": "rust",
  "validators": ["ci", "test", "security", "cache"],
  "workflows": ["feature", "bugfix", "hotfix"],
  "files": {
    ".pi/agent/AGENTS.md": {
      "category": "user",
      "originalHash": "sha256:def456...",
      "status": "modified"
    },
    ".pi/scripts/validate-ci.sh": {
      "category": "framework",
      "originalHash": "sha256:abc123...",
      "status": "unchanged"
    },
    ".pi/extensions/validation-runner.ts": {
      "category": "framework",
      "originalHash": "sha256:xyz789...",
      "status": "unchanged"
    },
    ".claude/context/project.md": {
      "category": "generated",
      "sourceHash": "sha256:def456...",
      "generatedAt": "2026-04-25T12:00:00Z"
    }
  },
  "exports": {
    "claude": {
      "path": ".claude/",
      "generatedAt": "2026-04-25T12:00:00Z",
      "sourceHash": "sha256:source123..."
    },
    "opencode": {
      "path": ".opencode/",
      "generatedAt": null
    }
  },
  "scaffoldedAt": "2026-04-25T10:00:00Z",
  "lastUpdatedAt": "2026-04-25T12:00:00Z"
}
```

**Schema Fields:**

| Field | Type | Purpose |
|-------|------|---------|
| `source` | string | Always "pi" — source of truth |
| `tools` | string[] | Scaffolded tools (pi always first if present) |
| `exports` | object | Generated export tracking |
| `exports[tool].generatedAt` | string | Timestamp of last generation |
| `exports[tool].sourceHash` | string | Hash of .pi/ at generation time |
| `files[path].category` | string | "framework", "user", or "generated" |

---

## File Categories

| Category | Files | Update Behavior |
|----------|-------|-----------------|
| **Framework-controlled** | scripts/\*.sh, extensions/\*.ts, skills/\*.md, prompts/\*.md, context/checklists.md | Auto-update if unchanged |
| **User-editable** | agent/AGENTS.md, patterns.md (from languages/) | Preserve, show diff |
| **Generated** | All files in .claude/, .opencode/, .agents/ | Regenerate from .pi/ source |

---

## Pi Extensions

**Based on actual pi ExtensionAPI from [pi documentation](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md).**

Extensions are TypeScript modules that export a default factory function receiving `ExtensionAPI`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("event_name", async (event, ctx) => {...});
  pi.registerTool({...});
  pi.registerCommand("name", {...});
}
```

### validation-runner.ts

Runs shell validation scripts inside pi:

```typescript
// .pi/extensions/validation-runner.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";

export default function (pi: ExtensionAPI) {
  // Read manifest at startup
  let manifest: GuardianManifest | null = null;

  pi.on("session_start", async (_event, ctx) => {
    const manifestPath = path.join(ctx.cwd, "guardian-manifest.json");
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }
  });

  // Register validate tool (callable by LLM)
  pi.registerTool({
    name: "guardian_validate",
    label: "Guardian Validate",
    description: "Run GuardianCLI validation scripts",
    parameters: Type.Object({
      validators: Type.Array(Type.String(), {
        description: "Validators to run: ci, test, security, operations"
      }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const results = [];
      for (const validator of params.validators) {
        const scriptPath = path.join(ctx.cwd, `.pi/scripts/validate-${validator}.sh`);
        if (!fs.existsSync(scriptPath)) {
          results.push({ validator, status: "skipped", reason: "script not found" });
          continue;
        }

        onUpdate({ type: "progress", message: `Running ${validator} validation...` });

        // Use bash tool to execute script
        const result = await ctx.session.tools.bash.execute(
          `${toolCallId}-bash`,
          { command: `bash ${scriptPath}` },
          signal,
          onUpdate,
          ctx
        );

        results.push({
          validator,
          status: result.exitCode === 0 ? "passed" : "failed",
          output: result.stdout
        });
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }],
        details: { results }
      };
    },
  });

  // Register commands
  pi.registerCommand("validate", {
    description: "Run all validators",
    handler: async (args, ctx) => {
      if (!manifest) {
        ctx.ui.notify("No guardian-manifest.json found", "error");
        return;
      }

      ctx.ui.setStatus("guardian", "Running validators...");

      for (const validator of manifest.validators) {
        ctx.ui.notify(`Running ${validator}...`, "info");
        // Execute via bash (ctx has access to tools through session)
        const scriptPath = path.join(ctx.cwd, `.pi/scripts/validate-${validator}.sh`);
        // Note: commands don't have direct bash access, would need to prompt LLM
        // or use spawn directly
        const { spawn } = require("child_process");
        const child = spawn("bash", [scriptPath], { cwd: ctx.cwd });
        // ... handle output
      }

      ctx.ui.setStatus("guardian", "Validation complete");
    },
  });

  pi.registerCommand("validate-ci", {
    description: "Run CI validation only",
    handler: async (args, ctx) => {
      ctx.ui.notify("Running CI validation...", "info");
      // Implementation similar to above
    },
  });

  // Auto-run CI validation after framework file writes (via tool_call event)
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "write" || event.toolName === "edit") {
      const filePath = event.input.file_path;
      if (filePath && filePath.includes(".pi/scripts/") || filePath.includes(".pi/extensions/")) {
        // Framework file was modified - suggest running CI validation
        ctx.ui.notify("Framework file modified. Consider running /validate-ci", "info");
      }
    }
  });
}
```

### guardian-manifest.ts

Provides manifest access and status display:

```typescript
// .pi/extensions/guardian-manifest.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

interface GuardianManifest {
  schemaVersion: string;
  frameworkVersion: string;
  source: string;
  tools: string[];
  language: string;
  validators: string[];
  workflows: string[];
}

export default function (pi: ExtensionAPI) {
  let manifest: GuardianManifest | null = null;

  pi.on("session_start", async (_event, ctx) => {
    const manifestPath = path.join(ctx.cwd, "guardian-manifest.json");
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      ctx.ui.notify(`GuardianCLI v${manifest.frameworkVersion} loaded`, "success");
    }
  });

  pi.registerCommand("guardian-info", {
    description: "Show GuardianCLI status",
    handler: async (args, ctx) => {
      if (!manifest) {
        ctx.ui.notify("No guardian-manifest.json found. Run guardian-cli init first.", "error");
        return;
      }

      ctx.ui.notify(`
GuardianCLI Status:
  Source: ${manifest.source}
  Version: ${manifest.frameworkVersion}
  Language: ${manifest.language}
  Validators: ${manifest.validators.join(", ")}
  Workflows: ${manifest.workflows.join(", ")}
  Tools: ${manifest.tools.join(", ")}
      `, "info");
    },
  });

  // Add footer status showing Guardian version
  pi.on("session_start", async (_event, ctx) => {
    if (manifest) {
      ctx.ui.setStatus("guardian-version", `Guardian v${manifest.frameworkVersion}`);
    }
  });
}
```

### scope-classifier.ts

Classifies task scope inside pi:

```typescript
// .pi/extensions/scope-classifier.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // Register scope tool (callable by LLM)
  pi.registerTool({
    name: "guardian_scope",
    label: "Guardian Scope Classifier",
    description: "Classify task scope to determine required validators",
    parameters: Type.Object({
      description: Type.String({ description: "Task description to classify" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const scope = classifyScope(params.description);
      return {
        content: [{
          type: "text",
          text: `
Scope Classification:
  Level: ${scope.level}
  Estimated Files: ${scope.estimatedFiles}
  Estimated Lines: ${scope.estimatedLines}
  Required Validators: ${scope.requiredValidators.join(", ")}
          `.trim()
        }],
        details: scope
      };
    },
  });

  pi.registerCommand("scope", {
    description: "Classify task scope",
    handler: async (args, ctx) => {
      const description = args.join(" ") || "Enter task description";

      if (!args.length) {
        // Interactive prompt for description
        const input = await ctx.ui.input("Task Description", "Describe the task");
        if (!input) return;
        description = input;
      }

      const scope = classifyScope(description);

      ctx.ui.notify(`
Scope: ${scope.level}
Files: ${scope.estimatedFiles}
Lines: ${scope.estimatedLines}
Validators: ${scope.requiredValidators.join(", ")}
      `, "info");
    },
  });
}

function classifyScope(desc: string) {
  // Simple heuristic - can be enhanced
  const wordCount = desc.split(/\s+/).length;
  const charCount = desc.length;
  const complexity = wordCount + charCount / 10;

  if (complexity < 20) return {
    level: "simple",
    estimatedFiles: 1,
    estimatedLines: 50,
    requiredValidators: ["ci"]
  };
  if (complexity < 50) return {
    level: "moderate",
    estimatedFiles: 3,
    estimatedLines: 150,
    requiredValidators: ["ci", "architecture"]
  };
  if (complexity < 100) return {
    level: "complex",
    estimatedFiles: 8,
    estimatedLines: 400,
    requiredValidators: ["ci", "architecture", "security"]
  };
  return {
    level: "critical",
    estimatedFiles: 15,
    estimatedLines: 600,
    requiredValidators: ["all"]
  };
}
```

### smart-merge.ts

Handles smart merge updates inside pi:

```typescript
// .pi/extensions/smart-merge.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("guardian-update", {
    description: "Update GuardianCLI framework with smart merge",
    handler: async (args, ctx) => {
      const dryRun = args.includes("--dry-run");
      const force = args.includes("--force");
      const regenerate = args.includes("--regenerate");

      const manifestPath = path.join(ctx.cwd, "guardian-manifest.json");
      if (!fs.existsSync(manifestPath)) {
        ctx.ui.notify("No guardian-manifest.json found", "error");
        return;
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

      // Fetch latest version info (would need package version check)
      // For now, just check if templates/pi/ exists
      const templatesDir = path.join(ctx.cwd, ".pi");

      ctx.ui.setStatus("guardian", dryRun ? "Checking updates..." : "Updating...");

      const results = { updated: [] as string[], preserved: [] as string[], conflicts: [] as string[] };

      // For each tracked file
      for (const [filePath, record] of Object.entries(manifest.files || {})) {
        if (!record || typeof record !== "object") continue;

        const fullPath = path.join(ctx.cwd, filePath);

        if (!fs.existsSync(fullPath)) {
          results.preserved.push(filePath);
          continue;
        }

        // Calculate current hash
        const currentHash = hashFile(fullPath);

        if ((record as any).category === "user") {
          // Preserve user-editable files
          results.preserved.push(filePath);
        } else {
          // Framework-controlled file
          if (currentHash !== (record as any).originalHash) {
            // User modified framework file
            if (force) {
              // Force overwrite
              if (!dryRun) {
                // Would need to fetch latest template content
                ctx.ui.notify(`Overwriting: ${filePath}`, "warn");
              }
              results.updated.push(filePath);
            } else {
              results.conflicts.push(filePath);
            }
          } else {
            // Unchanged - safe to update
            if (!dryRun) {
              // Would need to write latest template content
            }
            results.updated.push(filePath);
          }
        }
      }

      // Regenerate exports if requested
      if (!dryRun && regenerate && results.updated.length > 0) {
        ctx.ui.notify("Regenerating exports...", "info");
        // Would call generate logic
      }

      // Update manifest
      if (!dryRun) {
        // Update timestamps and hashes
        manifest.lastUpdatedAt = new Date().toISOString();
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }

      ctx.ui.setStatus("guardian", null); // Clear status

      ctx.ui.notify(`
Update Results:
  Updated: ${results.updated.length} files
  Preserved: ${results.preserved.length} files
  Conflicts: ${results.conflicts.length} files

${dryRun ? "(dry-run, no changes applied)" : "Update complete"}
${results.conflicts.length > 0 ? `\nConflicts (user modified):\n  ${results.conflicts.join("\n  ")}` : ""}
      `, results.conflicts.length > 0 ? "warn" : "success");
    },
  });

  pi.registerCommand("guardian-generate", {
    description: "Regenerate exports from .pi/",
    handler: async (args, ctx) => {
      const tool = args[0] || "all";
      ctx.ui.notify(`Generating exports for: ${tool}`, "info");
      // Full implementation would mirror CLI generate command
      // See generate command flow section in spec
    },
  });
}

function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf-8");
  return crypto.createHash("sha256").update(content).digest("hex");
}
```

---

## Pi Extension API Reference

**From [pi documentation](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs/extensions.md):**

### Extension Factory

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Register tools, commands, shortcuts
  // Subscribe to events
}

// Async factory (for initialization)
export default async function (pi: ExtensionAPI) {
  const data = await fetch("...");
  pi.registerProvider("custom", { ... });
}
```

### ExtensionAPI Methods

| Method | Purpose |
|--------|---------|
| `pi.on(event, handler)` | Subscribe to events |
| `pi.registerTool(options)` | Register LLM-callable tool |
| `pi.registerCommand(name, options)` | Register `/command` |
| `pi.registerShortcut(key, options)` | Register keyboard shortcut |
| `pi.registerFlag(name, options)` | Register CLI flag |
| `pi.registerProvider(name, options)` | Register custom provider |
| `pi.appendEntry(entry)` | Persist state in session |

### ExtensionContext (passed to handlers)

```typescript
interface ExtensionContext {
  cwd: string;                    // Current working directory
  sessionManager: SessionManager; // Session management
  ui: UIInterface;                // User interaction
  // ... other fields
}

interface UIInterface {
  notify(message: string, type: "info" | "success" | "warn" | "error"): void;
  confirm(title: string, message: string): Promise<boolean>;
  input(title: string, placeholder?: string): Promise<string | null>;
  select(title: string, options: string[]): Promise<string | null>;
  setStatus(key: string, message: string | null): void;
  setWidget(key: string, lines: string[]): void;
  custom(render: Function): Promise<any>;
}
```

### Key Events

| Event | When | Use |
|-------|------|-----|
| `session_start` | Session loaded/started | Initialize state |
| `session_shutdown` | Session ending | Cleanup |
| `tool_call` | LLM calling tool | Intercept/block |
| `tool_result` | Tool finished | Modify result |
| `input` | User input received | Transform/handle |
| `before_agent_start` | Before LLM turn | Inject message |
| `context` | Before sending to LLM | Modify message history |

### Tool Registration

```typescript
import { Type } from "typebox";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "Description for LLM",
  parameters: Type.Object({
    param1: Type.String({ description: "Param description" }),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    onUpdate({ type: "progress", message: "Working..." });

    return {
      content: [{ type: "text", text: "Result" }],
      details: { ... }
    };
  },
});
```

### Node.js Built-ins Available

Extensions can use Node.js builtins:
- `node:fs` — File system
- `node:path` — Path utilities
- `node:crypto` — Hashing
- `node:child_process` — Spawn processes
- And more...

---

## Utility Functions

### Exporter

```typescript
// src/scaffold/exporter.ts
interface ExportMapping {
  source: string;       // pi source path (glob)
  dest: string;         // export destination path
  transform?: (content: string, filename: string) => string;
}

const CLAUDE_MAPPINGS: ExportMapping[] = [
  { source: 'pi/agent/AGENTS.md', dest: 'claude/context/project.md' },
  { source: 'pi/skills/agents/architecture-coordinator.md',
    dest: 'claude/agents/orchestrators/architecture-coordinator.md' },
  { source: 'pi/skills/agents/*-validator.md',
    dest: 'claude/agents/validators/*.md' },
  { source: 'pi/skills/agents/code-developer.md',
    dest: 'claude/agents/implementers/code-developer.md' },
  { source: 'pi/prompts/*.md', dest: 'claude/workflows/*.md' },
  { source: 'pi/scripts/*.sh', dest: 'claude/scripts/*.sh' },
];

async function exportToClaude(piDir: string, claudeDir: string) {
  for (const mapping of CLAUDE_MAPPINGS) {
    const sourceFiles = await glob(mapping.source, piDir);
    for (const sourceFile of sourceFiles) {
      const destFile = resolveDest(sourceFile, mapping);
      const content = await Bun.file(sourceFile).text();
      const transformed = mapping.transform?.(content, sourceFile) ?? content;
      await atomicWrite(destFile, transformed);
    }
  }
}
```

---

## Error Handling

| Error | Handling | Exit Code |
|-------|----------|-----------|
| Directory not empty | Prompt confirmation before scaffold | 0 (confirmed) or 1 (aborted) |
| No .pi/ source found | Cannot generate/update exports | 1 |
| No manifest found | Cannot run update/upgrade, suggest init | 1 |
| No manifest found (info) | Display "No GuardianCLI framework detected" | 1 |
| Version mismatch | Require upgrade command | 1 |
| Template not found | Fall back to shared template, warn | 2 |
| Write failure | Rollback transaction, report error | 1 |
| Permission denied | Report error, suggest chmod/chown | 1 |
| Disk space insufficient | Check before write, report | 1 |
| Corrupted manifest.json | Prompt to recreate with init | 1 |
| Concurrent operations | Lock file detection, wait or abort | 1 |
| Missing required flag (non-interactive) | Report error with required flags | 1 |
| Export generation failed | Keep .pi/ intact, report which export failed | 2 |

---

## Exit Codes

| Code | Meaning | When |
|------|---------|------|
| 0 | Success | Command completed successfully |
| 1 | Error | Fatal error, operation failed |
| 2 | Warning | Partial success, user intervention needed |
| 3 | No changes | Update found no changes needed |

---

## Global Options

| Option | Description |
|--------|-------------|
| `--verbose` | Detailed logging, show all operations |
| `--quiet` | Minimal output, only errors and final summary |
| `--non-interactive` | Skip prompts, use defaults or provided flags |
| `--dir <path>` | Target directory (default: current) |

---

## Testing Strategy

| Test Type | Coverage |
|-----------|----------|
| Unit | Utility functions, exporter mappings, checksum |
| Integration | Scaffold flows, generate exports |
| E2E | Full pi scaffold, verify extensions load in pi |
| Export | Verify generated files match expected structure |
| Migration | Version upgrade scenarios |

---

## Distribution

**Package:** `guardian-cli`

**Additional:** `@guardian/pi-framework` (optional pi package install)

**Installation:**
```bash
npx guardian-cli init                  # Scaffold
bunx guardian-cli init --tool pi       # Explicit pi
pi install @guardian/pi-framework      # Add to existing pi
```

**Versioning:**
- Semantic versioning (major.minor.patch)
- Major: Breaking changes, migration required
- Minor: New features, templates updated
- Patch: Bug fixes, no template changes

---

## Success Criteria

| Criterion | Metric |
|-----------|--------|
| Scaffold time | < 5 seconds for full pi framework |
| Export generation | < 2 seconds from .pi/ source |
| Update clarity | User understands what changed |
| Zero conflicts | No overwrite of user edits without consent |
| pi integration | Extensions load and run correctly inside pi |
| Multi-tool support | Exports work in Claude, OpenCode, Antigravity |
| Token efficiency | Scaffolded framework achieves 50%+ reduction |
| Single source | All exports generated from single .pi/ source |

---

## Implementation Phases

### Phase 1: Core Pi Scaffold
- Project setup (Bun, TypeScript, package.json)
- Pi template structure (`templates/pi/`)
- Interactive prompts (@clack/prompts)
- Transactional file writer
- Manifest generation

### Phase 2: Export Generator
- Exporter mappings (pi → claude, opencode, agents)
- File transformation (nesting, .txt conversion)
- Generate command
- Integration with init (multi-tool scaffold)

### Phase 3: Update System
- Version tracking
- Checksum comparison
- Smart merge for .pi/
- Automatic export regeneration

### Phase 4: Pi Extensions
- validation-runner.ts extension
- guardian-manifest.ts extension
- scope-classifier.ts extension
- smart-merge.ts extension

### Phase 5: Polish
- Upgrade command with migrations
- Info command
- Error handling
- Logging/UX polish
- README and documentation

---

## Appendix: Pi Template Files

Templates will be extracted from Rigorix framework and adapted to pi format:

| Rigorix Source | Pi Destination |
|----------------|----------------|
| `.claude/context/project.md` | `pi/agent/AGENTS.md` |
| `.claude/scripts/*.sh` | `pi/scripts/*.sh` |
| `.claude/agents/**/*.md` | `pi/skills/agents/*.md` |
| `.claude/workflows/*.md` | `pi/prompts/*.md` |
| `.claude/context/checklists.md` | `pi/context/checklists.md` |
| `.claude/context/output-formats.md` | `pi/context/output-formats.md` |

---

## Appendix: Pi Integration Benefits

| Benefit | Description |
|---------|-------------|
| **Integrated validation** | Extensions run validators inside pi, not external shell |
| **Context engineering** | AGENTS.md + SYSTEM.md + skills = fine-grained control |
| **Session trees** | Navigate history, branch from any point |
| **Model switching** | `/model` command, Ctrl+L hotkey |
| **Progressive disclosure** | Skills load on-demand, don't bust prompt cache |
| **Extensibility** | TypeScript extensions for custom workflows |
| **Package ecosystem** | Install/share via npm or git |

---

**End of Specification**