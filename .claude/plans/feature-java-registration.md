# Batch Plan: Java Language Registration & Patterns

**Branch:** `feature/java-registration`
**Issues:** #10, #12
**Target Files:**
1. `src/lib/templates.ts` — Register Java in SUPPORTED_LANGUAGES + LANGUAGE_DEFAULTS
2. `templates/languages/java-patterns.md` — New file

---

## Issue #10 — Register Java in SUPPORTED_LANGUAGES

### Files
- `src/lib/templates.ts`

### Changes
1. Add `"java"` to `SUPPORTED_LANGUAGES` const array
2. Add `java` block to `LANGUAGE_DEFAULTS`:
```typescript
java: {
  buildCommand: "mvn clean compile -q",
  testCommand: "mvn test -q",
  lintCommand: "mvn checkstyle:check -q",
  formatCommand: "mvn spotless:apply",
  formatCheckCommand: "mvn spotless:check",
  securityAuditCommand: "mvn dependency-check:check",
  errorHandlingPattern: "Spring @ControllerAdvice / Result type pattern",
  tracingPattern: "Micrometer Observation / SLF4j MDC",
  cancellationPattern: "Reactive Streams cancellation / @Async CompletableFuture",
  atomicWritePattern: "Spring Data CrudRepository.save()",
}
```

### Validation
- `bun test` passes
- `SUPPORTED_LANGUAGES.includes("java")` is true
- Defaults have all required fields

---

## Issue #12 — Create java-patterns.md

### Files
- `templates/languages/java-patterns.md` (new file)

### Sections (matching architecture module doc)
1. Clean Architecture layering — package structure, dependency rules
2. Spring Annotations reference — @Service, @Repository, etc.
3. DI Patterns — constructor injection preferred
4. JPA Patterns — entities, repositories, @Query
5. Testing Patterns — @SpringBootTest, test slices
6. Error Handling — @ControllerAdvice, RFC 7807
7. Configuration — @ConfigurationProperties, profiles
8. Transaction Management — @Transactional semantics

### Structure
Follow `templates/languages/rust-patterns.md` format exactly.

---

## Implementation Order
1. #10 — Register language (5 min)
2. #12 — Create patterns file (15 min)

## Validation
```bash
bun test
bun run src/index.ts --help  # verify no crash
```
