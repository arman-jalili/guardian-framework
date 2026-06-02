# Issue: Update validation-runner.ts and shouldSkipFile for Java-specific scripts

## Epic: EPIC-003 — Validator Scripts & Spring Enforcement

## Type: Feature

## Priority: High

### Description
Update the pi extension `validation-runner.ts` and the init flow's file-scaffolding logic (`shouldSkipFile`) to correctly handle language-specific Java validator scripts.

Currently, validators are global — they live under `scripts/` and apply to all projects regardless of language. The Java validators live under `scripts/languages/java/` and should only be scaffolded and executed when the project language is Java.

Two things need updating:

1. **`shouldSkipFile` logic** (in `src/commands/init.ts` or `src/lib/templates.ts`): When scaffolding template files, it currently filters scripts based on the validator selection. It needs an additional check: skip `scripts/languages/java/` files unless the selected language is Java.

2. **`.pi/extensions/validation-runner.ts`**: The extension that runs shell validators needs to discover scripts under `scripts/languages/java/` and only include them when the manifest says language=java.

### Acceptance Criteria
- [ ] `scripts/languages/java/*.sh` template files scaffolded only when `language === "java"`
- [ ] `scripts/languages/java/*.sh` NOT scaffolded for any other language (TypeScript, Rust, Python, Go)
- [ ] `.pi/extensions/validation-runner.ts` reads manifest language field and includes Java scripts only when applicable
- [ ] Existing validation behavior for all other languages unchanged
- [ ] Non-Java projects show no Java validators in `/validate` output

### Implementation Notes
- **File: `src/lib/templates.ts` (or `src/commands/init.ts`)** — Locate `shouldSkipFile()` or equivalent filtering function. Add a condition: if file path contains `scripts/languages/java/` AND `language !== "java"`, skip it.
- **File: `.pi/extensions/validation-runner.ts`** — In the validator discovery logic:
  1. Read manifest to get language
  2. Add `scripts/languages/java/` to the script search path only when language is Java
  3. Follow existing script discovery pattern
- The `shouldSkipFile` function may already filter by validator name — trace the code path to confirm

### Dependencies
- Depends on: `#JAVA-005` (Scaffold Java templates — creates the file paths)
- Depends on: `#JAVA-006` (7 validator scripts — provides the files to scaffold/include)

### Estimated Scope
- Files: 2 (`src/lib/templates.ts` or `src/commands/init.ts`, `.pi/extensions/validation-runner.ts`)
- Lines: ~30-50
- Validator Scope: Simple

### Testing Requirements
- Unit test: `shouldSkipFile` returns true for Java scripts when language is not Java
- Unit test: `shouldSkipFile` returns false for Java scripts when language is Java
- Integration test: `init --lang typescript` does NOT include Java validators in scaffolded output
- Integration test: `init --lang java` DOES include Java validators

### Documentation Updates
- None — internal plumbing change, user-facing behavior is the same
