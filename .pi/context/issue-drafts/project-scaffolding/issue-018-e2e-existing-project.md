# Issue: E2E test for existing project detection

## Epic: EPIC-005 — Testing

## Type: Test

## Priority: Medium

### Description
Add end-to-end test that verifies the existing project detection logic: when `src/` already exists, `guardian project create` should skip generation and print a warning. When `--force` is used, it should proceed.

### Acceptance Criteria
- [ ] Test: existing `src/` causes graceful skip without errors
- [ ] Test: existing `src/` with `--force` proceeds with generation
- [ ] Test: warning message mentions existing source path
- [ ] Test: no files modified when src/ exists and --force is not used

### Implementation Notes
- File: `tests/e2e/project-create-existing.test.ts` (new)
- Create a directory with pre-existing `src/` content
- Run project create and verify no new files added

### Dependencies
- Depends on: EPIC-004 (existing project detection)

### Estimated Scope
- Files: 1 (new test file)
- Lines: ~80-100
- Scope: Simple
