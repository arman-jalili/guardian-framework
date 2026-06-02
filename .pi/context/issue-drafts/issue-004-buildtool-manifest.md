# Issue: Store buildTool in manifest + template context

## Epic: EPIC-002 — Build Tool Selection & Init Integration

## Type: Feature

## Priority: Medium

### Description
Store the user's build tool selection (Maven/Gradle) in `guardian-manifest.json` and thread it through the template context so that `{{BUILD_TOOL}}`, `{{BUILD_COMMAND}}`, and other build-tool-sensitive placeholders resolve correctly.

This touches the typed TemplateContext interface and context-building pipeline, not just the manifest.

### Acceptance Criteria
- [ ] `TemplateContext` interface in `src/lib/templates.ts` gains a `buildTool: "maven" | "gradle"` field
- [ ] `getDefaultContext()` in `src/lib/templates.ts` accepts `buildTool` and uses it to select Maven vs Gradle defaults for:
  - `buildCommand` → `"mvn clean compile -q"` vs `"gradle build -q"`
  - `testCommand` → `"mvn test -q"` vs `"gradle test -q"`
  - `lintCommand` → `"mvn checkstyle:check -q"` vs `"gradle checkstyleMain -q"`
  - `formatCommand` → `"mvn spotless:apply"` vs `"gradle spotlessApply"`
  - `formatCheckCommand` → `"mvn spotless:check"` vs `"gradle spotlessCheck"`
  - `securityAuditCommand` → `"mvn dependency-check:check"` vs `"gradle dependencyCheck"`
- [ ] `buildTool` field added to manifest schema and stored in `guardian-manifest.json` during init
- [ ] `{{BUILD_TOOL}}` resolves to `"Maven"` or `"Gradle"`
- [ ] `{{BUILD_COMMAND}}` resolves to the selected tool's build command
- [ ] Template context preserved across `guardian update` (smart merge preserves user choice via front-matter)
- [ ] `guardian info` displays the build tool selection

### Implementation Notes
- **File: `src/lib/templates.ts`** — This is the main file. Changes:
  1. Add `buildTool: "maven" | "gradle"` to the `TemplateContext` interface (20+ typed fields already exist)
  2. Update `getDefaultContext()` signature to accept `buildTool` parameter
  3. Add a `LANGUAGE_DEFAULTS.java.maven` and `LANGUAGE_DEFAULTS.java.gradle` sub-object, or switch on buildTool inside `getDefaultContext()`
- **File: `src/lib/manifest.ts`** — Add `buildTool` to manifest schema definition
- **File: `src/commands/info.ts`** — Display buildTool in `guardian info` output
- Follow existing pattern: `language` field is already in TemplateContext and manifest, so `buildTool` follows the same pipeline

### Dependencies
- Depends on: `#JAVA-003` (add buildTool prompt — provides the selected value)
- Blocks: `#JAVA-005` (scaffold Java templates — needs context to render correctly)

### Estimated Scope
- Files: 3 (`src/lib/templates.ts`, `src/lib/manifest.ts`, `src/commands/info.ts`)
- Lines: ~60-80
- Validator Scope: Simple

### Testing Requirements
- Unit test: manifest contains buildTool after Java init
- Unit test: TemplateContext.buildTool set correctly for both Maven and Gradle
- Unit test: `getDefaultContext()` returns Maven-specific commands when buildTool="maven"
- Unit test: `getDefaultContext()` returns Gradle-specific commands when buildTool="gradle"
- Unit test: `{{BUILD_COMMAND}}` resolves to different values based on buildTool

### Documentation Updates
- None required
