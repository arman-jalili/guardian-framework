# Issue: Register Java in SUPPORTED_LANGUAGES

## Epic: EPIC-001 — Java Language Registration & Patterns

## Type: Feature

## Priority: High

### Description
Add Java as a recognized Guardian language by registering it in the `SUPPORTED_LANGUAGES` array and adding a `LANGUAGE_DEFAULTS` block with Maven build/test/lint/format commands. This is the foundational step that enables all downstream Java functionality.

### Acceptance Criteria
- [ ] `"java"` added to `SUPPORTED_LANGUAGES` const array in `src/lib/templates.ts`
- [ ] `LANGUAGE_DEFAULTS` block added for `java` with Maven commands:
  - `buildCommand: "mvn clean compile -q"`
  - `testCommand: "mvn test -q"`
  - `lintCommand: "mvn checkstyle:check -q"`
  - `formatCommand: "mvn spotless:apply"`
  - `formatCheckCommand: "mvn spotless:check"`
  - `securityAuditCommand: "mvn dependency-check:check"`
  - `errorHandlingPattern: "Spring @ControllerAdvice / Result type pattern"`
  - `tracingPattern: "Micrometer Observation / SLF4j MDC"`
  - `cancellationPattern: "Reactive Streams cancellation / @Async CompletableFuture"`
  - `atomicWritePattern: "Spring Data CrudRepository.save()"`
- [ ] Existing tests still pass after registration

### Implementation Notes
- File: `src/lib/templates.ts` — modify `SUPPORTED_LANGUAGES` array and `LANGUAGE_DEFAULTS` object
- Follow the exact pattern of existing languages (TypeScript, Rust, Python, Go)
- No behavior changes for existing languages

### Dependencies
- None — first issue in epic

### Estimated Scope
- Files: 1 (`src/lib/templates.ts`)
- Lines: ~25 (array entry + defaults block)
- Validator Scope: Simple

### Testing Requirements
- Unit tests verify SUPPORTED_LANGUAGES includes "java"
- Unit tests verify LANGUAGE_DEFAULTS.java has all required fields

### Documentation Updates
- None required at this stage
