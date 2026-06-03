# Issue: Unit tests for build-config.ts

## Epic: EPIC-005 — Testing

## Type: Test

## Priority: High

### Description
Add unit tests for the build configuration generator (`src/lib/build-config.ts`). Tests should verify correct `pom.xml`, `build.gradle`, and `package.json` generation with expected plugins and dependencies.

### Acceptance Criteria
- [ ] Test: generated pom.xml has JUnit 5, JaCoCo, Checkstyle, OWASP plugins
- [ ] Test: generated build.gradle has equivalent plugins
- [ ] Test: generated package.json has vitest, biome, prettier scripts
- [ ] Test: correct artifact/group/version substitution
- [ ] Test: dryRun returns without writing
- [ ] Test: unsupported language handled gracefully
- [ ] Coverage target: 90%

### Implementation Notes
- File: `tests/unit/build-config.test.ts` (new)

### Dependencies
- Depends on: EPIC-003 (build-config implementation)

### Estimated Scope
- Files: 1 (new test file)
- Lines: ~100-150
- Scope: Moderate
