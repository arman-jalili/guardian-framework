# GuardianCLI - Token-Optimized Agentic Framework Scaffolder

**Version:** 0.1.0
**Status:** In Development

---

## What is GuardianCLI?

A CLI tool that scaffolds token-optimized agentic frameworks for AI-assisted development. Uses **pi-first architecture** where `.pi/` is the source of truth and other formats (`.Codex/`, `.opencode/`, `.agents/`) are generated exports.

---

## Project Structure

```
guardian-cli/
├── src/                    # Source code
│   ├── index.ts            # CLI entry point
│   ├── commands/           # Command implementations
│   │   ├── init.ts         # Interactive initialization
│   │   ├── generate.ts     # Generate exports from .pi
│   │   ├── update.ts       # Smart merge updates
│   │   ├── upgrade.ts      # Version migration
│   │   └── info.ts         # Display manifest info
│   ├── lib/                # Core libraries
│   │   ├── templates.ts    # Template loading
│   │   ├── manifest.ts     # Manifest management
│   │   ├── merge.ts        # Smart merge logic
│   │   ├── generate.ts     # Export generation
│   │   └── prompts.ts      # Interactive prompts
│   └── templates/          # Built-in templates
│   └── validation.ts       # Validation scripts
├── templates/              # Template files (copied from Rigorix)
│   ├── pi/                 # Pi source templates
│   └── languages/          # Language-specific patterns
├── tests/                  # Test files
├── docs/                   # Documentation
│   └── guardian-cli-design.md  # Design specification
└── package.json            # Package configuration
```

---

## Development Commands

```bash
# Install dependencies
bun install

# Build
bun build ./src/index.ts --outdir ./dist

# Test
bun test

# Lint
biome check .

# Format
biome format . --write

# Type check
bunx tsc --noEmit

# Run locally
bun run src/index.ts init
```

---

## Architecture Patterns

### Error Handling
- Custom error classes with typed fields
- Result type pattern: `{ ok: true; value: T } | { ok: false; error: E }`
- Never throw in library functions, return Result type

### Logging
- Structured logging with JSON output
- Include timestamp, level, message, context

### Atomic Writes
- Write to temp file first
- Atomic rename for final write

---

## Key Files to Read

When working on this project, read these files first:

1. **`docs/guardian-cli-design.md`** - Complete design specification
2. **`templates/pi/INDEX.md`** - Template structure reference
3. **`templates/pi/README.md`** - Framework documentation

---

## Quality Gates

Before any commit:
- [ ] `bun build` succeeds
- [ ] `bun test` passes
- [ ] `biome check .` passes
- [ ] `biome format . --write` applied

---

## Distribution

- npm package: `guardian-cli` (no scope)
- Runtime: Bun
- Install: `npx guardian-cli init`