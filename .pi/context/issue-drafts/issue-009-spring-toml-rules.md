# Issue: Create spring.toml declarative rules

## Epic: EPIC-003 — Validator Scripts & Spring Enforcement

## Type: Feature

## Priority: Medium

### Description
Create a TOML-based declarative rules file that defines Spring Boot convention enforcement checks for the TOML filter pipeline. These rules provide zero-token validation that runs as part of the `toml-filter.ts` pipeline alongside the shell-based validators.

### Acceptance Criteria
- [ ] File created at `.pi/validators/spring.toml`
- [ ] `[checks.transactional]` — Verifies all `@Service` classes have `@Transactional` annotations
- [ ] `[checks.layering]` — Detects domain layer importing infrastructure packages
- [ ] `[checks.injection]` — Detects field `@Autowired` (constructor injection required)
- [ ] Each check has: `description`, `pattern`, `check` fields
- [ ] Each check has: `[[tests.*]]` blocks with sample input and expected output
- [ ] Rules integrate with the TOML filter pipeline (`--validators` discovery)
- [ ] Rules follow the same format as existing `.pi/validators/default.toml`

### Implementation Notes
- File: `.pi/validators/spring.toml` (new file)
- Reference: `.pi/validators/default.toml` for format and conventions
- Reference: `src/lib/toml-filter.ts` for how rules are executed
- Format example:
  ```toml
  [checks.transactional]
  description = "All @Service public methods must have @Transactional"
  pattern = "class.*@Service"
  check = "grep -c '@Transactional' <file> | assert >= 1"

  [[checks.transactional.tests]]
  input = "..."
  expect = "pass"
  ```

### Dependencies
- None — standalone TOML rules file

### Estimated Scope
- Files: 1 (new `.pi/validators/spring.toml`)
- Lines: ~60-80
- Validator Scope: Moderate

### Testing Requirements
- Integration test: TOML rules parse correctly
- Integration test: Each rule correctly passes/fails against sample Java source
- Integration test: Rules registered in `--validators` discovery

### Documentation Updates
- None — TOML files are self-documenting
