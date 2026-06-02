# Issue: Add buildTool prompt in init

## Epic: EPIC-002 — Build Tool Selection & Init Integration

## Type: Feature

## Priority: High

### Description
Add an interactive prompt in the init flow that asks users whether they want to use **Maven** or **Gradle** as their build tool, but only when the selected language is "java". The selection affects generated build commands and script defaults.

This requires both the prompt logic AND CLI argument registration in the entry point.

### Acceptance Criteria
- [ ] `--buildTool` flag registered in `src/index.ts` via `parseArgs` options (alongside `--tool`, `--lang`, `--validators`, etc.)
- [ ] `buildTool` type defined: `"maven" | "gradle"`
- [ ] Interactive select prompt shown after language selection, only when `language === "java"`
- [ ] Prompt not shown for any other language
- [ ] Default value is `"maven"` if not explicitly chosen
- [ ] `--buildTool` flag works in non-interactive mode (e.g., `guardian init --lang java --buildTool gradle`)
- [ ] Selection stored in template context and available for substitution
- [ ] `guardian-manifest.json` tracks the `buildTool` value

### Implementation Notes
- **File: `src/index.ts`** — Add `buildTool` to `parseArgs` options definition alongside existing `tool`, `lang`, `validators`, `workflows` flags. This is the CLI entry point and every CLI-accessible flag must be registered here.
- **File: `src/lib/prompts.ts`** — Add prompt logic for build tool selection
- **File: `src/commands/init.ts`** — Pass buildTool from parsed args → prompt → context
- Follow existing pattern of `--lang` flag registration (string type, optional)
- Build tool-specific defaults should override LANGUAGE_DEFAULTS.java fields

### Dependencies
- Depends on: `#JAVA-001` (Java must be registered first)
- Blocks: `#JAVA-005` (scaffold Java templates)

### Estimated Scope
- Files: 3 (`src/index.ts`, `src/lib/prompts.ts`, `src/commands/init.ts`)
- Lines: ~60-80
- Validator Scope: Simple

### Testing Requirements
- Unit test: prompt shown when lang="java", hidden for other languages
- Unit test: default is "maven"
- Integration test: `--buildTool gradle` flag works in non-interactive mode
- Integration test: `--buildTool` unknown value rejected gracefully

### Documentation Updates
- Update `docs/README.md` with `--buildTool` flag documentation
