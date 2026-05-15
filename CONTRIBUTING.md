# Contributing to Guardian

Thank you for your interest in contributing! Guardian is a token-optimized agentic framework scaffolder.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- Node.js is not required — this project runs on Bun only.

### Setup

```bash
git clone https://github.com/arman-jalili/guardian-framework.git
cd guardian-framework
bun install
```

### Development Workflow

```bash
# Run in dev mode (no build needed)
bun run src/index.ts init

# Build
bun run build

# Run tests
bun test

# Lint
bunx biome check .

# Format
bunx biome format . --write

# Type check
bunx tsc --noEmit
```

All quality gates must pass before submitting a PR:
- `bun test` — all tests pass
- `bunx biome check .` — no lint errors
- `bunx tsc --noEmit` — no type errors
- `bun run build` — builds successfully

## Architecture Overview

Guardian uses a **pi-first architecture**:
- `.pi/` is the source of truth (stored as templates in `templates/pi/`)
- Other formats (`.claude/`, `.opencode/`, `.agents/`, `.github/`) are generated exports
- Export mappings live in `src/lib/export-mappings.ts`

Key directories:
```
src/commands/     # CLI command implementations
src/lib/          # Shared libraries (templates, manifest, retry, etc.)
templates/pi/     # Template files scaffolded into user projects
tests/            # Test files (bun:test)
docs/             # Architecture and design documentation
```

## Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Make your changes
4. Run all quality gates (see above)
5. Commit with [Conventional Commits](https://www.conventionalcommits.org/)
6. Push and open a PR

### Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add GitHub Copilot export support
fix: handle missing template files gracefully
docs: update architecture diagram
test: add integration tests for generate command
refactor: extract shared export mappings
```

## Adding a New Export Target

To add support for a new AI tool (e.g., "cursor"):

1. Add the tool to `SUPPORTED_TOOLS` in `src/lib/templates.ts`
2. Add a case in `getExportStructure()` and `getExportMappings()` in `src/lib/export-mappings.ts`
3. Add the tool to the multiselect in `src/lib/prompts.ts`
4. Add template files under `templates/pi/cursor/` if needed
5. Write tests in `tests/integration.test.ts`

## Adding a New Validator Script

1. Create `templates/pi/scripts/validate-<name>.sh`
2. Add the validator name to `AVAILABLE_VALIDATORS` in `src/lib/templates.ts`
3. Add a TOML validator definition in `templates/pi/validators/default.toml`
4. Update the `shouldSkipFile()` function in `src/commands/init.ts` if needed

## Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/integration.test.ts

# Run with verbose output
bun test --verbose
```

New features should include tests. Integration tests in `tests/integration.test.ts` cover the init → generate → update lifecycle.

## Reporting Issues

- **Bug reports:** Include OS, Bun version, Guardian version, and reproduction steps.
- **Feature requests:** Describe the use case and expected behavior.
- **Security issues:** See [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
