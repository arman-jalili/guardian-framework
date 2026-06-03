# Issue: Unit tests for project-generator.ts

## Epic: EPIC-005 — Testing

## Type: Test

## Priority: High

### Description
Add unit tests for the structure generator (`src/lib/project-generator.ts`). Tests should verify correct directory tree generation for Java and TypeScript with decomposed interface sub-layers, module discovery, layer discovery, dry-run mode, and graceful error handling.

### Acceptance Criteria
- [ ] Test: generates correct tree for Java with 2 modules and `interfaces/http` + `interfaces/messaging` sub-layers
- [ ] Test: generates correct tree for TypeScript with `interfaces/http` + `interfaces/graphql` sub-layers
- [ ] Test: sub-layer paths with `/` create nested directories (e.g., `interfaces/http/` not flat)
- [ ] Test: module names parsed from architecture markdown files
- [ ] Test: ADR keyword detection for interface sub-layers (REST → http, GraphQL → graphql, etc.)
- [ ] Test: explicit layers from module doc override ADR detection
- [ ] Test: fallback to PROJECT_DEFAULTS when no ADRs or module doc config
- [ ] Test: dryRun returns planned paths without writing
- [ ] Test: empty architecture directory handled gracefully
- [ ] Coverage target: 90%

### Implementation Notes
- File: `tests/unit/project-generator.test.ts` (new)
- Create temporary test fixtures for architecture module `.md` files and ADR `.md` files
- Use `tmpdir()` pattern for isolated test directories

### Dependencies
- Depends on: EPIC-002 (project-generator implementation)

### Estimated Scope
- Files: 1 (new test file)
- Lines: ~200-250
- Scope: Moderate
