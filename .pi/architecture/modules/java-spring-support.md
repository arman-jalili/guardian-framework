# Java & Spring Boot Language Support Architecture

<!--
Canonical Reference: .pi/architecture/modules/java-spring-support.md
Blueprint Source: Guardian Framework v2.2
Generated: NEVER (this is the source)
-->

## Overview

Add Java as a first-class Guardian language with Spring Boot conventions. Covers language registration, code patterns, build tool selection (Maven/Gradle), language-specific validator scripts, and Spring annotation enforcement via shell-based checks and TOML declarative rules.

This is a scaffolding surface — it doesn't add runtime dependencies or change the CLI's core. Every piece follows existing patterns from the TypeScript, Rust, Python, and Go language modules.

## Responsibilities

- Register Java in `SUPPORTED_LANGUAGES` with Maven and Gradle build defaults
- Provide `templates/languages/java-patterns.md` with Spring Boot idioms, clean architecture templates, JPA patterns, testing conventions
- Add build-tool selection prompt (`maven | gradle`) to the interactive init flow
- Generate language-specific validators (ci, tests, architecture, security, canonical, operations, integration) adapted for Java toolchains
- Enforce Spring Boot conventions via shell-based annotation validators and TOML declarative rules

## Components

| Component | File Path | Purpose | Canonical Section |
|-----------|-----------|---------|-------------------|
| Language Registration | src/lib/templates.ts | Add "java" to SUPPORTED_LANGUAGES, LANGUAGE_DEFAULTS block | #language-registration |
| Language Patterns | templates/languages/java-patterns.md | Spring Boot idioms, clean architecture, JPA, testing | #language-patterns |
| Build Tool Selection | src/lib/prompts.ts | Interactive prompt for Maven vs Gradle | #build-tool-selection |
| Validator Scripts | templates/pi/scripts/languages/java/ | 7 language-specific shell validators | #validator-scripts |
| Spring Annotation Validators | .pi/validators/spring.toml, .pi/scripts/validate-annotations.sh | @Transactional, layering, field injection checks | #annotation-enforcement |
| Architecture Enforcement | .pi/scripts/validate-spring-architecture.sh | Package ring boundaries, dependency direction | #architecture-enforcement |

---

## Component Details

### Language Registration

**Purpose:** Register Java as a recognized Guardian language with sensible build defaults.

**Implementation File:** `src/lib/templates.ts`

**Canonical Reference:** `.pi/architecture/modules/java-spring-support.md#language-registration`

**Dependencies:**
- Template System (SUPPORTED_LANGUAGES array)
- Init Command (language picker prompt)

**Interface:**
```typescript
// Add to SUPPORTED_LANGUAGES
export const SUPPORTED_LANGUAGES = ["typescript", "rust", "python", "go", "java"] as const;

// Add to LANGUAGE_DEFAULTS
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

### Language Patterns

**Purpose:** Provide Java and Spring Boot code patterns, conventions, and templates for AI agents.

**Implementation File:** `templates/languages/java-patterns.md`

**Canonical Reference:** `.pi/architecture/modules/java-spring-support.md#language-patterns`

**Expected sections (analogous to existing rust-patterns.md):**
- **Clean Architecture layering** — `domain/`, `application/`, `infrastructure/`, `interfaces/` package structure with dependency rules
- **Spring Annotations reference** — `@Service`, `@Repository`, `@Controller`, `@RestController`, `@Transactional`, `@PostConstruct`, `@PreAuthorize`, `@Cacheable`, `@Async`, `@Scheduled`, `@EventListener`
- **DI Patterns** — Constructor injection (preferred), setter injection, field injection (discouraged)
- **JPA Patterns** — Entity design, repository interfaces, `@Query`, projections, auditing
- **Testing Patterns** — `@SpringBootTest`, test slices (`@WebMvcTest`, `@DataJpaTest`), Mockito, AssertJ
- **Error Handling** — `@ControllerAdvice`, `ResponseEntity`, problem details RFC 7807
- **Configuration** — `@ConfigurationProperties`, `@Value`, profile-specific config
- **Transaction Management** — `@Transactional` on service layer, readOnly flag, propagation levels, rollback rules

### Build Tool Selection

**Purpose:** Let users choose Maven or Gradle during init, affecting generated build commands and script defaults.

**Implementation File:** `src/lib/prompts.ts`

**Canonical Reference:** `.pi/architecture/modules/java-spring-support.md#build-tool-selection`

**Design:**
- Add `buildTool` type: `"maven" | "gradle"`
- Add a select prompt after the language picker, only when language is "java"
- Store in manifest and template context
- Substitutes `{{BUILD_TOOL}}`, `{{BUILD_COMMAND}}`, etc. in templates

### Validator Scripts

**Purpose:** Language-specific validation scripts that replace generic ones for Java projects.

**Implementation Directory:** `templates/pi/scripts/languages/java/`

**Canonical Reference:** `.pi/architecture/modules/java-spring-support.md#validator-scripts`

| Script | Checks |
|--------|--------|
| validate-ci.sh | mvn clean verify (or gradle build), checkstyle, spotbugs |
| validate-tests.sh | Test coverage thresholds, test result parsing |
| validate-architecture.sh | Package layering, clean arch ring violations |
| validate-security.sh | @PreAuthorize coverage, CSRF, dependency check |
| validate-canonical.sh | Canonical reference integrity (generic — language-agnostic) |
| validate-operations.sh | Actuator readiness, health endpoints, @Scheduled patterns |
| validate-integration.sh | Test slice correctness, context caching, DB state management |

### Spring Annotation Enforcement (Shell + TOML)

**Purpose:** Enforce Spring Boot conventions mechanically, replacing LLM-based checks with zero-token validators.

**Implementation Files:**
- `.pi/scripts/validate-annotations.sh` — Shell-based annotation checks
- `.pi/validators/spring.toml` — Declarative rules for the TOML filter pipeline
- `.pi/scripts/validate-spring-architecture.sh` — Package boundary enforcement

**Canonical Reference:** `.pi/architecture/modules/java-spring-support.md#annotation-enforcement`

**Annotation checks (shell):**
- `@Transactional` — every public method in `@Service` classes must have `@Transactional` or `@Transactional(readOnly = true)`
- `@PostConstruct` — only allowed in `service/`, `config/`, `component/` packages, never in controllers
- Field injection — flag `@Autowired` on fields (constructor injection required)
- Layering — `web/` must not import `repository/` directly; `domain/` must not import `web/` or `infrastructure/`
- Package naming — enforce `com.{project}.{layer}.{component}` structure

**TOML rules (spring.toml):**
```toml
[checks.transactional]
description = "All @Service public methods must have @Transactional"
pattern = "class.*@Service"
check = "grep -c '@Transactional' <file> | assert >= 1"

[checks.layering]
description = "Domain layer must not import infrastructure"
pattern = "package.*\\.domain\\."
check = "grep -r 'import.*\\.infrastructure\\.' src/main/java/**/domain/ 2>/dev/null | assert-empty"

[checks.injection]
description = "Field injection discouraged — use constructor injection"
pattern = "@Autowired"
check = "grep -rn '@Autowired' src/main/java/ 2>/dev/null | grep -v 'constructor' | assert-empty"
```

---

## Data Flow

```
User selects "java" during guardian init
     │
     ▼
Language registration writes build defaults
     │
     ├──→ Build tool prompt (Maven / Gradle)  ← only for Java
     │
     ▼
Template system loads java-patterns.md
     │
     ▼
Language-specific validators scaffolded
     │
     ├──→ validate-annotations.sh (annotation checks)
     ├──→ validate-spring-architecture.sh (layering)
     └──→ spring.toml (declarative rules)
     │
     ▼
Agent runs → validators enforce Spring conventions
```

---

## Dependencies

### Depends On
- **Template System**: SUPPORTED_LANGUAGES array, LANGUAGE_DEFAULTS, template rendering pipeline
- **Init Command**: Interactive prompts, scaffolding loop, export generation
- **Core Libraries**: Manifest tracking, workflow config parsing
- **TOML Filter Pipeline**: `.pi/validators/*.toml` loading and execution (existing RTK integration)

### Used By
- **Init Command**: Scaffolds Java project templates during init
- **Generate Command**: Exports Java-specific configs to selected harness targets
- **Update Command**: Smart-merges Java patterns on framework updates

---

## Security Considerations

| Concern | Mitigation | Validator |
|---------|------------|-----------|
| Dependency vulnerabilities | mvn dependency-check:check during CI | security-validator |
| Missing authorization on endpoints | @PreAuthorize / @Secured regex check | validate-annotations.sh |
| Injection in @Query annotations | JPA @Query parameter validation lint | architecture-validator |

**Data Protection:**
- No runtime data processing — validators only read source files
- No network calls from validators (Maven dependency-check is offline/CLI)

---

## Testing Requirements

| Test Type | Coverage Target | Files |
|-----------|-----------------|-------|
| Unit | 90% | tests/unit/templates.test.ts |
| Integration | 100% of validator scripts | tests/integration/java-validators.test.ts |
| E2E | Full init -> generate -> validate | tests/e2e/java-init.test.ts |

**Key Test Scenarios:**
- `init --lang java` scaffolds all expected files
- Language defaults match Maven and Gradle toolchains
- Annotation validators correctly flag missing `@Transactional`
- Layering validator catches domain->infrastructure imports
- TOML rules parse and execute correctly against sample Java projects

---

## Error Handling

- **Unrecognized build tool**: Default to Maven, warn user
- **Missing Java toolchain**: Validators exit gracefully (check `java --version` first)
- **Empty project**: Validators handle empty source trees without crashing

---

## Performance Considerations

| Metric | Target | Monitoring |
|--------|--------|------------|
| Validator execution | < 5s for 100K LOC project | CI pipeline |
| TOML rule evaluation | < 1s | Already covered by TOML pipeline |
| Template rendering | < 100ms | Already covered by template system |

---

## Change Log References

| Date | Change | Section | Status |
|------|--------|---------|--------|
| 2026-06-02 | Initial module creation | all | pending |

See full details in `.pi/architecture/CHANGELOG.md`

---

*Last updated: 2026-06-02*
*Module version: 0.1.0*

