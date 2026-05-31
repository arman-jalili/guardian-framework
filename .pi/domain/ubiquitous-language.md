# Ubiquitous Language

> Canonical glossary for Guardian Framework.
> All code MUST use these terms. Aliases/synonyms listed below are **prohibited** in source identifiers.
> Drift is detected by `.pi/scripts/validate-ubiquitous-language.sh`.

## Canonical Reference

- **Module:** `.pi/architecture/modules/core-libraries.md`
- **ADR-006:** Token Optimization Strategy — concise, consistent naming reduces token consumption
- **Last Sync:** 2026-05-31

---

## Glossary

| Term | Definition | Bounded Context | Aliases/Synonyms | Examples |
|------|-----------|----------------|-----------------|---------|
| Result | `Result<T, E>` discriminated union type for fallible operations | Core Libraries | Outcome, Response, TryResult | `Result<T, Error>`, `{ ok: true; value: T }` |
| LogEntry | Structured log line interface | Core Libraries | LogRecord, LogLine, LogItem | `LogEntry { timestamp, level, message, context }` |
| LogLevel | Log severity enum: "debug", "info", "warn", "error" | Core Libraries | LogSeverity, LogPriority | `"debug"`, `"info"`, `"warn"`, `"error"` |
| Manifest | State tracking document with version + hash | Core Libraries | StateFile, Registry, Snapshot | `Manifest { version, files[], hash }` |
| Template | File-based template with placeholder substitution | Core Libraries | Blueprint, Stencil | `Template { path, content, placeholders }` |
| Canonical | Architecture source-of-truth reference | Architecture | Canonic, OfficialRef, SourceTruth | `Canonical Reference: .pi/architecture/modules/...` |
| Validator | Pluggable validation script or TOML filter | Validation | Checker, Linter, Inspector | `validate-canonical.sh`, `validate-architecture.sh` |
| Pipeline | Sequential step-based execution pipeline with start/advance/fail | Orchestration | Flow, Chain, Sequence | `Pipeline { name, items[], steps[] }` |
| Workflow | Named set of prompt templates for a development workflow (e.g., feature-development) | Init / Prompts | WorkflowDefinition, PromptGroup, TaskFlow | `--workflows feature-development,bug-fix` |
| Module | Architecture module document (`.md`) | Architecture | Component, Package, Library, Subsystem | `core-libraries.md`, `cli-entry-point.md` |
| ADR | Architecture Decision Record | Architecture | Decision, DesignDoc, RFC | `ADR-006-token-optimization-strategy.md` |
| Export | Generated tool-specific output from `.pi/` sources | Export | Artifact, Output, Dist, GeneratedFile | `claude.md`, `opencode.json`, `AGENTS.md` |
| Scaffold | Generate initial `.pi/` directory structure | Init | Bootstrap, Initialize, Create, Setup | `guardian init` |
| Merge | Smart three-way merge preserving user edits | Update | Reconcile, Combine, Integrate, Sync | `guardian update` |
| TemplatePlaceholder | `{{placeholder}}` substitution token | Templates | Variable, Interpolation, Binding, Slot | `{{project_name}}`, `{{module_name}}` |
| Hash | SHA-256 content fingerprint | Trust | Checksum, Digest, Fingerprint, Signature | `SHA256 of file content` |
| Drift | Deviation from canonical source of truth | Canonical | Divergence, Skew, Delta, Mismatch | Code that differs from `.pi/architecture/` |
| RetryQueue | Persistent retry state with backoff | Core Libraries | RetryStore, JobQueue, BackoffQueue, RetryPool | `RetryQueue { task, attempts, backoff }` |

---

## Adding New Terms

1. Identify the term used in conversation and code
2. Add a row to the Glossary table
3. Define the term's **bounded context** (which module it lives in)
4. List any **aliases/synonyms** that agents might mistakenly use
5. Provide **code examples** showing correct usage
6. Run `.pi/scripts/validate-ubiquitous-language.sh` to detect drift

> **Rule of thumb:** If two agents use different names for the same concept, add an entry.
> The canonical term is the one used in the architecture module documents.
