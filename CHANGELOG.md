# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Result type pattern (`src/lib/result.ts`) — library functions return `Result<T, E>` instead of throwing
- `upgrade` command — schema migration with `--dryRun` support
- `--verbose` flag for `validate` command — shows detailed validator output
- YAML package (`yaml`) — replaces 120-line custom YAML parser with proper serialization
- CI workflow (`.github/workflows/ci.yml`) — automated test/lint/build on push/PR
- Release workflow (`.github/workflows/release.yml`) — npm publish on tag
- Issue templates (bug report, feature request)
- PR template with checklist
- `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE` (MIT)
- Integration tests — init → generate → update lifecycle, TOML validators, retry utilities
- Unit tests for code-filter, integrity, tracking, trust, workflow-config (97 new tests)
- `toYamlFrontMatter()` export for proper YAML round-tripping
- `docs/README.md` — documentation index

### Changed

- `scaffoldPiDirectory` no longer silently aborts on error — collects and reports errors
- Export generation in `init.ts` now delegates to `generateExport()` from `generate.ts` (deduplication)
- README: token savings claims now include methodology breakdown
- `estimateTokens()` documented with ±15% accuracy limitation
- `package.json` — added `repository`, `homepage`, `bugs`, `engines`, author metadata

### Fixed

- `process.exit(1)` removed from `validate.ts` — now returns error via `outro()`
- `calculateBackoff` deduplicated — single source in `retry.ts`, re-exported from `retry-queue.ts`
- `runMerge` (init → merge) — was TODO placeholder, now delegates to `update` command
- `tracking.ts` header — corrected "SQLite" → "JSON"
- TOML parser — fixed crash on global keys (`schema_version`) outside filter sections
- TypeScript regex in `code-filter.ts` — now captures `export` keyword

[Unreleased]: https://github.com/arman-jalili/guardian-cli/compare/v0.1.0...HEAD
