# Issue: Layer discovery logic in project-generator

## Epic: EPIC-002 — Structure Generator

## Type: Feature

## Priority: Medium

### Description
Add intelligent layer discovery to the structure generator. The system must read architecture decisions from ADRs or the explicit `layers` field in module docs to determine which **decomposed interface sub-layers** to create. The key principle: interface sub-layers (http/, graphql/, messaging/, cli/) aren't hardcoded — they're derived from the project's actual delivery mechanisms.

If the architecture doesn't use GraphQL, `interfaces/graphql/` doesn't get created. The ADR or module doc drives which sub-layers exist.

### Acceptance Criteria
- [ ] Parses ADR content for delivery mechanism keywords (e.g., "REST", "GraphQL", "messaging", "events", "CLI", "scheduled")
- [ ] Checks module docs for explicit `layers:` field containing sub-layer paths
- [ ] When ADR mentions "REST" or "HTTP" → adds `interfaces/http/`
- [ ] When ADR mentions "GraphQL" → adds `interfaces/graphql/`
- [ ] When ADR mentions "messaging", "events", "pub/sub", "queues" → adds `interfaces/messaging/`
- [ ] When ADR mentions "CLI", "scheduled", "commands" → adds `interfaces/cli/`
- [ ] Falls back to `PROJECT_DEFAULTS[language].layers` when no ADR or module doc config found
- [ ] Logs which layer source was used (ADR keyword / module doc field / language default)
- [ ] Handles missing ADRs gracefully with fallback to defaults

### Implementation Notes
- File: `src/lib/project-generator.ts` (extend)
- Reference: `.pi/architecture/decisions/` for ADR files
- ADR content pattern: look for keywords in the ADR body text
- The result is a `string[]` of layer paths (e.g., `["domain", "application", "infrastructure", "interfaces/http", "interfaces/messaging"]`)
- These are passed to the structure generator which creates `src/.../{module}/{layer}/` directories

### Dependencies
- Depends on: Issue #004 (core project-generator)
- This is the key architectural decision for the epic — drives all directory generation

### Estimated Scope
- Files: 1 (`src/lib/project-generator.ts`)
- Lines: ~80-100
- Scope: Moderate

### Testing Requirements
- Unit test: ADR mentioning "REST" + "GraphQL" produces `interfaces/http` and `interfaces/graphql`
- Unit test: ADR mentioning "messaging" + "CLI" produces `interfaces/messaging` and `interfaces/cli`
- Unit test: explicit layers from module doc override ADR keyword detection
- Unit test: fallback to PROJECT_DEFAULTS when no ADRs or module doc config
- Unit test: ADR mentioning only "REST" does NOT produce `interfaces/graphql`
