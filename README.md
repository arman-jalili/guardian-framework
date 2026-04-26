# Guardian Framework CLI

**Token-Optimized Agentic Framework Scaffolder**

A CLI tool that scaffolds deterministic, validated workflows for AI-assisted development. Uses **pi-first architecture** where `.pi/` is the source of truth, with generated exports for Claude Code, OpenCode, and Antigravity.

---

## Why GuardianCLI?

Multi-agent AI workflows produce excellent results but burn tokens quadratically. GuardianCLI solves this through:

| Problem | Solution |
|---------|----------|
| Repeated context across agents | **DRY context** — shared templates loaded once |
| Validation at every step | **Shift-left validation** — validate plans, inherit for code |
| LLM doing mechanical checks | **Automated validators** — shell scripts replace LLM calls |
| Full re-validation on retry | **Validation caching** — only re-check failed items |
| Large agent definitions | **Compressed agents** — 20-30 lines vs 120-176 |
| Multiple AI tools | **Pi-first architecture** — single source → multiple exports |
| Orphaned code without docs | **Canonical references** — all code traces to architecture |

**Result: 50-65% token reduction** compared to traditional multi-agent workflows.

---

## Canonical Reference System

**Every implementation file must reference its architecture source:**

```typescript
/**
 * Canonical Reference: .pi/architecture/modules/auth-system.md
 * Implements: User authentication flow (AC-1, AC-2)
 * Last Architecture Sync: 2026-04-26
 */
```

**Architecture Change Log Requirement:**

When architecture changes, update `.pi/architecture/CHANGELOG.md`:

```markdown
## 2026-04-26 - Auth System Refactor

### Changed
- Auth module: Token validation moved to middleware
- Session handling: Added refresh token rotation

### Impact
- Files affected: src/auth/*.ts, src/middleware/auth.ts
- Canonical refs to update: .pi/architecture/modules/auth-system.md
- Validators: Re-run security-validator

### Migration
Run `/blueprint-update` after implementing these changes
```

---

## Installation

```bash
# Run directly with npx (no installation required)
npx guardian-framework-cli init

# Or with bun
bunx guardian-framework-cli init

# Or install globally
npm install -g guardian-framework-cli
guardian-framework-cli init
```

---

## Quick Start

### 1. Initialize Framework

```bash
npx guardian-framework-cli init
```

Interactive prompts guide you through:
- Project name and version
- Project type (CLI, Web App, Library, API)
- Repository name and tool (GitHub/gh or GitLab/glab)
- AI tools to scaffold (pi, Claude Code, OpenCode, Antigravity)
- Programming language (TypeScript, Rust, Python, Go)
- Validators to include (CI, tests, security, operations, architecture, canonical)
- Workflow prompts (feature, bugfix, epic management, blueprint management)

### 2. Configure Commands

Edit `.pi/scripts/*.sh` with your project's commands:

```bash
# Example for TypeScript/Bun project
# .pi/scripts/validate-ci.sh
bun build ./src/index.ts --outdir ./dist
bun test
biome check .
```

### 3. Generate Exports

```bash
npx guardian-framework-cli generate
```

Creates `.claude/`, `.opencode/`, `.agents/` from `.pi/` templates.

### 4. Test Validators

```bash
chmod +x .pi/scripts/*.sh
bash .pi/scripts/validate-ci.sh
bash .pi/scripts/validate-canonical.sh
```

---

## Architecture

### Pi-First Design

`.pi/` is the single source of truth. All other formats are generated exports:

```
templates/pi/                    # SOURCE OF TRUTH (in GuardianCLI)
    │
    └─── scaffold ──────────────→ .pi/          (in your project)
    │
    └─── generate ──────────────→ .claude/      (Claude Code export)
    │                            → .opencode/   (OpenCode export)
    │                            → .agents/     (Antigravity export)
```

### Directory Structure

```
.pi/                           # Source of truth
├── agent/
│   └── AGENTS.md              # Project instructions
│
├── architecture/              # Architecture definitions (NEW)
│   ├── modules/               # Module architecture docs
│   │   ├── auth-system.md
│   │   ├── data-layer.md
│   │   └── api-gateway.md
│   ├── diagrams/              # Architecture diagrams
│   ├── CHANGELOG.md           # Architecture change log
│   └── decisions/             # Architecture decision records (ADR)
│
├── context/                   # Shared knowledge (loaded ONCE)
│   ├── project.md             # Project facts, commands
│   ├── patterns.md            # Code templates (language-specific)
│   ├── checklists.md          # Validation checklists
│   └── output-formats.md      # Report templates
│
├── skills/
│   ├── agents/                # Agent definitions
│   │   ├── architecture-coordinator.md
│   │   ├── architecture-validator.md
│   │   ├── security-validator.md
│   │   ├── operations-validator.md
│   │   ├── test-validator.md
│   │   ├── integration-validator.md
│   │   ├── ci-mr-validator.md
│   │   ├── code-developer.md
│   │   ├── issue-creator.md
│   │   └── documentation-maintainer.md
│   └── validators/            # Validator skills
│
├── prompts/                   # Workflow templates
│   ├── feature-development.md
│   ├── bug-fix.md
│   ├── hotfix.md
│   ├── refactoring.md
│   ├── issue-implementation-series.md
│   ├── epic-plan.md           # Epic/Issue management
│   ├── issue-draft.md
│   ├── git-issues.md
│   ├── issue-closeout.md
│   ├── issue-merge.md
│   ├── blueprint-validate.md  # Blueprint management (NEW)
│   ├── sync-check.md
│   ├── context-refresh.md
│   ├── scope-analyzer.md
│   ├── pattern-extract.md
│   └── blueprint-update.md
│
├── scripts/                   # Automated validators
│   ├── validate-ci.sh
│   ├── validate-tests.sh
│   ├── validate-operations.sh
│   ├── validate-security.sh
│   ├── validate-architecture.sh
│   ├── validate-canonical.sh  # NEW: Canonical ref integrity
│   └── validation-cache.sh
│
├── extensions/                # Pi extensions (pi-only feature)
│   ├── validation-runner.ts
│   └── coordinator.ts
│
├── INDEX.md                   # Quick reference
└── README.md                  # Framework documentation
```

### Tool Comparison

| Feature | pi | Claude Code | GitHub Copilot | OpenCode | Antigravity |
|---------|----|----|----|-----------|-------------|
| **Extensions** | ✅ TypeScript | ❌ | ❌ | ❌ | ❌ |
| **Skills** | ✅ On-demand | Static .md | YAML agents | Static .txt | Static .md |
| **Prompt templates** | ✅ `/commands` | Static .md | Static .md | Static .md | Static .md |
| **Shell scripts** | ✅ Auto-run | Manual | Manual | Manual | Manual |
| **Smart merge** | ✅ Built-in | CLI | CLI | CLI | CLI |
| **Session trees** | ✅ Native | ❌ | ❌ | ❌ | ❌ |
| **Model switching** | ✅ Ctrl+L | ❌ | `/agent` | ❌ | ❌ |
| **Canonical refs** | ✅ Required | Recommended | Recommended | Optional | Optional |
| **Custom instructions** | ✅ AGENTS.md | CLAUDE.md | copilot-instructions.md | context.md | agents.md |

---

## Commands

### `init`

Initialize the framework in your project.

```bash
npx guardian-framework-cli init [options]

Options:
  -d, --dir <path>           Target directory (default: current)
  -t, --tool <name>          AI tool (pi, claude, opencode, agents)
  -l, --lang <name>          Language (typescript, rust, python, go)
  --repo-tool <name>         Repository tool (gh, glab)
  --validators <list>        Validators (comma-separated, CI always included)
  --workflows <list>         Workflows (comma-separated)
  --nonInteractive           Skip prompts, use defaults/flags
```

**Interactive Flow:**

1. Project name, version, type, repository
2. Repository tool selection (GitHub/gh or GitLab/glab)
3. AI tool selection (pi recommended for full features)
4. Language selection with smart defaults
5. Validator selection (CI required, others optional)
6. Workflow prompt selection (standard, epic, blueprint)
7. Confirmation with summary

### `generate`

Regenerate exports from `.pi/` source after edits.

```bash
npx guardian-framework-cli generate [options]

Options:
  --tool <name>              Target tool or "all"
  --dry-run                  Show changes without writing
  --force                    Overwrite existing files
```

**Use Cases:**
- After editing `.pi/agent/AGENTS.md`
- After modifying `.pi/scripts/*.sh`
- After updating `.pi/architecture/`
- After architecture changes logged in CHANGELOG.md

### `update`

Smart merge framework updates preserving user edits.

```bash
npx guardian-framework-cli update [options]

Options:
  --dry-run                  Show changes without applying
  --force                    Overwrite user-editable files (dangerous)
  --regenerate               Regenerate exports after update
```

**Smart Merge Logic:**

| File Category | Behavior |
|---------------|----------|
| Framework-controlled | Auto-update if unchanged |
| User-editable | Preserve, show diff |
| Architecture docs | Preserve, check canonical refs |
| Generated exports | Regenerate from .pi/ |

### `upgrade`

Migrate to new framework version.

```bash
npx guardian-framework-cli upgrade <version>

Arguments:
  v2.0                       Upgrade to specific version
  latest                     Upgrade to newest available
```

### `info`

Display manifest and framework status.

```bash
npx guardian-framework-cli info
```

Shows:
- Framework version and source
- Repository tool (gh/glab)
- Selected tools, language, validators, workflows
- Canonical reference coverage percentage
- Architecture change log status
- File status (unchanged/modified)
- Export generation timestamps

---

## Validators

| Validator | Checks | When |
|-----------|--------|------|
| **CI** | Build, lint, format, audit | All tasks (required) |
| **Test** | Unit tests, integration, coverage | Moderate+ scope |
| **Security** | Secrets, injection, path traversal | Complex+ scope |
| **Operations** | Tracing, cancellation, atomic writes | Plan review |
| **Architecture** | Layer structure, module boundaries, deps | Moderate+ scope |
| **Integration** | Component integration | Complex+ scope |
| **Canonical** | Reference integrity, coverage ≥50% | All tasks (required) |

### Scope Classification

| Scope | Files | Lines | Validators Required |
|-------|-------|-------|---------------------|
| Simple | 1 | < 50 | CI + canonical (automated) |
| Moderate | 2-5 | 50-200 | CI + architecture + canonical |
| Complex | 5-15 | 200-500 | CI + architecture + security + canonical |
| Critical | 15+ | 500+ | All validators + canonical + human approval |

---

## Workflows

### Standard Workflows

| Workflow | File | Use When |
|----------|------|----------|
| Feature Development | `prompts/feature-development.md` | New features |
| Bug Fix | `prompts/bug-fix.md` | Bug fixes |
| Emergency Hotfix | `prompts/hotfix.md` | Production issues |
| Refactoring | `prompts/refactoring.md` | Code improvement |
| Issue Implementation | `prompts/issue-implementation-series.md` | Batch GitHub issues |

### Epic/Issue Management Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| Epic Plan | `prompts/epic-plan.md` | Architecture analysis → epic slicing → validator review |
| Issue Draft | `prompts/issue-draft.md` | Create draft issues from approved epic |
| Git Issues | `prompts/git-issues.md` | Create epics/milestones + issues + tracking in GitHub/GitLab |
| Issue Closeout | `prompts/issue-closeout.md` | Verify AC → validators → canonical refs → compliance MR |
| Issue Merge | `prompts/issue-merge.md` | Merge MR → close issue → update tracking → close epic |

**Workflow Sequence:**

```
/epic-plan → /issue-draft → /git-issues → [implement] → /issue-closeout → /issue-merge
                                    ↑                                          ↓
                                    └────────────── next issue ────────────────┘
```

### Blueprint Management Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| Blueprint Validate | `prompts/blueprint-validate.md` | Validate `.pi/` structure and integrity |
| Sync Check | `prompts/sync-check.md` | Verify exports match blueprint source |
| Context Refresh | `prompts/context-refresh.md` | Update context from codebase reality |
| Scope Analyzer | `prompts/scope-analyzer.md` | Auto-determine scope + required validators |
| Pattern Extract | `prompts/pattern-extract.md` | Extract patterns to `patterns.md` |
| Blueprint Update | `prompts/blueprint-update.md` | Reverse-sync implementation → blueprint |

**Blueprint Maintenance Sequence:**

```
Blueprint Setup (one-time):
/blueprint-validate → /sync-check → [ready for implementation]

Maintenance Cycle:
/context-refresh → /pattern-extract → /blueprint-update → /sync-check → guardian generate
```

---

## Architecture Change Log

**`.pi/architecture/CHANGELOG.md` tracks all architecture changes:**

```markdown
# Architecture Change Log

## 2026-04-26 - Auth System Token Rotation

### Changed
- Module: auth-system
  - Token validation moved to middleware layer
  - Added refresh token rotation (RFC 6819)
  - Session timeout reduced from 24h to 4h

### Impact Analysis
- Files affected:
  - src/auth/token-validator.ts
  - src/middleware/auth-middleware.ts
  - src/session/session-manager.ts
- Canonical refs to update:
  - .pi/architecture/modules/auth-system.md#token-validation
  - .pi/architecture/modules/auth-system.md#session-handling
- Validators required:
  - security-validator (auth changes)
  - canonical-validator (ref updates)

### Migration Guide
1. Update canonical refs in affected files
2. Run `/blueprint-update` to sync changes
3. Run `validate-canonical.sh` to verify refs
4. Run security-validator on auth module

---
[Previous entries...]
```

**When to Update:**
- Module structure changes
- API contract changes
- Data flow changes
- Security model changes
- Integration patterns change

---

## GitHub Copilot CLI Support

GuardianCLI scaffolds GitHub Copilot CLI configuration with:

### Generated Structure

```
.github/
├── copilot-instructions.md     # Main project instructions (from AGENTS.md)
├── instructions/
│   ├── architecture.instructions.md  # Architecture implementation guidelines
│   └── validation.instructions.md    # Validation and quality gate requirements
├── agents/
│   ├── architecture-coordinator.agent.md  # Master orchestrator agent
│   └── epic-planner.agent.md              # Epic planning agent
└── copilot/
    └── settings.json          # Copilot CLI settings
```

### Custom Instructions Format

Files use YAML frontmatter for targeting:

```markdown
---
description: 'Architecture implementation guidelines'
applyTo: 'src/**/*.ts,src/**/*.js'
---

# Architecture Guidelines
[content...]
```

### Agent Format

```markdown
---
name: Architecture Coordinator
description: Master orchestrator for workflows
model: gpt-4o
tools:
  - view
  - grep
  - glob
  - edit
  - terminal
---

# Agent Instructions
[content...]
```

### Usage

```bash
# Scaffold with GitHub Copilot support
npx guardian-framework-cli init --tool github

# Or with multiple tools
npx guardian-framework-cli init --tool pi,github,claude

# Copilot CLI reads .github/copilot-instructions.md automatically
copilot "explain the auth module architecture"
```

### Switch Agents

```bash
# Inside copilot session
/agent architecture-coordinator

# Or from command line
copilot --agent architecture-coordinator "plan the next epic"
```

---

## Language Support

| Language | Build | Test | Lint | Format |
|----------|-------|------|------|--------|
| TypeScript | `bun build` | `bun test` | `biome check` | `biome format` |
| Rust | `cargo build` | `cargo test --all` | `cargo clippy` | `cargo fmt` |
| Python | `python -m build` | `pytest` | `ruff check` | `ruff format` |
| Go | `go build ./...` | `go test ./...` | `golangci-lint` | `gofmt` |

Language-specific patterns are automatically selected during `init`.

---

## Manifest

`guardian-manifest.json` tracks framework state:

```json
{
  "schemaVersion": "1.2",
  "frameworkVersion": "1.2.0",
  "source": "pi",
  "repoTool": "gh",
  "tools": ["pi", "claude"],
  "language": "typescript",
  "validators": ["ci", "test", "security", "architecture", "canonical"],
  "workflows": ["feature-development", "epic-plan", "blueprint-validate"],
  "canonicalCoverage": 78,
  "lastArchitectureSync": "2026-04-26",
  "files": {
    ".pi/agent/AGENTS.md": {
      "category": "user",
      "originalHash": "sha256:...",
      "status": "modified"
    },
    ".pi/architecture/modules/auth-system.md": {
      "category": "architecture",
      "originalHash": "sha256:...",
      "status": "unchanged"
    },
    ".pi/scripts/validate-ci.sh": {
      "category": "framework",
      "originalHash": "sha256:...",
      "status": "unchanged"
    }
  },
  "exports": {
    "claude": {
      "path": ".claude/",
      "generatedAt": "2026-04-26T12:00:00Z",
      "sourceHash": "sha256:..."
    }
  },
  "scaffoldedAt": "2026-04-26T10:00:00Z",
  "lastUpdatedAt": "2026-04-26T12:00:00Z"
}
```

---

## Development

### Prerequisites

- Bun runtime
- TypeScript 5.0+

### Commands

```bash
# Install dependencies
bun install

# Build
bun run build

# Run locally
bun run src/index.ts init

# Type check
bun run typecheck

# Lint
bun run lint

# Format
bun run format

# Test
bun test
```

### Project Structure

```
guardian-cli/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/
│   │   ├── init.ts           # Scaffold command
│   │   ├── generate.ts       # Export generator
│   │   ├── update.ts         # Smart merge
│   │   ├── upgrade.ts        # Version migration
│   │   └── info.ts           # Status display
│   └── lib/
│       ├── templates.ts      # Template loading
│       ├── prompts.ts        # Interactive prompts
│       ├── manifest.ts       # Manifest management
│       └── generate.ts       # Export generation
│
├── templates/
│   ├── pi/                   # Pi source templates
│   │   ├── architecture/     # Architecture templates
│   │   ├── prompts/          # Workflow templates
│   │   └── scripts/          # Validator scripts
│   └── languages/            # Language patterns
│
├── docs/
│   └── guardian-cli-design.md
│
└── package.json
```

---

## Examples

### Scaffold a TypeScript Project with GitHub

```bash
npx guardian-framework-cli init --lang typescript --repo-tool gh --tool pi,claude
```

Creates:
- `.pi/` with TypeScript patterns
- `.pi/architecture/` structure
- `.claude/` export for Claude Code
- `guardian-manifest.json`

### Scaffold a Rust Project with GitLab

```bash
npx guardian-framework-cli init --lang rust --repo-tool glab
```

Creates `.pi/` with:
- Cargo build/test/clippy defaults
- Rust error handling patterns
- GitLab-compatible issue workflows

### Non-Interactive Scaffold

```bash
npx guardian-framework-cli init \
  --lang typescript \
  --repo-tool gh \
  --tool pi \
  --validators ci,test,security,architecture,canonical \
  --workflows feature-development,epic-plan,blueprint-validate \
  --nonInteractive
```

### Validate Architecture and Canonical References

```bash
bash .pi/scripts/validate-architecture.sh
bash .pi/scripts/validate-canonical.sh
```

### Epic Planning Workflow

```bash
# 1. Analyze architecture and plan epic
/epic-plan

# 2. Draft issues from approved epic
/issue-draft

# 3. Create in GitHub/GitLab
/git-issues

# 4. Implement, then closeout
/issue-closeout

# 5. Merge and update tracking
/issue-merge
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add canonical references to all new files
5. Run quality gates: `bun run lint && bun run typecheck && bun test`
6. Run canonical validator: `bash .pi/scripts/validate-canonical.sh`
7. Submit a pull request

---

## License

MIT

---

## Links

- **Repository:** https://github.com/arman-jalili/guardian-cli
- **Design Spec:** [docs/guardian-cli-design.md](docs/guardian-cli-design.md)
- **Pi Framework:** https://github.com/badlogic/pi-mono