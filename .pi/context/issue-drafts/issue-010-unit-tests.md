# Issue: Unit tests for Java support

## Epic: EPIC-004 — Testing & Documentation

## Type: Test

## Priority: High

### Description
Add unit tests for all Java language support components. This ensures that language registration, defaults, prompt logic, and template rendering work correctly and continue to work after future changes.

### Acceptance Criteria
- [ ] Tests verify `SUPPORTED_LANGUAGES` includes `"java"`
- [ ] Tests verify `LANGUAGE_DEFAULTS.java` has all required fields with correct defaults
- [ ] Tests verify `buildTool` type is correctly set (maven/gradle) based on prompt selection
- [ ] Tests verify template context includes build-tool-appropriate values
- [ ] Tests verify prompt is shown only when lang="java"
- [ ] Tests verify prompt is hidden for all other languages
- [ ] Tests verify `--buildTool` flag works in non-interactive mode
- [ ] Tests verify manifest contains buildTool after Java init
- [ ] Coverage target: 90% of new Java-related code
- [ ] All existing tests still pass

### Implementation Notes
- File: `tests/unit/templates.test.ts` (extend existing)
- File: `tests/unit/init.test.ts` (extend existing or create new `tests/unit/java-support.test.ts`)
- Follow existing test patterns in `tests/` directory

### Dependencies
- Depends on: EPIC-001, EPIC-002, EPIC-003 implementation
- Must come after all Java code is implemented

### Estimated Scope
- Files: 2-3 (new or extended test files)
- Lines: ~150-200
- Validator Scope: Moderate

### Testing Requirements
- N/A — this IS the test issue

### Documentation Updates
- Test coverage reports updated
