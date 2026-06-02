# Issue: Create java-patterns.md

## Epic: EPIC-001 — Java Language Registration & Patterns

## Type: Feature

## Priority: High

### Description
Create `templates/languages/java-patterns.md` — a comprehensive reference of Java and Spring Boot code patterns, conventions, and templates for AI agents. This is analogous to the existing `rust-patterns.md` and is loaded during init to produce `.pi/context/patterns.md`.

### Acceptance Criteria
- [ ] File created at `templates/languages/java-patterns.md`
- [ ] Contains **Clean Architecture layering** section — `domain/`, `application/`, `infrastructure/`, `interfaces/` package structure with dependency rules
- [ ] Contains **Spring Annotations reference** — `@Service`, `@Repository`, `@Controller`, `@RestController`, `@Transactional`, `@PostConstruct`, `@PreAuthorize`, `@Cacheable`, `@Async`, `@Scheduled`, `@EventListener`
- [ ] Contains **DI Patterns** — Constructor injection (preferred), setter injection, field injection (discouraged)
- [ ] Contains **JPA Patterns** — Entity design, repository interfaces, `@Query`, projections, auditing
- [ ] Contains **Testing Patterns** — `@SpringBootTest`, test slices (`@WebMvcTest`, `@DataJpaTest`), Mockito, AssertJ
- [ ] Contains **Error Handling** — `@ControllerAdvice`, `ResponseEntity`, problem details RFC 7807
- [ ] Contains **Configuration** — `@ConfigurationProperties`, `@Value`, profile-specific config
- [ ] Contains **Transaction Management** — `@Transactional` on service layer, readOnly flag, propagation levels, rollback rules
- [ ] Follows the same structure and formatting as `rust-patterns.md`

### Implementation Notes
- File: `templates/languages/java-patterns.md` (new file)
- Follow the structure of `templates/languages/rust-patterns.md` for consistency
- Use Java code blocks with proper syntax highlighting
- Include practical examples for each pattern

### Dependencies
- None — can be completed in parallel with Issue #JAVA-001

### Estimated Scope
- Files: 1 (new `templates/languages/java-patterns.md`)
- Lines: ~300-400 (comprehensive patterns reference)
- Validator Scope: Moderate

### Testing Requirements
- Verify template renders without errors during init
- Verify generated `.pi/context/patterns.md` includes Java sections when `--lang java` is used

### Documentation Updates
- The file itself IS the documentation
