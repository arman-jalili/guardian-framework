# Issue: Create TypeScript project skeleton templates

## Epic: EPIC-001 — Project Templates & Options

## Type: Feature

## Priority: Medium

### Description
Create `templates/project/typescript/` with a minimal TypeScript/Bun project skeleton including `package.json`, `tsconfig.json`, `Dockerfile`, `.gitignore`, `README.md`, and `.gitkeep` placeholders.

The interface layer is decomposed into sub-layers matching TypeScript delivery mechanisms:
- `interfaces/http/` — REST API routes, middleware, controllers
- `interfaces/graphql/` — GraphQL resolvers, schema types

### Acceptance Criteria
- [ ] `templates/project/typescript/` directory created
- [ ] `package.json` template with `{{PROJECTNAME}}`, `{{VERSION}}` placeholders
- [ ] `tsconfig.json` template with strict mode enabled
- [ ] `Dockerfile` template
- [ ] `.gitignore` with Node/Bun patterns
- [ ] `README.md` template
- [ ] Template references `interfaces/http/` and `interfaces/graphql/` as default sub-layers

### Implementation Notes
- Directory: `templates/project/typescript/`
- Use Bun as default runtime
- `package.json` should include Hono/Elysia for HTTP, graphql-yoga or similar for GraphQL

### Dependencies
- Depends on: Issue #001 (ProjectCreateOptions interface)

### Estimated Scope
- Files: 6+ (new skeleton files)
- Lines: ~100-150
- Scope: Simple

### Testing Requirements
- Integration test: templates render without errors
