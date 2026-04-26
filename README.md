# GuardianCLI

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

**Result: 50-65% token reduction** compared to traditional multi-agent workflows.

---

## Installation

```bash
# Run directly with npx (no installation required)
npx guardian-cli init

# Or with bun
bunx guardian-cli init

# Or install globally
npm install -g guardian-cli
guardian-cli init
```

---

## Quick Start

### 1. Initialize Framework

```bash
npx guardian-cli init
```

Interactive prompts guide you through:
- Project name and version
- Project type (CLI, Web App, Library, API)
- Repository name
- AI tools to scaffold (pi, Claude Code, OpenCode, Antigravity)
- Programming language (TypeScript, Rust, Python, Go)
- Validators to include (CI, tests, security, operations)
- Workflow prompts (feature, bugfix, hotfix, refactoring)

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
npx guardian-cli generate
```

Creates `.claude/`, `.opencode/`, `.agents/` from `.pi/` templates.

### 4. Test Validators

```bash
chmod +x .pi/scripts/*.sh
bash .pi/scripts/validate-ci.sh
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
│   └── issue-implementation-series.md
│
├── scripts/                   # Automated validators
│   ├── validate-ci.sh
│   ├── validate-tests.sh
│   ├── validate-operations.sh
│   ├── validate-security.sh
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

| Feature | pi | Claude Code | OpenCode | Antigravity |
|---------|----|----|-----------|-------------|
| **Extensions** | ✅ TypeScript | ❌ | ❌ | ❌ |
| **Skills** | ✅ On-demand | Static .md | Static .txt | Static .md |
| **Prompt templates** | ✅ `/commands` | Static .md | Static .md | Static .md |
| **Shell scripts** | ✅ Auto-run | Manual | Manual | Manual |
| **Smart merge** | ✅ Built-in | CLI | CLI | CLI |
| **Session trees** | ✅ Native | ❌ | ❌ | ❌ |
| **Model switching** | ✅ Ctrl+L | ❌ | ❌ | ❌ |

---

## Commands

### `init`

Initialize the framework in your project.

```bash
npx guardian-cli init [options]

Options:
  -d, --dir <path>           Target directory (default: current)
  -t, --tool <name>          AI tool (pi, claude, opencode, agents)
  -l, --lang <name>          Language (typescript, rust, python, go)
  --validators <list>        Validators (comma-separated, CI always included)
  --workflows <list>         Workflows (comma-separated)
  --nonInteractive           Skip prompts, use defaults/flags
```

**Interactive Flow:**

1. Project name, version, type, repository
2. AI tool selection (pi recommended for full features)
3. Language selection with smart defaults
4. Validator selection (CI required, others optional)
5. Workflow prompt selection
6. Confirmation with summary

### `generate`

Regenerate exports from `.pi/` source after edits.

```bash
npx guardian-cli generate [options]

Options:
  --tool <name>              Target tool or "all"
  --dry-run                  Show changes without writing
  --force                    Overwrite existing files
```

**Use Cases:**
- After editing `.pi/agent/AGENTS.md`
- After modifying `.pi/scripts/*.sh`
- After updating `.pi/context/patterns.md`

### `update`

Smart merge framework updates preserving user edits.

```bash
npx guardian-cli update [options]

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
| Generated exports | Regenerate from .pi/ |

### `upgrade`

Migrate to new framework version.

```bash
npx guardian-cli upgrade <version>

Arguments:
  v2.0                       Upgrade to specific version
  latest                     Upgrade to newest available
```

### `info`

Display manifest and framework status.

```bash
npx guardian-cli info
```

Shows:
- Framework version and source
- Selected tools, language, validators, workflows
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
| **Integration** | Component integration | Complex+ scope |

### Scope Classification

| Scope | Files | Lines | Validators Required |
|-------|-------|-------|---------------------|
| Simple | 1 | < 50 | CI (automated) |
| Moderate | 2-5 | 50-200 | CI + architecture |
| Complex | 5-15 | 200-500 | CI + architecture + security |
| Critical | 15+ | 500+ | All + human approval |

---

## Workflows

| Workflow | File | Use When |
|----------|------|----------|
| Feature Development | `prompts/feature-development.md` | New features |
| Bug Fix | `prompts/bug-fix.md` | Bug fixes |
| Emergency Hotfix | `prompts/hotfix.md` | Production issues |
| Refactoring | `prompts/refactoring.md` | Code improvement |
| Issue Implementation | `prompts/issue-implementation-series.md` | Batch GitHub issues |

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
  "schemaVersion": "1.0",
  "frameworkVersion": "1.0.0",
  "source": "pi",
  "tools": ["pi", "claude"],
  "language": "typescript",
  "validators": ["ci", "test", "security"],
  "workflows": ["feature-development", "bug-fix"],
  "files": {
    ".pi/agent/AGENTS.md": {
      "category": "user",
      "originalHash": "sha256:...",
      "status": "modified"
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
│   └── languages/            # Language patterns
│
├── docs/
│   └── guardian-cli-design.md
│
└── package.json
```

---

## Examples

### Scaffold a TypeScript Project

```bash
npx guardian-cli init --lang typescript --tool pi,claude
```

Creates:
- `.pi/` with TypeScript patterns
- `.claude/` export for Claude Code
- `guardian-manifest.json`

### Scaffold a Rust Project

```bash
npx guardian-cli init --lang rust
```

Creates `.pi/` with:
- Cargo build/test/clippy defaults
- Rust error handling patterns
- Rust tracing patterns

### Non-Interactive Scaffold

```bash
npx guardian-cli init \
  --lang typescript \
  --tool pi \
  --validators ci,test,security \
  --workflows feature-development,bug-fix \
  --nonInteractive
```

### Generate Claude Export After Edits

```bash
# Edit .pi/agent/AGENTS.md
# Edit .pi/scripts/validate-ci.sh

npx guardian-cli generate --tool claude
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run quality gates: `bun run lint && bun run typecheck && bun test`
5. Submit a pull request

---

## License

MIT

---

## Links

- **Repository:** https://github.com/arman-jalili/guardian-cli
- **Design Spec:** [docs/guardian-cli-design.md](docs/guardian-cli-design.md)
- **Pi Framework:** https://github.com/badlogic/pi-mono