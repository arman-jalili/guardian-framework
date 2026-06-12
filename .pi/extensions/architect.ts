/**
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
 * Architect Extension — Full Architecture-to-Implementation Pipeline
 *
 * OVERVIEW
 * ========
 * /architect is the planning engine that reads architecture module docs from
 * .pi/architecture/modules/ and produces epics + issues for implementation.
 * It is the bridge between domain exploration (/domain --explore) and
 * implementation (/implement-series).
 *
 * PREREQUISITES
 * ============
 * - .pi/architecture/modules/*.md must exist (from /domain --architect-scaffold
 *   or manually created)
 * - Git repository initialized (handled automatically if missing)
 * - gh or glab CLI authenticated for remote issue creation (optional)
 *
 * COMMANDS
 * =======
 * /architect --epic "Name" [--tracking-issue N]
 *   Starts a new epic: discovers architecture modules, finds the next
 *   planned slice, generates issues, creates pipeline state, and sends
 *   implementation instructions to the agent via pi.sendMessage() with
 *   triggerTurn=true.
 *
 * /architect status
 *   Shows current epic state: module, component, pipeline progress,
 *   issues, and validators.
 *
 * /architect next-epic
 *   Shows which module and components should be implemented next,
 *   based on component status (planned vs implemented).
 *
 * /architect abort
 *   Cancels the current epic, cleans pipeline state.
 *
 * TOOLS (agent-callable)
 * =====================
 * architect_status   — Returns current epic state and progress.
 * architect_discover — Discovers modules and finds next logical slice.
 *
 * WORKFLOW
 * =======
 * 1. /domain --explore "intent"          (discovery)
 * 2. /domain --architect-scaffold <id>   (generates modules)
 * 3. /architect --epic "Name"            (planning + issue gen)
 * 4. Agent implements issues via pipeline
 */



// ── Types ──

	cwd: string;
	ui: {
		notify(message: string, level?: string): void;
		setStatus(key: string, message: string | null): void;
		confirm(title: string, message: string): Promise<boolean>;
	};
	tools: { execute(name: string, params: Record<string, unknown>): Promise<unknown> };
};

	on(event: string, handler: (event: unknown, ctx: ExtensionContext) => void | Promise<void>): void;
	registerTool(options: {
		name: string;
		label: string;
		description: string;
		parameters: unknown;
		execute(
			toolCallId: string,
			params: Record<string, unknown>,
			signal: AbortSignal,
			onUpdate: (update: { type: string; message: string }) => void,
			ctx: ExtensionContext,
		): unknown | Promise<unknown>;
	}): void;
	registerCommand(
		name: string,
		options: {
			description: string;
			handler(args: string, ctx: ExtensionContext): unknown | Promise<unknown>;
		},
	): void;
	sendMessage<T = unknown>(
		message: { customType?: string; content: string; display?: boolean; details?: Record<string, unknown> },
		options?: { deliverAs?: "steer" | "followUp" | "nextTurn"; triggerTurn?: boolean },
	): void;
	sendUserMessage(
		content: string,
		options?: { deliverAs?: "steer" | "followUp" },
	): void;
};

	name: string;
	status: "planned" | "in-progress" | "implemented" | "deprecated";
	description: string;
	dependencies: string[];
};

	module: string;
	components: ModuleComponent[];
	nextLogicalSlice: ModuleComponent[];
};

	name: string;
	trackingIssueId: string | null;
	epicId: string | null;
	status: "planning" | "validating" | "publishing" | "executing" | "done" | "aborted";
	slices: ArchitectureSlice[];
	issues: { id: string; title: string; status: string; remoteIssueId?: string | null }[];
	currentIssueIndex: number;
	createdAt: string;
};



// ── Constants ──


// ── Helpers ──

	ctx.ui.notify(message, level);
}

	try {
		const stdout = execSync(`bash -c "${script}"`, { cwd, timeout: 120_000, encoding: "utf-8" });
		return { exitCode: 0, stdout };
	} catch (e: unknown) {
		const err = e as { status?: number; stdout?: string; message?: string };
		return { exitCode: err.status ?? 1, stdout: err.stdout ?? err.message ?? "" };
	}
}

// Read repoTool from guardian-manifest.json (defaults to "gh")
	try {
		const manifestPath = join(cwd, "guardian-manifest.json");
		if (existsSync(manifestPath)) {
			const raw = readFileSync(manifestPath, "utf-8");
			const manifest = JSON.parse(raw) as { repoTool?: string };
			if (manifest.repoTool === "glab") return "glab";
		}
	} catch {
		// fall through to default
	}
	return "gh";
}

// Read the repository slug (owner/repo) from guardian-manifest.json
	try {
		const manifestPath = join(cwd, "guardian-manifest.json");
		if (existsSync(manifestPath)) {
			const raw = readFileSync(manifestPath, "utf-8");
			const manifest = JSON.parse(raw) as {
				repository?: string;
				templateContext?: { repository?: string };
			};
			if (manifest.repository) return manifest.repository;
			if (manifest.templateContext?.repository)
				return manifest.templateContext.repository;
		}
	} catch {
		// ignore
	}
	return null;
}

	try {
		execSync(`command -v ${cmd}`, { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

// Try to create a remote GitHub/GitLab issue via the shell script wrapper.
// Uses execFileSync to avoid shell quoting issues with nested commands.
	cwd: string,
	title: string,
	bodyFilePath: string,
	labels: string,
	repository?: string,
): { success: boolean; issueNumber: string | null; error?: string } {
	const createScript = join(cwd, ".pi/scripts/git/create-tracking-issue.sh");
	if (!existsSync(createScript)) {
		return { success: false, issueNumber: null, error: "create-tracking-issue.sh not found" };
	}

	const args: string[] = [
		createScript,
		"--title",
		title,
		"--body-file",
		bodyFilePath,
		"--labels",
		labels,
	];
	if (repository) args.push("--repo", repository);

	let stdout = "";
	let exitCode = 0;
	try {
		stdout = execFileSync("bash", args, {
			cwd,
			timeout: 120_000,
			encoding: "utf-8",
		});
	} catch (e: unknown) {
		const err = e as { status?: number; stdout?: string; message?: string };
		exitCode = err.status ?? 1;
		stdout = err.stdout ?? err.message ?? "";
	}

	if (exitCode !== 0) {
		return { success: false, issueNumber: null, error: stdout };
	}

	const numberMatch = stdout.match(/TRACKING_ID=(\d+)/);
	if (numberMatch) {
		return { success: true, issueNumber: numberMatch[1] };
	}
	const urlMatch = stdout.match(/#(\d+)/);
	if (urlMatch) {
		return { success: true, issueNumber: urlMatch[1] };
	}
	return { success: false, issueNumber: null, error: "Could not parse issue number" };
}

// Ensure the GitHub/GitLab repository exists and local git remote is configured.
// Returns the repository slug if remote is ready, empty string if not available.
	cwd: string,
	repository: string,
	epicName: string,
	repoTool: string,
): string {
	// Check if remote already exists via git remote
	const remoteCheck = runScript(cwd, "git remote get-url origin 2>/dev/null");
	if (remoteCheck.exitCode === 0) {
		return repository;
	}

	// Remote not configured locally — ensure the remote repo exists on GitHub/GitLab
	if (repoTool === "gh") {
		runScript(
			cwd,
			`gh repo create "${repository}" --private --description "Epic: ${epicName}" 2>&1`,
		);
		// Remove stale origin if it exists but points nowhere useful
		runScript(cwd, "git remote remove origin 2>/dev/null");
		const httpsUrl = `https://github.com/${repository}.git`;
		runScript(cwd, `git remote add origin "${httpsUrl}"`);
		return repository;
	}

	// GitLab path
	runScript(
		cwd,
		`glab repo create "${repository}" --private --description "Epic: ${epicName}" 2>&1`,
	);
	runScript(cwd, "git remote remove origin 2>/dev/null");
	const httpsUrl = `https://gitlab.com/${repository}.git`;
	runScript(cwd, `git remote add origin "${httpsUrl}"`);
	return repository;
}

// Link a remote issue to the epic tracking issue
	cwd: string,
	issueId: string,
	epicId: string,
): { success: boolean; error?: string } {
	const linkScript = join(cwd, ".pi/scripts/git/link-issue-to-epic.sh");
	if (!existsSync(linkScript)) {
		return { success: false, error: "link-issue-to-epic.sh not found" };
	}

	const safeIssue = issueId.replace(/[^a-zA-Z0-9 _\-.]/g, "");
	const safeEpic = epicId.replace(/[^a-zA-Z0-9 _\-.]/g, "");

	const cmd = `bash "${linkScript}" --issue-id "${safeIssue}" --epic-id "${safeEpic}"`;
	const result = runScript(cwd, cmd);
	if (result.exitCode !== 0) {
		return { success: false, error: result.stdout };
	}
	return { success: true };
}

// ── Architecture Discovery ──

	const dir = join(cwd, ARCH_MODULES_DIR);
	if (!existsSync(dir)) return [];
	try {
		return readdirSync(dir).filter((f) => f.endsWith(".md"));
	} catch {
		return [];
	}
}

	if (!existsSync(filePath)) return [];
	const content = readFileSync(filePath, "utf-8");
	const components: ModuleComponent[] = [];

	const lines = content.split("\n");
	let inComponentSection = false;
	let inDetailsSection = false;
	let currentName = "";
	let currentStatus = "";
	let currentDesc = "";
	let currentDeps: string[] = [];

	function saveCurrent() {
		if (currentName) {
			// Default to planned if no explicit status found
			const status = currentStatus || "planned";
			const desc = currentDesc || `${currentName} component`;
			components.push({
				name: currentName,
				status: status as ModuleComponent["status"],
				description: desc.trim(),
				dependencies: currentDeps.length > 0 ? currentDeps : ["none"],
			});
		}
	}

	for (const line of lines) {
		const trimmed = line.trim();

		// Enter component section (supports "## Components", "## Component Details", "## Component")
		if (trimmed.match(/^##\s+Components?/i) || trimmed.match(/^##\s+Component\s+Details/i)) {
			inComponentSection = true;
			continue;
		}

		// Leave component section on next top-level section
		if (inComponentSection && trimmed.match(/^##\s+/) && !trimmed.match(/^##\s+Components?/i)) {
			saveCurrent();
			currentName = "";
			currentStatus = "";
			currentDesc = "";
			currentDeps = [];
			inComponentSection = false;
			inDetailsSection = false;
			continue;
		}

		// Component heading (###) — start a new component entry
		if (inComponentSection && trimmed.match(/^###\s+/)) {
			// Skip non-component ### headings like "### Depends On" or "### Security"
			const name = trimmed.replace(/^###\s+/, "");
			if (name.match(/^(depends|security|testing|performance|error|change|data flow|responsibilities|overview|interfaces|inputs|outputs)/i)) {
				continue;
			}
			saveCurrent();
			currentName = name;
			currentStatus = "";
			currentDesc = "";
			currentDeps = [];
			continue;
		}

		if (!currentName) continue;

		if (trimmed.startsWith("status:")) {
			currentStatus = trimmed.replace("status:", "").trim().toLowerCase();
		} else if (trimmed.startsWith("depends:")) {
			const depsStr = trimmed.replace("depends:", "").trim();
			if (depsStr && depsStr !== "none" && depsStr !== "[TODO") {
				currentDeps = depsStr.split(",").map((d) => d.trim()).filter(Boolean);
			}
		} else if (trimmed.startsWith("**Purpose:**")) {
			currentDesc = trimmed.replace(/\*\*Purpose:\*\*\s*/, "").trim();
		} else if (!currentDesc && trimmed.length > 10 && !trimmed.startsWith("#") && !trimmed.startsWith("-") && !trimmed.startsWith("|") && !trimmed.startsWith(">") && !trimmed.startsWith("```")) {
			// Use first substantial sentence as description
			currentDesc = trimmed.slice(0, 200);
		}
	}

	saveCurrent();
	return components;
}

	for (const moduleFile of moduleFiles) {
		const components = parseModuleFile(join(cwd, ARCH_MODULES_DIR, moduleFile));
		const planned = components.filter((c) => c.status === "planned");
		if (planned.length > 0) {
			return {
				module: moduleFile.replace(".md", ""),
				components,
				nextLogicalSlice: planned,
			};
		}
	}
	return null;
}



// ── Issue Generation ──

	component: ModuleComponent,
	slice: ArchitectureSlice,
	issueIndex: number,
	totalIssues: number,
): string {
	const moduleId = slice.module.replace(/^module-/, "");
	const componentName = component.name.toLowerCase().replace(/\s+/g, "-");
	const issueId = `ISSUE-${moduleId.toUpperCase()}-${issueIndex + 1}`;

	return `---
guardian_issue:
  id: "${issueId}"
  epic: "TBD"
  component: "${component.name}"
  module: "${slice.module}"
  status: planned
  priority: high
  dependencies:
${component.dependencies.map((d) => `    - "${d}"`).join("\n")}

  in_scope:
    - Implement ${component.name} for the ${slice.module} module
    - Write unit tests for all public interfaces
    - Add integration tests with upstream/downstream components
    - Create API documentation

  out_of_scope:
    - Changes to upstream components (${component.dependencies.join(", ")})
    - UI/frontend changes
    - Deployment pipeline configuration

  affected_layers:
    domain:
      - New domain models for ${componentName}
    application:
      - New service/handler for ${componentName}
    infrastructure:
      - New database tables or external service connections
    api:
      - New endpoints or event handlers

  canonical_references:
    - module: ".pi/architecture/modules/${slice.module}.md#${componentName}"

  acceptance_criteria:
    - "CI pipeline passes (validate-ci.sh)"
    - "All unit tests pass with ≥ 90% coverage"
    - "Integration tests pass with upstream/downstream components"
    - "validate-security.sh passes"
    - "validate-architecture.sh passes"
    - "validate-canonical.sh passes"

  validators:
    - ci
    - tests
    - security
    - architecture
    - canonical

  implementation_notes: |
    ${component.description || "Implement this component according to the architecture module."}

  file_changes:
    - "create: src/${moduleId}/${componentName}/"
    - "create: tests/unit/${moduleId}/${componentName}/"
    - "create: tests/integration/${moduleId}/${componentName}/"
---

# ${issueId}: ${component.name}

## Intent

${component.description || `Implement ${component.name} for the ${slice.module} module.`}

## Architecture Context

- **Module:** ${slice.module}
- **Component:** ${component.name}
- **Status:** ${component.status}
- **Dependencies:** ${component.dependencies.length > 0 ? component.dependencies.join(", ") : "none"}

## Dependencies

\`\`\`
${component.dependencies.map((d) => `  └── ${d}`).join("\n") || "  └── (root component — no dependencies)"}
\`\`\`

## In Scope

- Implement ${component.name} for the ${slice.module} module
- Write unit tests for all public interfaces
- Add integration tests with upstream/downstream components
- Create API documentation

## Out of Scope

- Changes to upstream components
- UI/frontend changes
- Deployment pipeline configuration

## Affected Layers

### Domain
- New domain models for ${componentName}

### Application
- New service/handler for ${componentName}

### Infrastructure
- New database tables or external service connections

### API
- New endpoints or event handlers

## Canonical References

- **Module:** \`.pi/architecture/modules/${slice.module}.md#${componentName}\`

## Acceptance Criteria

| # | Criterion | Validator |
|---|-----------|-----------|
| 1 | CI pipeline passes | \`validate-ci.sh\` |
| 2 | All unit tests pass with ≥ 90% coverage | \`validate-tests.sh\` |
| 3 | Integration tests pass | \`validate-integration.sh\` |
| 4 | Security checks pass | \`validate-security.sh\` |
| 5 | Architecture compliance | \`validate-architecture.sh\` |
| 6 | Canonical references valid | \`validate-canonical.sh\` |

## Implementation

> **Agent:** This is your complete session context. All information you need is above.
> Start by reading the canonical reference files, then implement following the layer structure.

### Steps

1. Read canonical architecture references
2. Create domain entities and interfaces
3. Implement application service/handler
4. Add infrastructure connections
5. Write unit tests (≥ 90% coverage)
6. Write integration tests
7. Run all validators
8. Create MR
`;
// ── Contract Freeze Generator ──

	slice: ArchitectureSlice,
	epicName: string,
): string {
	const moduleId = slice.module.replace(/^module-/, "");

	return `---
guardian_issue:
  id: "ISSUE-CONTRACT-FREEZE"
  epic: "${epicName}"
  component: "Contract Freeze"
  module: "${slice.module}"
  status: planned
  priority: critical
  dependencies: []

  in_scope:
    - Define public interfaces for all components in this epic
    - Define DTOs, schemas, and API contracts
    - Document event payloads and topics
    - Create interface stubs with no implementation
    - Freeze: no implementation changes without contract change

  out_of_scope:
    - Any implementation logic
    - Database schema changes
    - Infrastructure setup

  affected_layers:
    domain:
      - Interface definitions for domain services
    application:
      - Input/output DTO definitions
    api:
      - REST/event contracts

  canonical_references:
    - module: ".pi/architecture/modules/${slice.module}.md"

  acceptance_criteria:
    - "All component interfaces defined as interfaces/types"
    - "DTO schemas documented"
    - "API contracts frozen and reviewed"
    - "Implementation PRs reference these contracts"

  validators:
    - architecture
    - canonical

  implementation_notes: |
    Define the contract before any implementation. Every implementation issue
    depends on this contract being frozen first. The contract should include:
    interfaces, types, DTOs, event schemas, API paths, error formats.

  file_changes:
    - "create: src/${moduleId}/contracts/"
    - "create: src/${moduleId}/contracts/dtos/"
    - "create: src/${moduleId}/contracts/events/"
---

# Contract Freeze: ${slice.module}

## Intent

Define and freeze all public interfaces, contracts, and schemas for the ${slice.module}
epic before any implementation begins. This prevents architecture drift — implementation
must satisfy contracts, not the other way around.

## Included Components

${slice.nextLogicalSlice.map((c: { name: string }) => `- ${c.name}`).join("\n")}

## What Must Be Frozen

### Interfaces
- Service interfaces for every component
- Repository/DAO interfaces
- Factory interfaces

### Contracts
- Input/output DTO schemas
- API endpoint contracts (method, path, request/response)
- Event payload schemas
- Error response formats

### Out of Bounds (no contracts needed)
- Internal implementation details
- Database column names (hidden behind repository)
- Framework-specific annotations

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | All component interfaces defined | Check src/${moduleId}/contracts/ |
| 2 | Contracts reviewed and frozen | PR approval |
| 3 | DTO schemas documented | OpenAPI / TypeSpec / equivalent |
| 4 | Implementation depends on contracts | No implementation without interface |

## Implementation

> **Agent:** Create interface-only files. No implementation. Focus on:
> 1. Reading the architecture module to understand each component's role
> 2. Defining clean TypeScript/Java/Python interfaces
> 3. DTOs with proper validation decorators
> 4. Event schemas with required fields
>
> The goal is a reviewed, frozen contract that implementation issues can depend on.
`;
}

// ── Proofing Issue Generator ──

	slice: ArchitectureSlice,
	epicName: string,
): string {
	const moduleId = slice.module.replace(/^module-/, "");

	return `---
guardian_issue:
  id: "ISSUE-PROOFING"
  epic: "${epicName}"
  component: "Proofing & CI Enforcement"
  module: "${slice.module}"
  status: planned
  priority: critical
  dependencies: []

  in_scope:
    - Create deterministic validation scripts for each contract
    - Verify all interfaces have matching implementations
    - Check test coverage meets thresholds
    - Integrate proofing scripts into .pi/scripts/ci/
    - Scripts must be self-contained shell scripts (zero token cost)

  out_of_scope:
    - Implementation changes
    - New features
    - Production deployment

  affected_layers:
    ci:
      - New proofing scripts in .pi/scripts/ci/
      - Updated CI stage configuration

  canonical_references:
    - module: ".pi/architecture/modules/${slice.module}.md"

  acceptance_criteria:
    - "All proofing scripts created and executable"
    - "Each contract has at least one validation check"
    - "Scripts pass on current implementation"
    - "Scripts fail if implementation is removed"
    - "Scripts integrated into CI pipeline (stage in run_hardening_stages.sh)"

  validators:
    - ci
    - tests
    - canonical

  implementation_notes: |
    Create deterministic shell scripts that validate: each defined interface has an
    implementation, each implementation has tests, test coverage meets threshold,
    contracts are not violated. These escape the LLM ad-hoc check trap — they run
    every build for zero token cost.

  file_changes:
    - "create: .pi/scripts/ci/check_${moduleId}_contracts.sh"
    - "create: .pi/scripts/ci/check_${moduleId}_coverage.sh"
    - "modify: .pi/scripts/ci/run_hardening_stages.sh"
---

# Proofing & CI Enforcement: ${slice.module}

## Intent

Create deterministic, automated validation scripts that prove every contract from the
freeze phase is correctly implemented and tested. These scripts make compliance
automatic — no human review needed for routine checks.

## What Each Script Does

### Contract Implementation Check
- Reads each interface from the contract freeze
- Verifies a concrete implementation class exists
- Verifies all interface methods are implemented
- Reports violations with file:line references

### Coverage Threshold Check
- Runs the project's coverage tool
- Asserts each module meets minimum coverage (default 80%)
- Fails the build if coverage drops

### CI Integration
Each check becomes a CI stage in the hardening pipeline — it runs automatically
on every PR. No LLM cost. No human review. Just pass or fail.

## Scripts To Create

| Script | Purpose | Location |
|--------|---------|----------|
| check_${moduleId}_contracts.sh | Validate contract implementation | .pi/scripts/ci/ |
| check_${moduleId}_coverage.sh | Enforce coverage thresholds | .pi/scripts/ci/ |
| stage_${moduleId}_proofing.sh | CI stage wrapper | .pi/scripts/ci/ |

## CI Pipeline Update

Add the new stage to \`run_hardening_stages.sh\`:

\`\`\`bash
run_stage "11" "${moduleId}_proofing" \\
    "\${SCRIPTS_DIR}/stage_${moduleId}_proofing.sh" \\
    "always"
\`\`\`

## Acceptance Criteria

| # | Criterion | Script |
|---|-----------|--------|
| 1 | All interfaces have implementations | check_contracts.sh |
| 2 | Coverage ≥ 80% per module | check_coverage.sh |
| 3 | CI runs checks on every PR | run_hardening_stages.sh |
| 4 | All scripts exit 0 on pass, 1 on fail | self-validating |

## Implementation

> **Agent:** Create shell scripts. Keep them simple — grep, find, awk.
> No frameworks, no dependencies. Each script should be:
> 1. Runnable standalone (bash script.sh)
> 2. Runnable as a CI stage
> 3. Self-documenting with --help
> 4. Exit 0 for pass, 1 for fail
>
> End by running the full CI pipeline to verify integration:
> \`bash .pi/scripts/ci/run_hardening_stages.sh\`
`;
}

// ── Architecture Readiness Generator (expanded) ──

	slice: ArchitectureSlice,
	epicName: string,
): string {
	const moduleId = slice.module.replace(/^module-/, "");

	return `---
guardian_issue:
  id: "ISSUE-READINESS"
  epic: "${epicName}"
  component: "Architecture Readiness"
  module: "${slice.module}"
  status: planned
  priority: critical
  dependencies: []

  in_scope:
    - Create runbook (startup, shutdown, recovery procedures)
    - Create DR plan (backup, restore, failover)
    - Add observability (metrics, tracing, structured logging)
    - Add health check endpoints
    - Update architecture documentation
    - Sync canonical references
    - Verify CI enforces all the above

  out_of_scope:
    - New feature work
    - Implementation changes

  affected_layers:
    domain:
      - Architecture documentation updates
    application:
      - Observability hooks
    infrastructure:
      - Health checks, monitoring config
    ci:
      - Verify proofing scripts + validators in CI

  canonical_references:
    - module: ".pi/architecture/modules/${slice.module}.md"

  acceptance_criteria:
    - "Runbook created and reviewed"
    - "DR plan documented"
    - "Observability patterns in place (tracing, metrics, logging)"
    - "Health check endpoint responds"
    - "Architecture docs synced with implementation"
    - "Canonical references verified (validate-canonical.sh passes)"
    - "Proofing scripts integrated in CI and passing"
    - "All validators pass: ci, tests, security, architecture, canonical, operations"

  validators:
    - ci
    - tests
    - security
    - architecture
    - canonical
    - operations

  implementation_notes: |
    The final issue in every epic. Production readiness means: the team can operate it
    (runbook), recover from failure (DR plan), observe it (metrics/tracing/logging),
    and CI will catch regressions (proofing scripts + validators).

  file_changes:
    - "create: docs/runbook-${moduleId}.md"
    - "create: docs/dr-plan-${moduleId}.md"
    - "modify: .pi/architecture/CHANGELOG.md"
    - "modify: .pi/architecture/modules/${slice.module}.md"
---

# Architecture Readiness: ${slice.module}

## Intent

Make the ${slice.module} module production-ready. This is the final issue in every epic
— it closes the loop between implementation and operability.

## Deliverables

### Runbook
\`docs/runbook-${moduleId}.md\` covering:
- Startup sequence and dependencies
- Graceful shutdown procedure
- Common failure modes and recovery
- Configuration reference

### DR Plan
\`docs/dr-plan-${moduleId}.md\` covering:
- Backup strategy and schedule
- Restore procedure
- Failover plan
- RTO/RPO targets

### Observability
- Metrics: key business and technical metrics exposed
- Tracing: distributed tracing context propagated
- Logging: structured logging with correlation IDs
- Health: /health endpoint with dependency checks

### CI Enforcement
Verify that:
- Proofing scripts from the proofing issue are in CI
- All validators (ci, tests, security, architecture, canonical, operations) pass
- A CI pipeline run against this state succeeds

## Acceptance Criteria

| # | Criterion | Validator |
|---|-----------|-----------|
| 1 | Runbook exists | manual review |
| 2 | DR plan exists | manual review |
| 3 | Observability patterns present | validate-operations.sh |
| 4 | Canonical references synced | validate-canonical.sh |
| 5 | CI enforce validators | validate-ci.sh |
| 6 | All proofing scripts pass | run_hardening_stages.sh |
| 7 | Architecture docs updated | validate-architecture.sh |

## Implementation

> **Agent:** Close out the epic properly:
> 1. Write runbook and DR plan docs
> 2. Add observability instrumentation
> 3. Update architecture module docs with final implementation details
> 4. Sync CHANGE LOG
> 5. Verify proofing scripts from the proofing issue pass
> 6. Run full validation suite
> 7. Architecture readiness validator: bash .pi/scripts/validate-architecture-readiness.sh
> 8. Create final MR
`;
}
}



/**
 * Architect Extension — Full Architecture-to-Implementation Pipeline
 *
 * Entry point. Imports from submodules and registers the extension.
 * Split into: architect-lib/types.ts, architect-lib/helpers.ts, architect-lib/generators.ts
 */


// Import helpers and generators (they register themselves in the module scope)


// ── Epic State Persistence ──


const EPIC_STATE_KEY = ".pi/.guardian-epic-state.json";

function loadEpicState(cwd: string): EpicState | null {
	const p = join(cwd, EPIC_STATE_KEY);
	try {
		if (!existsSync(p)) return null;
		const raw = readFileSync(p, "utf-8");
		return JSON.parse(raw) as EpicState;
	} catch {
		return null;
	}
}

function saveEpicState(cwd: string, state: EpicState): void {
	const p = join(cwd, EPIC_STATE_KEY);
	mkdirSync(EPIC_STATE_KEY.split("/").slice(0, -1).join("/"), { recursive: true });
	writeFileSync(p, JSON.stringify(state, null, 2), "utf-8");
}

function formatEpicStatus(state: EpicState | null): string {
	if (!state) return "No active epic";
	const slice = state.slices?.[0];
	if (!slice) return `Epic "${state.name}" — no slices`;
	const components = slice.nextLogicalSlice || [];
	const done = components.filter((c: ModuleComponent) => c.status === "implemented").length;
	const total = components.length;
	return [
		`Epic: ${state.name}`,
		`Module: ${slice.module}`,
		`Progress: ${done}/${total} components`,
		`Issues: ${(state.issues || []).length}`,
		`Pipeline: ${state.status}`,
	].join("\n");
}

// ── Epic Manager ──

class EpicManager {
	private state: EpicState | null;

	constructor(private cwd: string) {
		this.state = loadEpicState(cwd);
	}

	getState(): EpicState | null {
		return this.state;
	}

	async startEpic(
		ctx: ExtensionContext,
		name: string,
		trackingIssueId?: string,
	): Promise<EpicState> {

		const moduleFiles = discoverModules(this.cwd);
		if (moduleFiles.length === 0) {
			throw new Error("No architecture modules found in .pi/architecture/modules/.");
		}

		const slice = findNextLogicalSlice(this.cwd, moduleFiles);
		if (!slice) {
			throw new Error("All architecture components are implemented. No next slice found.");
		}

		ctx.ui.setStatus("architect", `Planning epic: ${name}`);

		const repoTool = readRepoTool(this.cwd);
		const repository = readRepository(this.cwd);
		const targetRepo = repository || slice.module;
		let hasRemote = false;
		let remoteRepo = "";

		if (repoTool === "glab" ? commandExists("glab") : commandExists("gh")) {
			const authCheck = runScript(
				this.cwd,
				repoTool === "glab" ? "glab auth status 2>/dev/null" : "gh auth status 2>/dev/null",
			);
			if (authCheck.exitCode === 0) {
				remoteRepo = ensureRemoteRepo(this.cwd, targetRepo, name, repoTool);
				hasRemote = remoteRepo.length > 0;
			}
		}

		const issues: { id: string; title: string; status: string; remoteIssueId?: string | null }[] = [];
		const issuesDir = join(this.cwd, ".pi/issues");
		if (!existsSync(issuesDir)) mkdirSync(issuesDir, { recursive: true });

		const freezeId = "issue-contract-freeze";
		const freezeEntry = {
			id: freezeId,
			title: "Contract Freeze: Define interfaces and contracts",
			status: "planned",
			remoteIssueId: null as string | null,
		};
		const freezeMarkdown = generateContractFreezeMarkdown(slice, name);
		writeFileSync(join(issuesDir, `${freezeId}.md`), freezeMarkdown);
		if (hasRemote && remoteRepo) {
			const result = createRemoteIssue(this.cwd, freezeEntry.title, join(issuesDir, `${freezeId}.md`), "epic,contract", remoteRepo);
			if (result.success && result.issueNumber) {
				freezeEntry.remoteIssueId = result.issueNumber;
				if (trackingIssueId) linkRemoteIssue(this.cwd, result.issueNumber, trackingIssueId);
			}
		}
		issues.push(freezeEntry);

		for (const comp of slice.nextLogicalSlice) {
			const id = `issue-${comp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
			const entry = {
				id,
				title: `${comp.name}: ${comp.description.slice(0, 80)}`,
				status: "planned" as string,
				remoteIssueId: null as string | null,
			};
			const md = generateIssueMarkdown(comp, slice.module, name);
			writeFileSync(join(issuesDir, `${id}.md`), md);
			if (hasRemote && remoteRepo) {
				const result = createRemoteIssue(this.cwd, entry.title, join(issuesDir, `${id}.md`), "epic,implementation", remoteRepo);
				if (result.success && result.issueNumber) {
					entry.remoteIssueId = result.issueNumber;
					if (trackingIssueId) linkRemoteIssue(this.cwd, result.issueNumber, trackingIssueId);
				}
			}
			issues.push(entry);
		}

		const proofingId = "issue-proofing";
		const proofingEntry = {
			id: proofingId,
			title: "Proofing: Validation scripts + CI integration",
			status: "planned" as string,
			remoteIssueId: null as string | null,
		};
		const proofingMd = generateProofingMarkdown(slice, name);
		writeFileSync(join(issuesDir, `${proofingId}.md`), proofingMd);
		if (hasRemote && remoteRepo) {
			const result = createRemoteIssue(this.cwd, proofingEntry.title, join(issuesDir, `${proofingId}.md`), "epic,proofing", remoteRepo);
			if (result.success && result.issueNumber) {
				proofingEntry.remoteIssueId = result.issueNumber;
				if (trackingIssueId) linkRemoteIssue(this.cwd, result.issueNumber, trackingIssueId);
			}
		}
		issues.push(proofingEntry);

		const readinessId = "issue-architecture-readiness";
		const readinessEntry = {
			id: readinessId,
			title: "Architecture Readiness: Runbook, DR, docs, CI enforcement",
			status: "planned" as string,
			remoteIssueId: null as string | null,
		};
		const readinessMd = generateArchitectureReadinessMarkdown(slice, name);
		writeFileSync(join(issuesDir, `${readinessId}.md`), readinessMd);
		if (hasRemote && remoteRepo) {
			const result = createRemoteIssue(this.cwd, readinessEntry.title, join(issuesDir, `${readinessId}.md`), "epic,architecture-readiness", remoteRepo);
			if (result.success && result.issueNumber) {
				readinessEntry.remoteIssueId = result.issueNumber;
				if (trackingIssueId) linkRemoteIssue(this.cwd, result.issueNumber, trackingIssueId);
			}
		}
		issues.push(readinessEntry);

		const state: EpicState = {
			name,
			trackingIssueId: trackingIssueId || null,
			epicId: null,
			slices: [slice],
			issues,
			status: "planning",
			createdAt: new Date().toISOString(),
		};

		this.state = state;
		saveEpicState(this.cwd, state);
		return state;
	}

	async abortEpic(): Promise<void> {
		this.state = null;
		try {
			const p = join(this.cwd, ".pi/.guardian-epic-state.json");
			if (existsSync(p)) unlinkSync(p);
		} catch { /* ignore */ }
	}
}

// ── Extension ──

export default function (pi: ExtensionAPI) {
	let manager: EpicManager | null = null;

	function findFlag(tokens: string[], prefix: string): string | undefined {
		const eqMatch = tokens.find((a) => a.startsWith(`${prefix}=`));
		if (eqMatch) return eqMatch.split("=").slice(1).join("=");
		const idx = tokens.indexOf(prefix);
		if (idx >= 0 && idx + 1 < tokens.length && !tokens[idx + 1].startsWith("--")) return tokens[idx + 1];
		return undefined;
	}

	pi.registerCommand("architect", {
		description: "Orchestrate the full architecture-to-implementation process",
		handler: async (args, ctx) => {
			if (!manager) manager = new EpicManager(ctx.cwd);
			const raw = typeof args === "string" ? args : "";
			const tokens = raw ? raw.split(/\s+/).filter(Boolean) : [];
			if (tokens.length === 0) {
				ctx.ui.notify("Usage: /architect [--epic Name] [--tracking-issue N] | status | next-epic | abort", "info");
				return;
			}
			const action = tokens[0];

			if (action === "status" || action === "") {
				const state = manager.getState();
				ctx.ui.notify(formatEpicStatus(state), "info");
				return;
			}

			if (action === "abort") {
				await manager.abortEpic();
				ctx.ui.notify("Epic aborted", "error");
				return;
			}

			if (action === "next-epic") {
				const moduleFiles = discoverModules(ctx.cwd);
				const slice = findNextLogicalSlice(ctx.cwd, moduleFiles);
				if (!slice) {
					ctx.ui.notify("No more architecture slices to implement.", "info");
					return;
				}
				ctx.ui.notify(`Next epic: ${slice.module} (${slice.nextLogicalSlice.length} components planned)`, "info");
				return;
			}

			const epicName = findFlag(tokens, "--epic");
			const trackingIssueId = findFlag(tokens, "--tracking-issue");

			if (!epicName) {
				ctx.ui.notify('Usage: /architect --epic "Epic Name" [--tracking-issue N]', "error");
				return;
			}

			try {
				if (!epicName || epicName.trim() === "") {
					ctx.ui.notify('Usage: /architect --epic "Epic Name"', "error");
					return;
				}

				const state = await manager.startEpic(ctx, epicName, trackingIssueId);

				if (!state || !state.slices || state.slices.length === 0) {
					ctx.ui.notify("Failed to discover architecture components. Check .pi/architecture/modules/.", "error");
					return;
				}

				const slice = state.slices[0];
				const components = slice.nextLogicalSlice || [];

				if (components.length === 0) {
					ctx.ui.notify("No planned components found in architecture module.", "error");
					return;
				}

				const items = (state.issues || []).map((i) => i.id);
				if (items.length === 0) {
					ctx.ui.notify("Failed to generate issues.", "error");
					return;
				}

				let gitInitMessage = "";
				try {
					const gitCheck = runScript(ctx.cwd, "git rev-parse --git-dir 2>/dev/null");
					if (gitCheck.exitCode !== 0) {
						runScript(ctx.cwd, "git init");
						runScript(ctx.cwd, "git add .");
						runScript(ctx.cwd, 'git commit -m "Initial Guardian scaffold"');
					}
				} catch { /* ignore */ }

				const firstItem = items[0];
				const firstIssue = state.issues?.find((i) => i.id === firstItem);
				const firstDesc = components[0]?.description || "Implementation";
				const issueFilename = `${firstItem}.md`.replace(/\//g, "-");
				const issuePath = join(ctx.cwd, ".pi/issues", issueFilename);

				let issueContent = "";
				let issueSource = "";
				const remoteId = firstIssue?.remoteIssueId;
				const repository = readRepository(ctx.cwd) || "";
				if (remoteId && repository) {
					try {
						const ghOutput = runScript(ctx.cwd, `gh issue view ${remoteId} --repo ${repository} --json title,body`);
						if (ghOutput.exitCode === 0 && ghOutput.stdout) {
							const parsed = JSON.parse(ghOutput.stdout);
							issueContent = parsed.body || "";
						}
					} catch { /* ignore */ }
				}

				if (!issueContent) {
					try {
						if (existsSync(issuePath)) {
							issueContent = readFileSync(issuePath, "utf-8");
						}
					} catch { /* ignore */ }
				}

				issueSource = remoteId && repository
					? `Remote issue: https://github.com/${repository}/issues/${remoteId}`
					: `Local file: .pi/issues/${issueFilename}`;

				const instructions = [
					`Pipeline started`,
					"",
					`**Current task:** Item "${firstItem}" → Step: implement`,
					`**Description:** ${firstDesc.slice(0, 100)}...`,
					`**Issue:** ${issueSource}`,
					"",
					"**Instructions:**",
					"1. Review the issue context below",
					"2. Implement the component according to the issue spec",
					"3. Run validation checks",
					"4. Advance to next issue when done",
					"",
					"---",
					"",
					"## Issue Context",
					"",
					issueContent || "Issue content not available.",
				].join("\n");

				pi.sendMessage(
					{ content: instructions, display: true },
					{ deliverAs: "followUp", triggerTurn: true },
				);
				return;
			} catch (e) {
				ctx.ui.notify(`Architect error: ${e}`, "error");
			}
		},
	});

	pi.registerTool({
		name: "architect_status",
		label: "Architect Status",
		description: "Show the current epic status and progress.",
		parameters: { type: "object", properties: {} },
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			if (!manager) manager = new EpicManager(ctx.cwd);
			const state = manager.getState();
			return { content: [{ type: "text", text: formatEpicStatus(state) }] };
		},
	});

	pi.registerTool({
		name: "architect_discover",
		label: "Architect Discover",
		description: "Discover architecture modules and find the next logical slice.",
		parameters: { type: "object", properties: {} },
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const moduleFiles = discoverModules(ctx.cwd);
			if (moduleFiles.length === 0) {
				return { content: [{ type: "text", text: "No architecture modules found in .pi/architecture/modules/." }] };
			}
			const lines = ["## Architecture Modules\n"];
			for (const file of moduleFiles) {
				const components = parseModuleFile(join(ctx.cwd, ".pi/architecture/modules", file));
				const planned = components.filter((c) => c.status === "planned");
				lines.push(`### ${file.replace(".md", "")}`);
				lines.push(`  Components: ${components.length} (${planned.length} planned)`);
				if (planned.length > 0) {
					lines.push("  Next slice:");
					for (const c of planned) lines.push(`    - ${c.name}`);
				}
				lines.push("");
			}
			const slice = findNextLogicalSlice(ctx.cwd, moduleFiles);
			if (slice) {
				lines.push(`**Recommended next epic:** ${slice.module}`);
				lines.push(`Components: ${slice.nextLogicalSlice.map((c: ModuleComponent) => c.name).join(", ")}`);
			}
			return { content: [{ type: "text", text: lines.join("\n") }] };
		},
	});
}
