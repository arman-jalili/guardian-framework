---
name: subagent-registry
description: Delegates isolated read-only investigations to scoped subagents with restricted tool access.
model: inherit
tools: [Read, Grep, Glob, Bash]
---

# Subagent Registry

Spawn subagents for self-contained investigations without polluting your context. Each subagent has a **restricted tool whitelist** and a **fresh message history**.

## Subagent Types

### explore
- **Tools:** read_file, list_directory, grep, glob (read-only)
- **Purpose:** Locate files, trace references, summarize architecture
- **Max steps:** 12
- **Returns:** Concise summary with file paths, key findings, line numbers

### code-review
- **Tools:** read_file, list_directory, grep, glob (read-only)
- **Purpose:** Review code for correctness, architecture, performance
- **Max steps:** 12
- **Returns:** ACTIONABLE findings formatted as "[MUST/SHOULD/NIT] file:line — issue → fix"

### security-review
- **Tools:** read_file, list_directory, grep, glob (read-only)
- **Purpose:** Audit for injection, auth bypass, secret leakage, unsafe deserialization
- **Max steps:** 12
- **Returns:** Concrete findings with file:line and severity

### general-research
- **Tools:** read_file, list_directory, grep, glob (read-only)
- **Purpose:** General-purpose multi-step research across many files
- **Max steps:** 12
- **Returns:** Tight summary with evidence (paths, line numbers)

## Delegation Rules

1. **Use subagents for:** Large codebase exploration, multi-file code review, security audits, research spanning ≥3 files
2. **Do NOT use subagents for:** Single-file edits, trivial lookups, commands you can run yourself
3. **Include all context:** Subagents have NO memory of your conversation — include file paths, relevant context, and the exact question in the prompt
4. **Pick the right type:** Match subagent type to the job — don't use general-research when explore suffices

## Anti-Recursion

Subagents CANNOT spawn subagents. If a subagent needs to delegate, it returns its findings and the parent agent decides whether to spawn another.

## Tool Scoping

Subagents are scoped to **read-only tools only**. They cannot:
- Write files
- Run shell commands
- Create directories
- Spawn other subagents

## When to Delegate

| Situation | Action |
|-----------|--------|
| "Where is X defined?" in a large codebase | → explore subagent |
| "Review this PR's changes" | → code-review subagent |
| "Check for security issues in auth module" | → security-review subagent |
| "How does data flow from A to B?" | → general-research subagent |
| "Read this one file" | → Do it yourself |
| "Run the tests" | → Do it yourself |
