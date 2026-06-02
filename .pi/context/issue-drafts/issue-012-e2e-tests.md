# Issue: E2E tests for Java init lifecycle

## Epic: EPIC-004 — Testing & Documentation

## Type: Test

## Priority: High

### Description
Add end-to-end tests that cover the full Java init lifecycle: `init --lang java` → generate exports → run validators. This ensures the complete Java support flow works from user's perspective.

### Acceptance Criteria
- [ ] E2E test: `init --lang java` scaffolds all expected files
- [ ] E2E test: `init --lang java --buildTool gradle` uses Gradle commands
- [ ] E2E test: `init --lang java` then `generate` produces correct exports
- [ ] E2E test: Validators run without errors after Java init
- [ ] E2E test: Spring annotation check catches violations in a sample project
- [ ] E2E test: Architecture layering check catches violations
- [ ] E2E test: Language defaults match Maven toolchain
- [ ] E2E test: Language defaults match Gradle toolchain (separate test)
- [ ] All E2E tests run in isolated temporary directories

### Implementation Notes
- File: `tests/e2e/java-init.test.ts` (new file)
- Use temporary directory pattern for clean test isolation
- Follow existing E2E test patterns from `tests/` directory

### Dependencies
- Depends on: EPIC-001, EPIC-002, EPIC-003 fully implemented
- Must come after all other implementation

### Estimated Scope
- Files: 1 (new test file) + test fixtures if needed
- Lines: ~150-250
- Validator Scope: Moderate

### Testing Requirements
- N/A — this IS the test issue

### Documentation Updates
- Test coverage reports updated
