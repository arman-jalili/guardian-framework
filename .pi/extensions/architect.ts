/**
 * Architect Extension — Full Architecture-to-Implementation Pipeline
 *
 * Entry point. Imports from submodules and registers the extension.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ArchitectureSlice, EpicState, ExtensionAPI, ExtensionContext, ModuleComponent } from "./architect-lib/types.ts";
import {
	ARCH_MODULES_DIR,
	commandExists,
	createRemoteIssue,
	discoverModules,
	ensureRemoteRepo,
	findModuleByName,
	findNextLogicalSlice,
	linkRemoteIssue,
	parseModuleFile,
	readGroupId,
	readRepository,
	readRepoTool,
	runScript,
} from "./architect-lib/helpers.ts";
import {
	generateArchitectureReadinessMarkdown,
	generateContractFreezeMarkdown,
	generateIssueMarkdown,
	generateProofingMarkdown,
} from "./architect-lib/generators.ts";

// ── Epic State Persistence ──

const EPIC_STATE_KEY = ".pi/.guardian-epic-state.json";

function loadEpicState(cwd: string): EpicState | null {
	const p = join(cwd, EPIC_STATE_KEY);
	try {
		if (!existsSync(p)) return null;
		return JSON.parse(readFileSync(p, "utf-8")) as EpicState;
	} catch {
		return null;
	}
}

function saveEpicState(cwd: string, state: EpicState): void {
	const p = join(cwd, EPIC_STATE_KEY);
	const dir = dirname(p);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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

		// Try to match epic name to a module doc
		const matchedModule = findModuleByName(this.cwd, name);
		let slice: ArchitectureSlice | null = null;
		if (matchedModule) {
			const components = parseModuleFile(join(this.cwd, ARCH_MODULES_DIR, matchedModule));
			const planned = components.filter((c: ModuleComponent) => c.status === "planned");
			if (planned.length > 0) {
				slice = { module: matchedModule.replace(".md", ""), components, nextLogicalSlice: planned };
			}
		}
		// Fallback: first module with planned components
		if (!slice) {
			slice = findNextLogicalSlice(this.cwd, moduleFiles);
		}
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

		// 0. Auto-create tracking issue (unless user provided one)
		let effectiveTrackingId = trackingIssueId || null;
		if (!effectiveTrackingId && hasRemote && remoteRepo) {
			const trackingBody = [
				`# Epic: ${name}`,
				"",
				`**Module:** ${slice.module}`,
				`**Created:** ${new Date().toISOString()}`,
				"",
				"## Components",
				...slice.nextLogicalSlice.map((c: ModuleComponent) => `- ${c.name}: ${c.description.slice(0, 120)}`),
				"",
				"## Issues",
				"| # | Issue | Status |",
				"|---|-------|--------|",
				"| 1 | Contract Freeze | planned |",
				...slice.nextLogicalSlice.map((c: ModuleComponent, i: number) =>
					`| ${i + 2} | ${c.name} | planned |`,
				),
				`| ${slice.nextLogicalSlice.length + 2} | Proofing & CI | planned |`,
				`| ${slice.nextLogicalSlice.length + 3} | Architecture Readiness | planned |`,
				"",
				"## Pipeline",
				"Steps: implement → validate → create-mr → merge",
				"",
				"---",
				"Auto-generated by Guardian Architect",
			].join("\n");
			const trackingBodyFile = join(issuesDir, ".tracking-issue-body.md");
			writeFileSync(trackingBodyFile, trackingBody);
			const trackingResult = createRemoteIssue(
				this.cwd,
				`Epic: ${name}`,
				trackingBodyFile,
				"epic,tracking",
				remoteRepo,
			);
			if (trackingResult.success && trackingResult.issueNumber) {
				effectiveTrackingId = trackingResult.issueNumber;
			}
			try { if (existsSync(trackingBodyFile)) unlinkSync(trackingBodyFile); } catch { /* ignore */ }
		}

		// 1. Contract freeze
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
				if (effectiveTrackingId) linkRemoteIssue(this.cwd, result.issueNumber, effectiveTrackingId);
			}
		}
		issues.push(freezeEntry);

		// 2. Implementation issues
		for (let i = 0; i < slice.nextLogicalSlice.length; i++) {
			const comp = slice.nextLogicalSlice[i];
			const id = `issue-${comp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
			const entry = {
				id,
				title: `${comp.name}: ${comp.description.slice(0, 80)}`,
				status: "planned" as string,
				remoteIssueId: null as string | null,
			};
			const md = generateIssueMarkdown(comp, slice, i, slice.nextLogicalSlice.length);
			writeFileSync(join(issuesDir, `${id}.md`), md);
			if (hasRemote && remoteRepo) {
				const result = createRemoteIssue(this.cwd, entry.title, join(issuesDir, `${id}.md`), "epic,implementation", remoteRepo);
				if (result.success && result.issueNumber) {
					entry.remoteIssueId = result.issueNumber;
					if (effectiveTrackingId) linkRemoteIssue(this.cwd, result.issueNumber, effectiveTrackingId);
				}
			}
			issues.push(entry);
		}

		// 3. Proofing
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
				if (effectiveTrackingId) linkRemoteIssue(this.cwd, result.issueNumber, effectiveTrackingId);
			}
		}
		issues.push(proofingEntry);

		// 4. Architecture readiness
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
				if (effectiveTrackingId) linkRemoteIssue(this.cwd, result.issueNumber, effectiveTrackingId);
			}
		}
		issues.push(readinessEntry);

		const state: EpicState = {
			name,
			trackingIssueId: effectiveTrackingId,
			epicId: null,
			slices: [slice],
			issues,
			status: "planning",
			currentIssueIndex: 0,
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

				// Initialize git if needed
				try {
					const gitCheck = runScript(ctx.cwd, "git rev-parse --git-dir 2>/dev/null");
					if (gitCheck.exitCode !== 0) {
						runScript(ctx.cwd, "git init");
						runScript(ctx.cwd, "git add .");
						runScript(ctx.cwd, 'git commit -m "Initial Guardian scaffold"');
					}
				} catch { /* ignore */ }

				// Remove stale pipeline state so the new one takes effect
				try {
					const oldPipelinePath = join(ctx.cwd, ".pi/.guardian-pipeline-state.json");
					if (existsSync(oldPipelinePath)) unlinkSync(oldPipelinePath);
				} catch { /* ignore */ }

				// Write pipeline state directly (ctx.tools not available in command handlers)
				const pipelineId = `PL-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
				const pipelineState = {
					id: pipelineId,
					name: epicName,
					items,
					steps: [
						{ name: "implement", prompt: ".pi/prompts/issue-implementation-series.md", acceptance: { type: "validator", validators: ["ci"] } },
						{ name: "validate", acceptance: { type: "validator", validators: ["ci", "tests", "security"] } },
						{ name: "create-mr", prompt: ".pi/prompts/issue-closeout.md", acceptance: { type: "none" } },
						{ name: "merge", prompt: ".pi/prompts/issue-merge.md", acceptance: { type: "validator", validators: ["ci", "canonical"] } },
					],
					currentItemIndex: 0,
					currentStepIndex: 0,
					status: "running",
					retryCount: 0,
					results: [],
					mergeOnValid: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};
				const pipelineDir = dirname(join(ctx.cwd, ".pi/.guardian-pipeline-state.json"));
				if (!existsSync(pipelineDir)) mkdirSync(pipelineDir, { recursive: true });
				writeFileSync(join(ctx.cwd, ".pi/.guardian-pipeline-state.json"), JSON.stringify(pipelineState, null, 2));

				const repository = readRepository(ctx.cwd) || "";
				const trackingUrl = state.trackingIssueId && repository
					? `\n**Tracking issue:** https://github.com/${repository}/issues/${state.trackingIssueId}`
					: "";

				const firstItem = items[0];
				const issueFilename = `${firstItem}.md`.replace(/\//g, "-");
				const issuePath = join(ctx.cwd, ".pi/issues", issueFilename);

				let issueContent = "";
				try {
					if (existsSync(issuePath)) {
						issueContent = readFileSync(issuePath, "utf-8").replace(/^---[\s\S]*?---\n/, "").trim();
					}
				} catch { /* ignore */ }

				const instructions = [
					`Epic "${epicName}" started with ${items.length} issues across ${components.length} components.${trackingUrl}`,
					"",
					`Pipeline \`${pipelineId}\` created: ${items.length} items × 4 steps (implement → validate → create-mr → merge)`,
					`**Current:** Item "${firstItem}" → Step: implement`,
					"",
					"**Available pipeline tools:**",
					"- `pipeline_next_task` — get full context for current item+step",
					"- `pipeline_run_acceptance` — run validators for current step",
					"- `pipeline_advance` — mark step passed, move to next",
					"- `pipeline_fail` — mark step failed with reason",
					"- `pipeline_status` — check overall progress",
					"",
					"**Workflow per item:**",
					"1. Create branch: `feat/<issue-id>`",
					"2. Implement the component according to the issue context below",
					"3. Run `pipeline_run_acceptance` to validate your work",
					"4. Call `pipeline_advance` to move to the next step",
					"5. Pipeline auto-advances through: implement → validate → create-mr → merge",
					"",
					"---",
					"",
					"## Issue Context",
					"",
					issueContent || `Review .pi/issues/${issueFilename} for full details.`,
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
