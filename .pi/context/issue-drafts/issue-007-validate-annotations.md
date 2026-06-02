# Issue: Create validate-annotations.sh

## Epic: EPIC-003 — Validator Scripts & Spring Enforcement

## Type: Feature

## Priority: High

### Description
Create a shell-based annotation validation script that enforces Spring Boot conventions mechanically, replacing LLM-based checks with zero-token validators. This script checks for proper use of `@Transactional`, `@PostConstruct`, field injection, and layering violations.

### Acceptance Criteria
- [ ] `@Transactional` check: Every public method in `@Service` classes must have `@Transactional` or `@Transactional(readOnly = true)`
- [ ] `@PostConstruct` check: Only allowed in `service/`, `config/`, `component/` packages, never in controllers
- [ ] Field injection check: Flag `@Autowired` on fields (constructor injection required)
- [ ] Layering check: `web/` must not import `repository/` directly; `domain/` must not import `web/` or `infrastructure/`
- [ ] Package naming check: Enforce `com.{project}.{layer}.{component}` structure
- [ ] All violations listed with file path and line number
- [ ] Exit 0 if no violations, exit 1 if violations found
- [ ] Handles empty projects gracefully

### Implementation Notes
- File: `templates/pi/scripts/validate-annotations.sh` (new file)
- Use `grep`, `find`, `awk`, and standard Unix tools — no Java runtime needed for scanning
- Combine with `.pi/scripts/validate-spring-architecture.sh` for comprehensive enforcement
- Consider performance: scanning a 100K LOC project should complete in < 5 seconds

### Dependencies
- None — standalone script that reads Java source files

### Estimated Scope
- Files: 1 (new shell script)
- Lines: ~150-200
- Validator Scope: Moderate

### Testing Requirements
- Test against a sample Java project with intentional annotation violations
- Verify it correctly flags missing `@Transactional`
- Verify it correctly allows `@PostConstruct` in service/config/component packages
- Verify it correctly flags field `@Autowired`

### Documentation Updates
- None — script is self-documenting with `--help` flag
