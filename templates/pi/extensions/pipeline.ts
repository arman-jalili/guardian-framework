/**
 * Pipeline Extension for pi
 *
 * Multi-step workflow engine that iterates over items (issues, tasks, etc.)
 * with per-step prompts and acceptance conditions.
 *
 * Example: "Close all P1 bugs" with steps [implement, validate, create-mr, merge]
 * Each step has its own acceptance gate (validator, shell, LLM, or none).
 *
 * Commands:
 *   /pipeline <name> --items "id1,id2" --steps "implement,validate,create-mr"
 *   /pipeline status              Show current pipeline progress
 *   /pipeline pause               Pause at current step
 *   /pipeline resume              Resume from where paused
 *   /pipeline skip-step           Skip current step
 *   /pipeline retry-step          Retry current step
 *   /pipeline abort               Kill pipeline
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ── Types ──

type ExtensionContext = {
	cwd: string;
	ui: {
		notify(message: string, level?: string): void;
		setStatus(key: string, message: string | null): void;
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

// ── Pipeline Schema ──

type StepName = string;

type StepConfig = {
	name: string;
	prompt?: string; // .pi/prompts/ path
	acceptance: AcceptanceConfig;
};

type AcceptanceConfig =
	| { type: "validator"; validators: string[] }
	| { type: "shell"; command: string }
	| { type: "llm"; prompt: string }
	| { type: "none" };

type PipelineStatus = "running" | "paused" | "done" | "failed" | "aborted";

type ItemResult = {
	item: string;
	status: "done" | "failed" | "skipped" | "in-progress";
	stepResults: StepResult[];
};

type StepResult = {
	step: string;
	status: "passed" | "failed" | "skipped";
	reason: string;
};

type PipelineState = {
	id: string;
	name: string;
	items: string[];
	steps: StepConfig[];
	currentItemIndex: number;
	currentStepIndex: number;
	status: PipelineStatus;
	retryCount: number;
	results: ItemResult[];
	mergeOnValid: boolean;
	createdAt: string;
	updatedAt: string;
};

// ── Constants ──

const PIPELINE_STATE_KEY = ".pi/.guardian-pipeline-state.json";

// ── Persistence ──

function loadPipelineState(cwd: string): PipelineState | null {
	const p = join(cwd, PIPELINE_STATE_KEY);
	if (!existsSync(p)) return null;
	try {
		return JSON.parse(readFileSync(p, "utf-8")) as PipelineState;
	} catch {
		return null;
	}
}

function savePipelineState(cwd: string, state: PipelineState): void {
	const p = join(cwd, PIPELINE_STATE_KEY);
	const dir = dirname(p);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(p, JSON.stringify(state, null, 2));
}

// ── Helpers ──

function generatePipelineId(): string {
	return `PL-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
}

function formatPipelineProgress(state: PipelineState): string {
	const total = state.items.length * state.steps.length;
	const completed = state.results.filter((r) => r.status === "done").length;
	const lines = [
		`## Pipeline: ${state.name}`,
		`**Status:** ${state.status}`,
		`**Progress:** ${completed}/${state.items.length} items, ${total === 0 ? 0 : Math.round((completed / total) * 100)}%`,
		"",
	];

	if (state.status === "running" || state.status === "paused") {
		lines.push(
			`**Current item:** ${state.items[state.currentItemIndex]}`,
			`**Current step:** ${state.steps[state.currentStepIndex]?.name}`,
			`**Step:** ${state.currentStepIndex + 1}/${state.steps.length}`,
			`**Item:** ${state.currentItemIndex + 1}/${state.items.length}`,
		);
	}

	if (state.results.length > 0) {
		lines.push("\n### Results");
		for (const r of state.results) {
			const emoji = r.status === "done" ? "✓" : r.status === "failed" ? "✗" : "○";
			lines.push(`  ${emoji} ${r.item} — ${r.status}`);
		}
	}

	return lines.join("\n");
}

function statusLine(state: PipelineState | null): string {
	if (!state) return "No active pipeline. Start one with /pipeline <name> ...";
	const emoji =
		state.status === "running"
			? "▶"
			: state.status === "paused"
				? "⏸"
				: state.status === "done"
					? "✓"
					: "✗";
	return `${emoji} Pipeline "${state.name}" (${state.status}) — ${state.currentItemIndex + 1}/${state.items.length} items`;
}

// ── Pipeline Manager ──

class PipelineManager {
	private state: PipelineState | null;

	constructor(private cwd: string) {
		this.state = loadPipelineState(cwd);
	}

	getState(): PipelineState | null {
		return this.state;
	}

	create(
		name: string,
		items: string[],
		steps: StepConfig[],
		opts: { mergeOnValid?: boolean } = {},
	): PipelineState {
		this.state = {
			id: generatePipelineId(),
			name,
			items,
			steps,
			currentItemIndex: 0,
			currentStepIndex: 0,
			status: "running",
			retryCount: 0,
			results: [],
			mergeOnValid: opts.mergeOnValid ?? false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		savePipelineState(this.cwd, this.state);
		return this.state;
	}

	pause(): void {
		if (!this.state) return;
		this.state.status = "paused";
		this.state.updatedAt = new Date().toISOString();
		savePipelineState(this.cwd, this.state);
	}

	resume(): void {
		if (!this.state) return;
		if (this.state.status === "paused") {
			this.state.status = "running";
			this.state.updatedAt = new Date().toISOString();
			savePipelineState(this.cwd, this.state);
		}
	}

	abort(): void {
		if (!this.state) return;
		this.state.status = "aborted";
		this.state.updatedAt = new Date().toISOString();
		savePipelineState(this.cwd, this.state);
	}

	skipStep(): void {
		if (!this.state) return;
		const item = this.state.items[this.state.currentItemIndex];
		const step = this.state.steps[this.state.currentStepIndex];

		// Mark step as skipped
		const result = this.state.results.find((r) => r.item === item);
		if (result) {
			result.stepResults.push({ step: step.name, status: "skipped", reason: "skipped by user" });
		} else {
			this.state.results.push({
				item,
				status: "in-progress",
				stepResults: [{ step: step.name, status: "skipped", reason: "skipped by user" }],
			});
		}

		// Move to next step
		this.advanceStep();
	}

	retryStep(): void {
		if (!this.state) return;
		this.state.retryCount++;
		this.state.updatedAt = new Date().toISOString();
		savePipelineState(this.cwd, this.state);
	}

	advanceStep(): void {
		if (!this.state) return;
		this.state.currentStepIndex++;
		this.state.updatedAt = new Date().toISOString();

		if (this.state.currentStepIndex >= this.state.steps.length) {
			// All steps done for this item
			const item = this.state.items[this.state.currentItemIndex];
			let result = this.state.results.find((r) => r.item === item);

			// If no result entry exists (e.g. advanceStep called before any steps ran),
			// create one so the item is tracked.
			if (!result) {
				result = { item, status: "skipped", stepResults: [] };
				this.state.results.push(result);
			}

			if (!result.stepResults.some((s) => s.status === "failed")) {
				if (result.stepResults.length === 0) {
					result.status = "skipped";
				} else {
					result.status = "done";
				}
			} else {
				result.status = "failed";
			}

			// Move to next item
			this.state.currentItemIndex++;
			this.state.currentStepIndex = 0;
			this.state.retryCount = 0;

			if (this.state.currentItemIndex >= this.state.items.length) {
				this.state.status = "done";
			}
		}

		savePipelineState(this.cwd, this.state);
	}

	markStepFailed(stepName: string, reason: string): void {
		if (!this.state) return;
		const item = this.state.items[this.state.currentItemIndex];
		let result = this.state.results.find((r) => r.item === item);
		if (!result) {
			result = { item, status: "in-progress", stepResults: [] };
			this.state.results.push(result);
		}
		result.stepResults.push({ step: stepName, status: "failed", reason });
		result.status = "failed";
		this.state.updatedAt = new Date().toISOString();
		savePipelineState(this.cwd, this.state);
	}

	markStepPassed(stepName: string): void {
		if (!this.state) return;
		const item = this.state.items[this.state.currentItemIndex];
		let result = this.state.results.find((r) => r.item === item);
		if (!result) {
			result = { item, status: "in-progress", stepResults: [] };
			this.state.results.push(result);
		}
		result.stepResults.push({ step: stepName, status: "passed", reason: "" });
		this.state.updatedAt = new Date().toISOString();
		savePipelineState(this.cwd, this.state);
	}
}

// ── Extension ──

export default function (pi: ExtensionAPI) {
	let manager: PipelineManager | null = null;

	pi.on("session_start", async (_event, ctx) => {
		manager = new PipelineManager(ctx.cwd);
		const state = manager.getState();
		if (state && state.status !== "done" && state.status !== "aborted") {
			ctx.ui.setStatus("pipeline", statusLine(state));
		}
	});

	// ── /pipeline command ──
	pi.registerCommand("pipeline", {
		description: "Manage multi-step pipeline workflows",
		handler: async (args, ctx) => {
			if (!manager) manager = new PipelineManager(ctx.cwd);
			const state = manager.getState();

			// pi passes args as a string. Split into tokens.
			const raw = typeof args === "string" ? args : "";
			const tokens = raw.split(/\s+/).filter(Boolean);
			const action = tokens[0];

			// Status
			if (!action || action === "status") {
				if (!state) {
					ctx.ui.notify("No active pipeline. Start one with /pipeline <name> ...", "info");
					return;
				}
				ctx.ui.notify(formatPipelineProgress(state), "info");
				return;
			}

			// Pause
			if (action === "pause") {
				if (!state || state.status !== "running") {
					ctx.ui.notify("No running pipeline to pause.", "warn");
					return;
				}
				manager.pause();
				ctx.ui.notify("⏸ Pipeline paused", "warn");
				ctx.ui.setStatus("pipeline", statusLine(manager.getState()));
				return;
			}

			// Resume
			if (action === "resume") {
				if (!state || state.status !== "paused") {
					ctx.ui.notify("No paused pipeline to resume.", "warn");
					return;
				}
				manager.resume();
				ctx.ui.notify("▶ Pipeline resumed", "success");
				ctx.ui.setStatus("pipeline", statusLine(manager.getState()));
				return;
			}

			// Abort
			if (action === "abort") {
				if (!state || (state.status !== "running" && state.status !== "paused")) {
					ctx.ui.notify("No active pipeline to abort.", "warn");
					return;
				}
				manager.abort();
				ctx.ui.notify("✗ Pipeline aborted", "error");
				ctx.ui.setStatus("pipeline", null);
				return;
			}

			// Skip step
			if (action === "skip-step") {
				if (!state || (state.status !== "running" && state.status !== "paused")) {
					ctx.ui.notify("No active pipeline.", "warn");
					return;
				}
				manager.skipStep();
				ctx.ui.notify("⏭ Step skipped", "info");
				ctx.ui.setStatus("pipeline", statusLine(manager.getState()));
				return;
			}

			// Retry step
			if (action === "retry-step") {
				if (!state || (state.status !== "running" && state.status !== "paused")) {
					ctx.ui.notify("No active pipeline.", "warn");
					return;
				}
				manager.retryStep();
				ctx.ui.notify("🔄 Retrying current step", "info");
				return;
			}

			// Start new pipeline: /pipeline <name> --items "a,b,c" --steps "implement,validate" [--merge-on-valid]
			const name = tokens[0];
			if (!name) {
				ctx.ui.notify(
					'Usage: /pipeline <name> --items "id1,id2" --steps "implement,validate,create-mr" [--merge-on-valid]',
					"error",
				);
				return;
			}

			const itemsFlag = tokens.find((a) => a.startsWith("--items="));
			const stepsFlag = tokens.find((a) => a.startsWith("--steps="));
			const mergeFlag = tokens.includes("--merge-on-valid");

			if (!itemsFlag || !stepsFlag) {
				ctx.ui.notify(
					'Usage: /pipeline <name> --items "id1,id2" --steps "implement,validate,create-mr" [--merge-on-valid]',
					"error",
				);
				return;
			}

			const items = itemsFlag
				.split("=")[1]
				.split(",")
				.map((v) => v.trim())
				.filter(Boolean);
			const stepNames = stepsFlag
				.split("=")[1]
				.split(",")
				.map((v) => v.trim())
				.filter(Boolean);

			// Build step configs from names
			const steps = buildSteps(stepNames);

			const newState = manager.create(name, items, steps, { mergeOnValid: mergeFlag });

			const stepInfo = steps.map((s) => s.name).join(" → ");
			ctx.ui.notify(
				`▶ Pipeline "${name}" started (${newState.id})\n` +
					`Items: ${items.join(", ")}\n` +
					`Steps: ${stepInfo}\n` +
					`${mergeFlag ? "Merge on valid: enabled" : ""}`,
				"success",
			);
			ctx.ui.setStatus("pipeline", statusLine(newState));
		},
	});

	// ── pipeline_status tool ──
	pi.registerTool({
		name: "pipeline_status",
		label: "Pipeline Status",
		description: "Show the current pipeline status and progress.",
		parameters: { type: "object", properties: {} },
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			if (!manager) manager = new PipelineManager(ctx.cwd);
			const state = manager.getState();
			if (!state) {
				return { content: [{ type: "text" as const, text: "No active pipeline." }] };
			}
			return { content: [{ type: "text" as const, text: formatPipelineProgress(state) }] };
		},
	});

	// ── pipeline_advance tool ──
	pi.registerTool({
		name: "pipeline_advance",
		label: "Pipeline Advance",
		description: "Mark current step as passed and advance to the next step/item.",
		parameters: {
			type: "object",
			properties: {
				stepName: { type: "string", description: "Name of the completed step" },
			},
		},
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!manager) manager = new PipelineManager(ctx.cwd);
			const state = manager.getState();
			if (!state || state.status !== "running") {
				return { content: [{ type: "text" as const, text: "No running pipeline." }] };
			}

			const stepName = (params.stepName as string) || state.steps[state.currentStepIndex]?.name;
			manager.markStepPassed(stepName);
			manager.advanceStep();

			const nextInfo = getNextStepInfo(state);
			return { content: [{ type: "text" as const, text: nextInfo }] };
		},
	});

	// ── pipeline_fail tool ──
	pi.registerTool({
		name: "pipeline_fail",
		label: "Pipeline Fail Step",
		description:
			"Mark current step as failed and advance (skipping remaining steps for this item).",
		parameters: {
			type: "object",
			properties: {
				reason: { type: "string", description: "Why the step failed" },
			},
		},
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!manager) manager = new PipelineManager(ctx.cwd);
			const state = manager.getState();
			if (!state || state.status !== "running") {
				return { content: [{ type: "text" as const, text: "No running pipeline." }] };
			}

			const reason = (params.reason as string) || "step failed";
			const stepName = state.steps[state.currentStepIndex]?.name;
			manager.markStepFailed(stepName, reason);

			// Skip remaining steps for this item, move to next
			const currentItem = state.items[state.currentItemIndex];
			const remainingSteps = state.steps.slice(state.currentStepIndex + 1);
			for (const step of remainingSteps) {
				manager.markStepFailed(step.name, "skipped due to prior failure");
			}
			state.currentItemIndex++;
			state.currentStepIndex = 0;
			state.retryCount = 0;
			if (state.currentItemIndex >= state.items.length) {
				state.status = "done";
			}
			state.updatedAt = new Date().toISOString();
			savePipelineState(ctx.cwd, state);

			return {
				content: [{ type: "text" as const, text: `Step failed: ${reason}. Moving to next item.` }],
			};
		},
	});
}

// ── Step Builder ──

function buildSteps(stepNames: string[]): StepConfig[] {
	const stepConfigs: Record<string, StepConfig> = {
		implement: {
			name: "implement",
			prompt: ".pi/prompts/issue-implementation-series.md",
			acceptance: { type: "validator", validators: ["ci"] },
		},
		validate: {
			name: "validate",
			acceptance: { type: "validator", validators: ["ci", "tests", "security"] },
		},
		"create-mr": {
			name: "create-mr",
			prompt: ".pi/prompts/issue-closeout.md",
			acceptance: { type: "none" },
		},
		merge: {
			name: "merge",
			acceptance: { type: "validator", validators: ["ci", "canonical"] },
		},
		document: {
			name: "document",
			prompt: ".pi/prompts/blueprint-update.md",
			acceptance: { type: "validator", validators: ["canonical"] },
		},
		test: {
			name: "test",
			acceptance: { type: "validator", validators: ["tests"] },
		},
		"security-review": {
			name: "security-review",
			acceptance: { type: "validator", validators: ["security"] },
		},
	};

	return stepNames.map((name) => {
		const config = stepConfigs[name];
		if (config) return { ...config };
		// Unknown step: no prompt, no acceptance gate
		return { name, acceptance: { type: "none" } as AcceptanceConfig };
	});
}

function getNextStepInfo(state: PipelineState): string {
	if (state.currentItemIndex >= state.items.length) {
		return "Pipeline complete! All items processed.";
	}
	const item = state.items[state.currentItemIndex];
	const step = state.steps[state.currentStepIndex];
	if (!step) return "No more steps.";
	return `Next: Item "${item}" → Step "${step.name}" (${state.currentStepIndex + 1}/${state.steps.length})`;
}
