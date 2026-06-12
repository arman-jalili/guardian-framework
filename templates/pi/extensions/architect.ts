/**
 * Architect Extension — Full Architecture-to-Implementation Pipeline
 *
 * Entry point. Imports from submodules and registers the extension.
 * Split into: architect-lib/types.ts, architect-lib/helpers.ts, architect-lib/generators.ts
 */

import type { ExtensionAPI } from "./architect-lib/types.ts";
import type { ExtensionContext } from "./architect-lib/types.ts";
import type { EpicState, ModuleComponent, ArchitectureSlice } from "./architect-lib/types.ts";

// Import helpers and generators (they register themselves in the module scope)


// ── Epic State Persistence ──

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

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
		const { discoverModules, findNextLogicalSlice, readRepoTool, readRepository, commandExists, runScript, ensureRemoteRepo, createRemoteIssue, linkRemoteIssue } = await import("./architect-lib/helpers.ts");
		const { generateIssueMarkdown, generateContractFreezeMarkdown, generateProofingMarkdown, generateArchitectureReadinessMarkdown } = await import("./architect-lib/generators.ts");

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
				const { discoverModules, findNextLogicalSlice } = await import("./architect-lib/helpers.ts");
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
					const { runScript } = await import("./architect-lib/helpers.ts");
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
				const { readRepository, runScript } = await import("./architect-lib/helpers.ts");
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
			const { discoverModules, findNextLogicalSlice, parseModuleFile } = await import("./architect-lib/helpers.ts");
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
