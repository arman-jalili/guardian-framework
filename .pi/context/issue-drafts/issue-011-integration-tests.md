# Issue: Integration tests for Java validators

## Epic: EPIC-004 — Testing & Documentation

## Type: Test

## Priority: High

### Description
Add integration tests for all 7 Java language-specific validator scripts plus the annotation and TOML validators. Tests should verify each validator script executes correctly against sample Java projects and produces expected results.

### Acceptance Criteria
- [ ] Each of the 7 validator scripts tested: ci, tests, architecture, security, canonical, operations, integration
- [ ] `validate-annotations.sh` tested against sample Java projects with and without violations
- [ ] `validate-spring-architecture.sh` tested against sample projects with layering violations
- [ ] `spring.toml` rules tested against sample Java code
- [ ] Tests include both passing and failing scenarios
- [ ] Scripts handle missing Java toolchain gracefully (tested)
- [ ] Scripts handle empty project directories gracefully (tested)
- [ ] Coverage target: 100% of validator scripts tested

### Implementation Notes
- File: `tests/integration/java-validators.test.ts` (new file)
- Create sample Java project fixtures in `tests/fixtures/java/`
- Use shell execution patterns from existing integration tests
- Each test case should include expected pass/fail output

### Dependencies
- Depends on: EPIC-003 (all validator scripts must exist first)

### Estimated Scope
- Files: 1 (new test file) + test fixtures
- Lines: ~200-300
- Validator Scope: Moderate

### Testing Requirements
- N/A — this IS the test issue

### Documentation Updates
- Test coverage reports updated
