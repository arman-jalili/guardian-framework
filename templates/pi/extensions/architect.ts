/**
 * Architect Extension for pi
 *
 * THE ARCHITECTURE TOOL — entry point for architecture-first development.
 *
 * What it does:
 * 1. DISCOVER: Read .pi/architecture/modules/*.md, find next logical slice
 * 2. PLAN: Generate epic draft + issue stubs from slice
 * 3. VALIDATE: Run deterministic validators on epic draft
 *
 * What it delegates (agent-driven execution):
 * 4. GENERATE: Agent creates epic + issue markdown files from templates
 * 5. PUBLISH: Agent invokes .pi/scripts/git/*.sh to create issues/epics
 * 6. EXECUTE: Agent starts /pipeline for each issue
 * 7. ARCHITECTURE READINESS: Agent runs validate-architecture-readiness.sh
 * 8. CLOSE: Agent invokes .pi/scripts/git/close-epic.sh
 *
 * Commands:
 *   /architect --epic "Auth Module v2" --tracking-issue 100
 *   /architect status
 *   /architect next-epic
 *   /architect abort
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ── Types ──

type ExtensionContext = {
	cwd: string;
	ui: {
		notify(message: string, level?: string): void;
		setStatus(key: string, message: string | null): void;
		confirm(title: string, message: string): Promise<boolean>;
	};
	tools: { execute(name: string, params: Record<string, unknown>): Promise<unknown> };
};

type ExtensionAPI = {
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
};

type ModuleComponent = {
	name: string;
	status: "planned" | "in-progress" | "implemented" | "deprecated";
	description: string;
	dependencies: string[];
};

type ArchitectureSlice = {
	module: string;
	components: ModuleComponent[];
	nextLogicalSlice: ModuleComponent[];
};

type EpicState = {
	name: string;
	trackingIssueId: string | null;
	epicId: string | null;
	status: "planning" | "validating" | "publishing" | "executing" | "done" | "aborted";
	slices: ArchitectureSlice[];
	issues: { id: string; title: string; status: string }[];
	currentIssueIndex: number;
	createdAt: string;
};

// ── Constants ──

const EPIC_STATE_KEY = ".pi/.guardian-epic-state.json";
const ARCH_MODULES_DIR = ".pi/architecture/modules";
const ISSUES_DIR = ".pi/issues";

// ── Helpers ──

function log(ctx: ExtensionContext, message: string, level = "info") {
	ctx.ui.notify(message, level);
}

function runScript(cwd: string, script: string): { exitCode: number; stdout: string } {
	try {
		const stdout = execSync(`bash -c "${script}"`, { cwd, timeout: 120_000, encoding: "utf-8" });
		return { exitCode: 0, stdout };
	} catch (e: unknown) {
		const err = e as { status?: number; stdout?: string; message?: string };
		return { exitCode: err.status ?? 1, stdout: err.stdout ?? err.message ?? "" };
	}
}


// Read repoTool from guardian-manifest.json (defaults to "gh")
function readRepoTool(cwd: string): string {
	try {
		const manifestPath = join(cwd, 'guardian-manifest.json');
		if (existsSync(manifestPath)) {
			const raw = readFileSync(manifestPath, 'utf-8');
			const manifest = JSON.parse(raw) as { repoTool?: string };
			if (manifest.repoTool === 'glab') return 'glab';
		}
	} catch {
		// fall through to default
	}
	return 'gh';
}

// ── Architecture Discovery ──

function discoverModules(cwd: string): string[] {
	const dir = join(cwd, ARCH_MODULES_DIR);
	if (!existsSync(dir)) return [];
	try {
		return readdirSync(dir).filter((f) => f.endsWith(".md"));
	} catch {
		return [];
	}
}

function parseModuleFile(filePath: string): ModuleComponent[] {
	if (!existsSync(filePath)) return [];
	const content = readFileSync(filePath, "utf-8");
	const components: ModuleComponent[] = [];

	const lines = content.split("\n");
	let inComponentSection = false;
	let currentName = "";
	let currentStatus = "";
	let currentDesc = "";
	let currentDeps: string[] = [];

	function saveCurrent() {
		if (currentName && currentStatus) {
			components.push({
				name: currentName,
				status: currentStatus as ModuleComponent["status"],
				description: currentDesc.trim(),
				dependencies: currentDeps,
			});
		}
	}

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed.match(/^##\s+Component/i)) {
			inComponentSection = true;
			continue;
		}
		if (inComponentSection && trimmed.match(/^##\s+/)) {
			saveCurrent();
			currentName = "";
			currentStatus = "";
			currentDesc = "";
			currentDeps = [];
			inComponentSection = false;
			continue;
		}
		if (inComponentSection && trimmed.match(/^###\s+/)) {
			saveCurrent();
			currentName = trimmed.replace(/^###\s+/, "");
			currentStatus = "";
			currentDesc = "";
			currentDeps = [];
			continue;
		}

		if (!currentName) continue;

		if (trimmed.startsWith("status:")) {
			currentStatus = trimmed.replace("status:", "").trim().toLowerCase();
		} else if (trimmed.startsWith("depends:")) {
			currentDeps = trimmed
				.replace("depends:", "")
				.split(",")
				.map((d) => d.trim())
				.filter(Boolean);
		} else if (trimmed.startsWith("**Purpose:**")) {
			currentDesc = trimmed.replace(/\*\*Purpose:\*\*\s*/, "").trim();
		}
	}

	saveCurrent();
	return components;
}

function findNextLogicalSlice(cwd: string, moduleFiles: string[]): ArchitectureSlice | null {
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

function generateIssueMarkdown(
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
}

// ── Epic State Persistence ──

function loadEpicState(cwd: string): EpicState | null {
	const p = join(cwd, EPIC_STATE_KEY);
	if (!existsSync(p)) return null;
	try {
		return JSON.parse(readFileSync(p, "utf-8")) as EpicState;
	} catch {
		return null;
	}
}

function saveEpicState(cwd: string, state: EpicState): void {
	const p = join(cwd, EPIC_STATE_KEY);
	const dir = dirname(p);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(p, JSON.stringify(state, null, 2));
}

function formatEpicStatus(state: EpicState | null): string {
	if (!state) return 'No active epic. Start one with /architect --epic "Name"';
	const lines = [
		`## Epic: ${state.name}`,
		`**Status:** ${state.status}`,
		`**Tracking Issue:** ${state.trackingIssueId || "not created"}`,
		`**Created:** ${state.createdAt}`,
	];
	if (state.issues.length > 0) {
		lines.push(`\n### Issues (${state.issues.length} total)`);
		for (const issue of state.issues) {
			const emoji =
				issue.status === "done"
					? "✓"
					: issue.status === "failed"
						? "✗"
						: issue.status === "in-progress"
							? "▶"
							: "○";
			lines.push(`  ${emoji} ${issue.id}: ${issue.title}`);
		}
	}
	return lines.join("\n");
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
			throw new Error(
				"No architecture modules found in .pi/architecture/modules/. Create module docs first.",
			);
		}

		const slice = findNextLogicalSlice(this.cwd, moduleFiles);
		if (!slice) {
			throw new Error("All architecture components are implemented. No next slice found.");
		}

		ctx.ui.setStatus("architect", `Planning epic: ${name}`);

		// Generate issues and issue markdown files
		const issues = [];
		const issuesDir = join(this.cwd, ISSUES_DIR);
		if (!existsSync(issuesDir)) mkdirSync(issuesDir, { recursive: true });

		for (let i = 0; i < slice.nextLogicalSlice.length; i++) {
			const component = slice.nextLogicalSlice[i];
			const issueId = `issue-${component.name.toLowerCase().replace(/\s+/g, "-").replace(/\//g, "-")}`;
			issues.push({
				id: issueId,
				title: `Implement: ${component.name}`,
				status: "planned",
			});

			// Generate issue markdown file
			const issueMarkdown = generateIssueMarkdown(
				component,
				slice,
				i,
				slice.nextLogicalSlice.length,
			);
			const issueFilename = `${issueId}.md`.replace(/\//g, "-");
			const issueFilePath = join(issuesDir, issueFilename);
			writeFileSync(issueFilePath, issueMarkdown);
		}

		// Add architecture readiness issue
		const readinessId = "issue-architecture-readiness";
		issues.push({
			id: readinessId,
			title: "Architecture Readiness: Runbook, DR, Docs, Observability",
			status: "planned",
		});

		const readinessMarkdown = `---
guardian_issue:
  id: "ISSUE-READINESS"
  epic: "${name}"
  component: "Architecture Readiness"
  module: "${slice.module}"
  status: planned
  priority: critical
---

# Architecture Readiness

## Intent

Ensure the ${slice.module} module is production-ready with runbook, DR plan, documentation, and observability.

## Acceptance Criteria
- Runbook created (docs/runbook.md)
- DR plan created (docs/dr-plan.md)
- Architecture docs updated
- Canonical references synced
- Observability patterns in place
`;
		writeFileSync(join(issuesDir, `${readinessId}.md`.replace(/\//g, "-")), readinessMarkdown);

		this.state = {
			name,
			trackingIssueId: trackingIssueId || null,
			epicId: null,
			status: "planning",
			slices: [slice],
			issues,
			currentIssueIndex: 0,
			createdAt: new Date().toISOString(),
		};
		saveEpicState(this.cwd, this.state);
		return this.state;
	}

	async abortEpic(): Promise<void> {
		if (!this.state) return;
		this.state.status = "aborted";
		saveEpicState(this.cwd, this.state);
	}
}

// ── Extension ──

export default function (pi: ExtensionAPI) {
	let manager: EpicManager | null = null;

	// Helper: parse --flag=value or --flag value patterns (handles quoted strings)
	function findFlag(tokens: string[], prefix: string): string | undefined {
		// Try --flag=value first
		const eqMatch = tokens.find((a) => a.startsWith(`${prefix}=`));
		if (eqMatch)
			return eqMatch
				.split("=")
				.slice(1)
				.join("=")
				.replace(/^["']|["']$/g, "");
		// Try --flag "multi word value" — collect all tokens until next --flag
		const idx = tokens.indexOf(prefix);
		if (idx !== -1) {
			const parts: string[] = [];
			for (let i = idx + 1; i < tokens.length; i++) {
				if (tokens[i].startsWith("--")) break;
				parts.push(tokens[i].replace(/^["']|["']$/g, ""));
			}
			if (parts.length > 0) return parts.join(" ");
		}
		return undefined;
	}

	pi.on("session_start", async (_event, ctx) => {
		manager = new EpicManager(ctx.cwd);
		const state = manager.getState();
		if (state && state.status !== "done" && state.status !== "aborted") {
			ctx.ui.setStatus("architect", `Epic: ${state.name} (${state.status})`);
		}
	});

	// ── /architect command ──
	pi.registerCommand("architect", {
		description: "Orchestrate the full architecture-to-implementation process",
		handler: async (args, ctx) => {
			if (!manager) manager = new EpicManager(ctx.cwd);
			const raw = typeof args === "string" ? args : "";
			const tokens = raw ? raw.split(/\s+/).filter(Boolean) : [];
			if (tokens.length === 0) {
				ctx.ui.notify(
					"Usage: /architect [--epic Name] [--tracking-issue N] | status | next-epic | abort",
					"info",
				);
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
				ctx.ui.notify("✗ Epic aborted", "error");
				ctx.ui.setStatus("architect", null);
				return;
			}

			if (action === "next-epic") {
				const moduleFiles = discoverModules(ctx.cwd);
				const slice = findNextLogicalSlice(ctx.cwd, moduleFiles);
				if (!slice) {
					ctx.ui.notify("No more architecture slices to implement.", "info");
					return;
				}
				ctx.ui.notify(
					`Next epic: ${slice.module} (${slice.nextLogicalSlice.length} components planned)`,
					"info",
				);
				return;
			}

			// Start new epic: /architect --epic "Name" [--tracking-issue 100]
			const epicName = findFlag(tokens, "--epic");
			const trackingIssueId = findFlag(tokens, "--tracking-issue");

			if (!epicName) {
				ctx.ui.notify('Usage: /architect --epic "Epic Name" [--tracking-issue N]', "error");
				return;
			}

			try {
				// Validate epic name
				if (!epicName || epicName.trim() === "") {
					ctx.ui.notify('Usage: /architect --epic "Epic Name"', "error");
					return;
				}

				const state = await manager.startEpic(ctx, epicName, trackingIssueId);

				// Defensive: verify state was created properly
				if (!state || !state.slices || state.slices.length === 0) {
					ctx.ui.notify(
						"Failed to discover architecture components. Check .pi/architecture/modules/.",
						"error",
					);
					return;
				}

				const slice = state.slices[0];
				const components = slice.nextLogicalSlice || [];

				if (components.length === 0) {
					ctx.ui.notify("No planned components found in architecture module.", "error");
					return;
				}

				// Build items list with defensive checks
				const items = (state.issues || []).map((i) => i.id);
				if (items.length === 0) {
					ctx.ui.notify("Failed to generate issues.", "error");
					return;
				}

				// Step 1: Initialize git if not already done
				let gitInitMessage = "";
				try {
					const gitCheck = runScript(ctx.cwd, "git rev-parse --git-dir 2>/dev/null");
					if (gitCheck.exitCode !== 0) {
						runScript(ctx.cwd, "git init");
						runScript(ctx.cwd, "git add .");
						runScript(ctx.cwd, 'git commit -m "Initial Guardian scaffold"');
						gitInitMessage = "\n\u2713 Git repository initialized";
					}
				} catch {
					gitInitMessage = "\n\u26a0 Git init skipped";
				}

				// Step 2: Create remote repository if not already present
				const tool = readRepoTool(ctx.cwd);
				let repoMessage = "";
				let remoteUrl = "";
				try {
					const remoteCheck = runScript(ctx.cwd, "git remote get-url origin 2>/dev/null");
					if (remoteCheck.exitCode !== 0) {
						if (tool === "gh") {
							const createResult = runScript(
								ctx.cwd,
								`gh repo create --private --description "Epic: ${epicName}" 2>&1`,
							);
							if (createResult.exitCode === 0) {
								repoMessage = "\n\u2713 GitHub repository created";
								const urlMatch = createResult.stdout.match(/https?:\/\/[^\s]+/);
								if (urlMatch) remoteUrl = urlMatch[0];
							}
						} else {
							const createResult = runScript(
								ctx.cwd,
								`glab repo create --private --description "Epic: ${epicName}" 2>&1`,
							);
							if (createResult.exitCode === 0) {
								repoMessage = "\n\u2713 GitLab repository created";
								const urlMatch = createResult.stdout.match(/https?:\/\/[^\s]+/);
								if (urlMatch) remoteUrl = urlMatch[0];
							}
						}
					} else {
						remoteUrl = remoteCheck.stdout.trim();
						repoMessage = "\n\u2713 Remote already configured";
					}
				} catch {
					repoMessage = "\n\u26a0 Remote repo creation skipped (" + tool + " not configured)";
				}

				// Step 3: Create epic/issues in GitHub or GitLab
				let issueMessage = "";
				if (remoteUrl) {
					try {
						if (tool === "gh") {
							// Create milestone to serve as epic
							const milestoneResult = runScript(
								ctx.cwd,
								`gh api repos/$(gh repo view --json owner -q .owner.login)/$(gh repo view --json name -q .name)/milestones -f title="${epicName}" -f description="Epic for ${slice.module}" -f state="open" 2>&1`,
							);
							if (milestoneResult.exitCode === 0) {
								issueMessage = "\n\u2713 Epic milestone created in GitHub";
							}

							// Create individual issues
							const issuesCreated: string[] = [];
							for (const issue of state.issues || []) {
								const comp = components.find((c) =>
									issue.id.toLowerCase().includes(c.name.toLowerCase().replace(/\s+/g, "-")),
								);
								const desc = comp?.description || issue.title;
								// Read the full issue markdown file for body
								const issueFilename = `${issue.id}.md`.replace(/\//g, "-");
								const issuePath = join(ctx.cwd, ".pi/issues", issueFilename);
								let issueBody = desc;
								try {
									if (existsSync(issuePath)) {
										issueBody = readFileSync(issuePath, "utf-8");
									}
								} catch { /* use desc as fallback */ }

								const createResult = runScript(
									ctx.cwd,
									`gh issue create --title "${issue.title}" --body '${issueBody.replace(/'/g, "'\"'\"'")}' --label implementation --milestone "${epicName}" 2>&1`,
								);
								if (createResult.exitCode === 0) {
									const issueUrl = createResult.stdout.trim();
									issuesCreated.push(issueUrl);
								}
							}
							if (issuesCreated.length > 0) {
								issueMessage += `\n\u2713 ${issuesCreated.length} issues created in GitHub`;
							}
						} else {
							// GitLab
							const epicResult = runScript(
								ctx.cwd,
								`glab issue create --title "Epic: ${epicName}" --description "Epic for ${slice.module}" --label epic 2>&1`,
							);
							if (epicResult.exitCode === 0) {
								issueMessage = "\n\u2713 Epic created in GitLab";
							}

							const issuesCreated: string[] = [];
							for (const issue of state.issues || []) {
								const comp = components.find((c) =>
									issue.id.toLowerCase().includes(c.name.toLowerCase().replace(/\s+/g, "-")),
								);
								const desc = comp?.description || issue.title;
								const issueFilename = `${issue.id}.md`.replace(/\//g, "-");
								const issuePath = join(ctx.cwd, ".pi/issues", issueFilename);
								let issueBody = desc;
								try {
									if (existsSync(issuePath)) {
										issueBody = readFileSync(issuePath, "utf-8");
									}
								} catch { /* use desc as fallback */ }

								runScript(
									ctx.cwd,
									`glab issue create --title "${issue.title}" --description '${issueBody.replace(/'/g, "'\"'\"'")}' --label implementation 2>&1`,
								);
								issuesCreated.push(issue.id);
							}
							if (issuesCreated.length > 0) {
								issueMessage += `\n\u2713 ${issuesCreated.length} issues created in GitLab`;
							}
						}
					} catch {
						issueMessage = "\n\u26a0 Issue creation skipped";
					}
				}

				// Build status message
				let message = `\u25b6 Epic "${epicName}" started\n`;
				message += `Module: ${slice.module}\n`;
				message += gitInitMessage;
				message += repoMessage;
				message += issueMessage;
				message += "\n\nComponents to implement:\n";
				for (const c of components) {
					const desc =
						c.description.length > 100 ? `${c.description.slice(0, 100)}...` : c.description;
					message += `  - ${c.name}${desc ? `: ${desc}` : ""}\n`;
				}
				message += `\nIssues generated: ${(state.issues || []).length}\n`;
				message += "\nIssue files created in .pi/issues/\n";

				ctx.ui.notify(message, "success");
				ctx.ui.setStatus("architect", `Epic: ${epicName} (executing)`);

				// Step 4: Start the pipeline and instruct the agent to begin implementing
				const steps = [
					{ name: "implement", acceptance: { type: "validator", validators: ["ci"] } },
					{
						name: "validate",
						acceptance: { type: "validator", validators: ["ci", "tests", "security"] },
					},
					{ name: "create-mr", acceptance: { type: "none" } },
					{ name: "merge", acceptance: { type: "validator", validators: ["ci", "canonical"] } },
				];

				try {
					// Start pipeline via pipeline_start tool
					const pipelineResult = await ctx.tools.execute("pipeline_start", {
						name: epicName,
						items: items.join(","),
						steps: steps.map((s) => s.name).join(","),
						mergeOnValid: true,
					});

					const firstItem = items[0];
					const firstDesc = components[0]?.description || "Implementation";

					// Fetch the full next task prompt (includes issue context + step instructions)
					const nextTaskResult = await ctx.tools.execute("pipeline_next_task", {
						issueId: firstItem,
					});

					const taskText = typeof nextTaskResult === "string"
						? nextTaskResult
						: JSON.stringify(nextTaskResult);

					ctx.ui.setStatus("architect", `Epic: ${epicName} \u2192 pipeline running`);

					// Notify agent with the full task context so it starts implementing immediately
					ctx.ui.notify(
						`\n\ud83d\ude80 Pipeline started — begin implementing now.\n\n${taskText}`,
						"success",
					);
				} catch (e) {
					// Fallback: write pipeline state directly and notify
					const pipelineId = `PL-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
					const pipelineState = {
						id: pipelineId,
						name: epicName,
						items,
						steps,
						currentItemIndex: 0,
						currentStepIndex: 0,
						status: "running",
						retryCount: 0,
						results: [],
						mergeOnValid: true,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					};
					const pipelineStatePath = join(ctx.cwd, ".pi/.guardian-pipeline-state.json");
					writeFileSync(pipelineStatePath, JSON.stringify(pipelineState, null, 2));

					const firstItem = items[0];
					const firstDesc = components[0]?.description || "Implementation";
					const issueFilename = `${firstItem}.md`.replace(/\//g, "-");
					const issuePath = join(ctx.cwd, ".pi/issues", issueFilename);
					let issueContent = "";
					try {
						if (existsSync(issuePath)) {
							issueContent = readFileSync(issuePath, "utf-8");
						}
					} catch { /* fallback */ }

					ctx.ui.setStatus("architect", `Epic: ${epicName} \u2192 pipeline running`);
					ctx.ui.notify(
						`\n\ud83d\ude80 Pipeline ${pipelineId} started\n\n**Current task:** Item "${firstItem}" \u2192 Step: implement\n**Description:** ${firstDesc}\n\n**Instructions:**\n1. Read the issue file: .pi/issues/${issueFilename}\n2. Implement the component according to the issue spec\n3. Run \`pipeline_run_acceptance\` to validate\n4. Call \`pipeline_advance\` when done\n\n---\n\n## Issue Context\n\n${issueContent || "Issue file not found."}`,
						"success",
					);
				}
			} catch (e) {
				ctx.ui.notify(`Architect error: ${e}`, "error");
			}
		},
	});


	// ── architect_status tool ──
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

	// ── architect_discover tool ──
	pi.registerTool({
		name: "architect_discover",
		label: "Architect Discover",
		description: "Discover architecture modules and find the next logical slice.",
		parameters: { type: "object", properties: {} },
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const moduleFiles = discoverModules(ctx.cwd);
			if (moduleFiles.length === 0) {
				return {
					content: [
						{ type: "text", text: "No architecture modules found in .pi/architecture/modules/." },
					],
				};
			}

			const lines = ["## Architecture Modules\n"];
			for (const file of moduleFiles) {
				const components = parseModuleFile(join(ctx.cwd, ".pi/architecture/modules", file));
				const planned = components.filter((c) => c.status === "planned");
				lines.push(`### ${file.replace(".md", "")}`);
				lines.push(`  Components: ${components.length} (${planned.length} planned)`);
				if (planned.length > 0) {
					lines.push("  Next slice:");
					for (const c of planned) {
						lines.push(`    - ${c.name}`);
					}
				}
				lines.push("");
			}

			const slice = findNextLogicalSlice(ctx.cwd, moduleFiles);
			if (slice) {
				lines.push(`\n**Recommended next epic:** ${slice.module}`);
				lines.push(`Components: ${slice.nextLogicalSlice.map((c) => c.name).join(", ")}`);
			}

			return { content: [{ type: "text", text: lines.join("\n") }] };
		},
	});
}
