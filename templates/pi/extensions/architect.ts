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
	shell: {
		execute(
			command: string,
			options?: { signal?: AbortSignal },
		): Promise<{
			exitCode: number;
			stdout: string;
		}>;
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

// ── Helpers ──

function log(ctx: ExtensionContext, message: string, level = "info") {
	ctx.ui.notify(message, level);
}

function runScript(
	ctx: ExtensionContext,
	script: string,
): Promise<{ exitCode: number; stdout: string }> {
	return ctx.shell.execute(`bash ${script}`, { signal: AbortSignal.timeout(120_000) });
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

	// The module format uses ## Component Details (or ## Components)
	// followed by ### ComponentName headers with status: and depends: fields.
	// We only capture ### headers that appear under a "Component" ## section
	// AND have a status: field defined.

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

		// Detect component section: ## Component Details, ## Components, etc.
		if (trimmed.match(/^##\s+Component/i)) {
			inComponentSection = true;
			continue;
		}
		// Next top-level section ends the component section
		if (inComponentSection && trimmed.match(/^##\s+/)) {
			saveCurrent();
			currentName = "";
			currentStatus = "";
			currentDesc = "";
			currentDeps = [];
			inComponentSection = false;
			continue;
		}

		// Only process ### headers inside the component section
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

	// Save last component
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

// ── Epic Orchestration ──

class ArchitectManager {
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
		// Step 1: Discover architecture slices
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

		// Step 2: Generate issues from slice
		const issues = [];
		const piDir = `${this.cwd}/.pi`;

		for (const component of slice.nextLogicalSlice) {
			issues.push({
				id: `issue-${component.name.toLowerCase().replace(/\s+/g, "-")}`,
				title: `Implement: ${component.name}`,
				status: "planned",
			});
		}

		// Add architecture readiness issue
		issues.push({
			id: "issue-architecture-readiness",
			title: "Architecture Readiness: Runbook, DR, Docs, Observability",
			status: "planned",
		});

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

	async validateEpicDraft(ctx: ExtensionContext): Promise<{ pass: boolean; results: string[] }> {
		if (!this.state) throw new Error("No active epic");
		this.state.status = "validating";
		saveEpicState(this.cwd, this.state);

		const results: string[] = [];
		const scripts = [
			{ name: "architecture", path: ".pi/scripts/validate-architecture.sh" },
			{ name: "security", path: ".pi/scripts/validate-security.sh" },
			{ name: "operations", path: ".pi/scripts/validate-operations.sh" },
		];

		let allPassed = true;
		for (const script of scripts) {
			const fullPath = join(this.cwd, script.path);
			if (!existsSync(fullPath)) {
				results.push(`SKIP: ${script.name} (script not found)`);
				continue;
			}
			try {
				const result = await runScript(ctx, script.path);
				if (result.exitCode === 0) {
					results.push(`PASS: ${script.name}`);
				} else {
					results.push(`FAIL: ${script.name} — ${result.stdout.slice(0, 200)}`);
					allPassed = false;
				}
			} catch {
				results.push(`FAIL: ${script.name} (timeout or error)`);
				allPassed = false;
			}
		}

		if (!allPassed) {
			this.state.status = "aborted";
			saveEpicState(this.cwd, this.state);
		}

		return { pass: allPassed, results };
	}

	async publishEpic(ctx: ExtensionContext): Promise<void> {
		if (!this.state) throw new Error("No active epic");
		this.state.status = "publishing";
		saveEpicState(this.cwd, this.state);

		// Create tracking issue
		const createScript = join(this.cwd, ".pi/scripts/git/create-tracking-issue.sh");
		if (existsSync(createScript)) {
			try {
				const result = await runScript(
					ctx,
					`.pi/scripts/git/create-tracking-issue.sh --title "${this.state.name}" --body "Tracking epic progress"`,
				);
				if (result.exitCode === 0) {
					const idMatch = result.stdout.match(/TRACKING_ID=(.+)/);
					if (idMatch) {
						this.state.trackingIssueId = idMatch[1].trim();
						saveEpicState(this.cwd, this.state);
					}
				}
			} catch {
				// Git not available — continue locally
			}
		}
	}

	async abortEpic(): Promise<void> {
		if (!this.state) return;
		this.state.status = "aborted";
		saveEpicState(this.cwd, this.state);
	}
}

// ── Extension ──

export default function (pi: ExtensionAPI) {
	let manager: ArchitectManager | null = null;

	// Helper: parse --flag=value or --flag value patterns
	function findFlag(tokens: string[], prefix: string): string | undefined {
		// Try --flag=value first
		const eqMatch = tokens.find((a) => a.startsWith(`${prefix}=`));
		if (eqMatch)
			return eqMatch
				.split("=")
				.slice(1)
				.join("=")
				.replace(/^["']|["']$/g, "");
		// Try --flag value
		const idx = tokens.indexOf(prefix);
		if (idx !== -1 && idx + 1 < tokens.length) return tokens[idx + 1].replace(/^["']|["']$/g, "");
		return undefined;
	}

	pi.on("session_start", async (_event, ctx) => {
		manager = new ArchitectManager(ctx.cwd);
		const state = manager.getState();
		if (state && state.status !== "done" && state.status !== "aborted") {
			ctx.ui.setStatus("architect", `Epic: ${state.name} (${state.status})`);
		}
	});

	// ── /architect command ──
	pi.registerCommand("architect", {
		description: "Orchestrate the full architecture-to-implementation process",
		handler: async (args, ctx) => {
			if (!manager) manager = new ArchitectManager(ctx.cwd);
			const raw = typeof args === "string" ? args : "";
			const tokens = raw.split(/\s+/).filter(Boolean);
			const action = tokens[0];

			if (!action || action === "status") {
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
				// Auto-discover next epic name from module
				const moduleFiles = discoverModules(ctx.cwd);
				const slice = findNextLogicalSlice(ctx.cwd, moduleFiles);
				if (!slice) {
					ctx.ui.notify("No more architecture slices to implement.", "info");
					return;
				}
				const epicName = `Implement: ${slice.module}`;
				ctx.ui.notify(
					`Next epic: ${epicName} (${slice.nextLogicalSlice.length} components planned)`,
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
				const state = await manager.startEpic(ctx, epicName, trackingIssueId);
				const slice = state.slices[0];

				let message = `▶ Epic "${epicName}" started\n`;
				message += `Module: ${slice.module}\n`;
				message += "Components to implement:\n";
				for (const c of slice.nextLogicalSlice) {
					const desc =
						c.description.length > 100 ? `${c.description.slice(0, 100)}...` : c.description;
					message += `  - ${c.name}${desc ? `: ${desc}` : ""}\n`;
				}
				message += `\nIssues generated: ${state.issues.length} (${state.issues.length - 1} implementation + 1 architecture readiness)\n`;
				message += "\nStarting pipeline now...\n";

				ctx.ui.notify(message, "success");
				ctx.ui.setStatus("architect", `Epic: ${epicName} (executing)`);

				// Automatically start the pipeline
				const items = state.issues.map((i) => i.id).join(",");
				const pipelineCmd = `/pipeline "${epicName}" --items "${items}" --steps "implement,validate,create-mr,merge" --merge-on-valid`;

				ctx.ui.notify(`\n🚀 Starting pipeline:\n${pipelineCmd}`, "info");

				// The agent will execute the pipeline command as its next action
				ctx.ui.setStatus("architect", `Epic: ${epicName} → pipeline running`);
			} catch (e) {
				ctx.ui.notify(`Error: ${e}`, "error");
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
			if (!manager) manager = new ArchitectManager(ctx.cwd);
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
