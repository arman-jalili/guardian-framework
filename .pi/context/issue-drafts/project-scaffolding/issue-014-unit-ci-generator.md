# Issue: Unit tests for ci-generator.ts

## Epic: EPIC-005 — Testing

## Type: Test

## Priority: High

### Description
Add unit tests for the CI pipeline generator (`src/lib/ci-generator.ts`). Tests should verify correct GitHub Actions and GitLab CI YAML generation, runner image selection, and dry-run mode.

### Acceptance Criteria
- [ ] Test: generates valid GitHub Actions YAML with correct jobs
- [ ] Test: generates valid GitLab CI YAML with correct stages
- [ ] Test: correct runner image for Java Maven
- [ ] Test: correct runner image for Java Gradle
- [ ] Test: correct runner image for TypeScript
- [ ] Test: dryRun returns YAML without writing
- [ ] Test: unsupported repoTool handled gracefully
- [ ] Coverage target: 90%

### Implementation Notes
- File: `tests/unit/ci-generator.test.ts` (new)

### Dependencies
- Depends on: EPIC-003 (ci-generator implementation)

### Estimated Scope
- Files: 1 (new test file)
- Lines: ~100-150
- Scope: Moderate
