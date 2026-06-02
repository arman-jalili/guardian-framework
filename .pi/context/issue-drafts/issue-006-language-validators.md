# Issue: Create 7 language-specific validators

## Epic: EPIC-003 — Validator Scripts & Spring Enforcement

## Type: Feature

## Priority: High

### Description
Create 7 shell-based validator scripts in `templates/pi/scripts/languages/java/` adapted for Java/Maven/Gradle toolchains. These follow the same pattern as existing TypeScript/Rust validators but use Java-specific commands and conventions.

### Acceptance Criteria
- [ ] `validate-ci.sh` — Runs `mvn clean verify` (or `gradle build`), checkstyle, spotbugs
- [ ] `validate-tests.sh` — Test coverage thresholds, test result parsing for surefire/failsafe reports
- [ ] `validate-architecture.sh` — Package layering, clean arch ring violations
- [ ] `validate-security.sh` — `@PreAuthorize` coverage check, CSRF configuration, dependency check
- [ ] `validate-canonical.sh` — Canonical reference integrity (language-agnostic, follows existing pattern)
- [ ] `validate-operations.sh` — Actuator readiness, health endpoints, `@Scheduled` patterns
- [ ] `validate-integration.sh` — Test slice correctness, Spring context caching, DB state management
- [ ] Each script handles missing Java toolchain gracefully (check `java --version` first)
- [ ] Each script handles empty project directories without crashing

### Implementation Notes
- Directory: `templates/pi/scripts/languages/java/` (7 new files)
- Follow existing scripts in `.pi/scripts/` as reference patterns
- Scripts should exit 0 on pass, 1 on fail (standard convention)
- Use `set -euo pipefail` for safety
- Include `--help` and `--verbose` flags per existing convention

### Dependencies
- Depends on: `#JAVA-005` (template scaffolding must support Java first)
- Parallel work possible: `#JAVA-007`, `#JAVA-008`, `#JAVA-009` can run alongside

### Estimated Scope
- Files: 7 (new shell scripts)
- Lines: ~50-80 per script = ~400-550 total
- Validator Scope: Moderate

### Testing Requirements
- Each script tested against a sample Java project (can be a known-good test fixture)
- Scripts handle missing Java gracefully
- Scripts handle empty directories gracefully

### Documentation Updates
- None — scripts are self-documenting with `--help` flag
