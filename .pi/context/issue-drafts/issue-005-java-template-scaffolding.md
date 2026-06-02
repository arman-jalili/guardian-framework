# Issue: Scaffold Java templates during init

## Epic: EPIC-002 — Build Tool Selection & Init Integration

## Type: Feature

## Priority: High

### Description
Enable the init command to scaffold Java-specific template content when the user selects "java" as their language. This includes rendering build-tool-appropriate templates, applying Java language patterns, and generating Java-specific validator scripts.

### Acceptance Criteria
- [ ] `init --lang java` scaffolds all `.pi/` directory structure with Java-specific content
- [ ] Java patterns from `java-patterns.md` appear in `.pi/context/patterns.md`
- [ ] Language-specific validator scripts scaffolded to `.pi/scripts/languages/java/`
- [ ] `{{BUILD_TOOL}}` and `{{BUILD_COMMAND}}` correctly substituted in templates
- [ ] Existing behavior for TypeScript, Rust, Python, Go languages unchanged
- [ ] Manifest correctly tracks Java-scaffolded files

### Implementation Notes
- File: `src/commands/init.ts` — add Java scaffold branch
- File: `src/lib/templates.ts` — ensure getPiTemplateFiles/language-patterns handles Java
- Follow the same flow as existing language scaffolds

### Dependencies
- Depends on: `#JAVA-001`, `#JAVA-003`, `#JAVA-004`
- Blocks: All validator-related issues

### Estimated Scope
- Files: 2 (init.ts + templates.ts)
- Lines: ~80-120
- Validator Scope: Moderate

### Testing Requirements
- Integration test: `init --lang java` creates expected directory structure
- Integration test: `init --lang java --buildTool gradle` uses Gradle commands
- Verify all template placeholders resolve correctly

### Documentation Updates
- None required at this stage
