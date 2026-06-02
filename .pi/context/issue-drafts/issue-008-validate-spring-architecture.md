# Issue: Create validate-spring-architecture.sh

## Epic: EPIC-003 — Validator Scripts & Spring Enforcement

## Type: Feature

## Priority: Medium

### Description
Create a shell-based architecture enforcement script that validates Spring Boot project package ring boundaries and dependency direction. This ensures Clean Architecture layering is maintained within Java/Spring projects.

**Coupled with Issue #14 (validate-annotations.sh):** The architecture checker must know which packages belong to which layer ring — this is the same convention that `validate-annotations.sh` uses for `@PostConstruct` placement and import layering. The two scripts should share a common convention definition.

### Acceptance Criteria
- [ ] Validates package ring boundaries: `domain/` → `application/` → `infrastructure/` → `interfaces/`
- [ ] Ensures `domain/` has zero external dependencies (no imports from outside layers)
- [ ] Ensures `application/` only depends on `domain/`
- [ ] Ensures `infrastructure/` depends on `application/` and `domain/` but NOT on `interfaces/`
- [ ] Ensures `interfaces/` (web layer) depends on `application/` but NOT directly on `domain/` or `infrastructure/`
- [ ] Package ring definitions are consistent with those in `validate-annotations.sh` (shared convention — consider extracting to a shared config or source file)
- [ ] Lists all violations with file path, line number, and import statement
- [ ] Exit 0 if no violations, exit 1 if violations found
- [ ] Handles projects without package structure gracefully

### Implementation Notes
- File: `templates/pi/scripts/validate-spring-architecture.sh` (new file)
- Use `grep` and `find` to scan Java import statements
- **Coordinate with Issue #14:** If both define package ring mappings (e.g., `domain=com.*.domain`, `application=com.*.application`, etc.), extract them to a shared source to prevent drift. Options:
  - A shared `.pi/scripts/languages/java/spring-conventions.sh` that both scripts source
  - The same inline constants, documented as coupled
- Reference: Clean Architecture by Robert C. Martin

### Dependencies
- **Depends on: #14** (validate-annotations.sh) — package ring definitions must be consistent between the two scripts. Coordinate convention design before or alongside implementation.
- Can be implemented in parallel if a shared convention file is agreed upon first.

### Estimated Scope
- Files: 1 (new shell script) + possibly 1 shared convention file
- Lines: ~80-120
- Validator Scope: Simple

### Testing Requirements
- Test against a sample Java project with intentional layering violations
- Verify it catches domain→infrastructure imports
- Verify it allows correct dependency chains
- Verify package ring definitions match those in validate-annotations.sh

### Documentation Updates
- None — script is self-documenting with `--help` flag
