# Architecture Changelog

All notable changes to Guardian's architecture are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Java & Spring Boot Language Support — full implementation:
  - Java registered in SUPPORTED_LANGUAGES with Maven defaults
  - java-patterns.md with 8 sections (Clean Architecture, annotations, DI, JPA, tests, error handling, config, transactions)
  - Build tool selection prompt (Maven/Gradle) in init flow
  - buildTool field in TemplateContext and manifest
  - 7 language-specific Java validator scripts (ci, tests, architecture, security, canonical, operations, integration)
  - validate-annotations.sh for Spring annotation enforcement
  - validate-spring-architecture.sh for package ring enforcement
  - spring.toml declarative validation rules with inline tests
  - validation-runner.ts updated for language-specific script discovery
  - shouldSkipFile updated to filter language scripts by language
  - 3 test files: unit (java-support.test.ts), integration (java-validators.test.ts), E2E (java-init-e2e.test.ts)
- ADR-001: Pi-First Architecture — single source of truth, generated exports
- ADR-002: Bun Runtime — fast startup, native TypeScript, npm-compatible
- ADR-003: Template-Based Generation — file-based templates with placeholder substitution
- ADR-004: Multi-Export Model — pi generates claude, opencode, agents, github exports
- ADR-005: Symphony-Inspired Orchestration — lifecycle hooks, retry with backoff, reconciliation
- ADR-006: Token Optimization Strategy — DRY context, snippets, compaction, tiered prompts
- ADR-007: Test Strategy — unit + integration + E2E layers, zero external deps
- Module docs: CLI entry point, init command, generate command, update command, template system, manifest system, core libraries, java-spring-support, project-scaffolding-epic0
- `.pi/context/project.md` — project-specific knowledge for agents
- `.pi/domain/` — planned directory for DDD bounded context discovery
- `.pi/domain/ubiquitous-language.md` — DDD ubiquitous language glossary with 18 canonical terms and alias tracking
- `.pi/scripts/validate-ubiquitous-language.sh` — drift detection validator that parses glossary and scans src/ for alias usage
- `.pi/validators/default.toml` — `ubiquitous-language` TOML filter registered for `--validators` discovery

### Changed

- `.pi/agent/AGENTS.md` — customized with real guardian-framework project context (build commands, architecture structure, key files, quality gates)
- `.pi/architecture/CHANGELOG.md` — populated with project's actual changelog entries

## [0.1.0] — 2026-04-25

### Added

- Result type pattern (`src/lib/result.ts`)
- Upgrade command with schema migration
- YAML front matter parsing via `yaml` package
- CI workflow (`.github/workflows/ci.yml`)
- Release workflow (`guardian-framework-release.yml`)
- Integration tests for init -> generate -> update lifecycle
- 97 unit tests across 6 library modules
- Documentation index (`docs/README.md`)
- Issue templates, PR template, CONTRIBUTING.md, SECURITY.md
- Export generation deduplication via `generateExport()` in `init.ts`

### Fixed

- TOML parser crash on global keys outside filter sections
- TypeScript regex in code-filter now captures `export` keyword
- `process.exit(1)` removed from validate command
- `tracking.ts` header corrected from "SQLite" to "JSON"
- `runMerge` now delegates to update command instead of TODO placeholder

[Unreleased]: https://github.com/arman-jalili/guardian-framework/compare/v0.1.0...HEAD
