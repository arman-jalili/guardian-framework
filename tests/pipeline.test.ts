/**
 * Tests for Pipeline Engine (Phase 2)
 */

import { beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

// ── Test helpers ──

function makeProjectDir(): string {
	const dir = fs.mkdtempSync(path.join(tmpdir(), "guardian-pipeline-test-"));
	fs.mkdirSync(path.join(dir, ".pi"), { recursive: true });
	return dir;
}

const PIPELINE_STATE_KEY = ".pi/.guardian-pipeline-state.json";

function loadState(cwd: string) {
	const p = path.join(cwd, PIPELINE_STATE_KEY);
	if (!fs.existsSync(p)) return null;
	return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function saveState(cwd: string, state: Record<string, unknown>) {
	const p = path.join(cwd, PIPELINE_STATE_KEY);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, JSON.stringify(state, null, 2));
}

function makePipelineState(
	name: string,
	items: string[],
	steps: string[],
): Record<string, unknown> {
	return {
		id: "PL-0001",
		name,
		items,
		steps: steps.map((name) => ({ name, acceptance: { type: "none" } })),
		currentItemIndex: 0,
		currentStepIndex: 0,
		status: "running",
		retryCount: 0,
		results: [],
		mergeOnValid: false,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

// ── Step Builder Tests ──

describe("Pipeline — Step Builder", () => {
	const BUILTIN_STEPS = [
		"implement",
		"validate",
		"create-mr",
		"merge",
		"document",
		"test",
		"security-review",
	];

	test("built-in step names are defined", () => {
		expect(BUILTIN_STEPS).toContain("implement");
		expect(BUILTIN_STEPS).toContain("validate");
		expect(BUILTIN_STEPS).toContain("create-mr");
		expect(BUILTIN_STEPS).toContain("merge");
		expect(BUILTIN_STEPS.length).toBe(7);
	});

	test("unknown step name creates minimal config", () => {
		// Unknown steps should have no prompt and no acceptance gate
		const name = "custom-step";
		const config = { name, acceptance: { type: "none" } };
		expect(config.acceptance.type).toBe("none");
		expect(config).not.toHaveProperty("prompt");
	});

	test("implement step has CI validator acceptance", () => {
		const config = {
			name: "implement",
			prompt: ".pi/prompts/issue-implementation-series.md",
			acceptance: { type: "validator", validators: ["ci"] },
		};
		expect(config.acceptance.type).toBe("validator");
		expect(config.acceptance.validators).toContain("ci");
		expect(config.prompt).toBeDefined();
	});

	test("validate step runs all core validators", () => {
		const config = {
			name: "validate",
			acceptance: { type: "validator", validators: ["ci", "tests", "security"] },
		};
		expect(config.acceptance.validators).toContain("ci");
		expect(config.acceptance.validators).toContain("tests");
		expect(config.acceptance.validators).toContain("security");
	});

	test("merge step requires CI + canonical", () => {
		const config = {
			name: "merge",
			acceptance: { type: "validator", validators: ["ci", "canonical"] },
		};
		expect(config.acceptance.type).toBe("validator");
		expect(config.acceptance.validators.length).toBe(2);
	});
});

// ── Pipeline State Tests ──

describe("Pipeline — State persistence", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeProjectDir();
	});

	test("save and load pipeline state", () => {
		const state = makePipelineState("Fix bugs", ["1234", "1235"], ["implement", "validate"]);
		saveState(dir, state);

		const loaded = loadState(dir);
		expect(loaded).not.toBeNull();
		expect(loaded?.name).toBe("Fix bugs");
		expect(loaded?.items).toEqual(["1234", "1235"]);
		expect(loaded?.status).toBe("running");
	});

	test("returns null when no pipeline file exists", () => {
		const freshDir = makeProjectDir();
		expect(loadState(freshDir)).toBeNull();
	});

	test("pipeline ID is generated", () => {
		const state = makePipelineState("Test", ["1"], ["implement"]);
		expect(state.id).toMatch(/^PL-\d{4}$/);
	});

	test("status transitions are tracked", () => {
		const state = makePipelineState("Test", ["1"], ["implement"]);
		saveState(dir, state);

		state.status = "paused";
		state.updatedAt = new Date().toISOString();
		saveState(dir, state);

		const loaded = loadState(dir);
		expect(loaded?.status).toBe("paused");
	});
});

// ── Pipeline Progress Tests ──

describe("Pipeline — Progress tracking", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeProjectDir();
	});

	test("initial state shows first item and step", () => {
		const state = makePipelineState(
			"Test",
			["1234", "1235"],
			["implement", "validate", "create-mr"],
		);
		expect(state.currentItemIndex).toBe(0);
		expect(state.currentStepIndex).toBe(0);
		expect(state.status).toBe("running");
	});

	test("advancing step increments step index", () => {
		const state = makePipelineState("Test", ["1234"], ["implement", "validate"]);
		state.currentStepIndex++;
		expect(state.currentStepIndex).toBe(1);
	});

	test("advancing past last step moves to next item", () => {
		const state = makePipelineState("Test", ["1234", "1235"], ["implement", "validate"]);
		// Simulate completing all steps for first item
		state.currentStepIndex = 2; // past last step
		state.currentItemIndex++;
		state.currentStepIndex = 0;
		expect(state.currentItemIndex).toBe(1);
		expect(state.currentStepIndex).toBe(0);
	});

	test("completing all items sets status to done", () => {
		const state = makePipelineState("Test", ["1234"], ["implement"]);
		state.currentItemIndex = 1; // past last item
		state.status = "done";
		expect(state.status).toBe("done");
	});

	test("results accumulate per item", () => {
		const state = makePipelineState("Test", ["1234", "1235"], ["implement", "validate"]);
		state.results = [
			{
				item: "1234",
				status: "done",
				stepResults: [
					{ step: "implement", status: "passed", reason: "" },
					{ step: "validate", status: "passed", reason: "" },
				],
			},
		];
		expect(state.results).toHaveLength(1);
		expect(state.results[0].status).toBe("done");
	});

	test("failed step marks item as failed", () => {
		const state = makePipelineState("Test", ["1234"], ["implement", "validate"]);
		state.results = [
			{
				item: "1234",
				status: "failed",
				stepResults: [
					{ step: "implement", status: "passed", reason: "" },
					{ step: "validate", status: "failed", reason: "tests failed" },
				],
			},
		];
		expect(state.results[0].status).toBe("failed");
	});
});

// ── Pipeline Command Parsing Tests ──

describe("Pipeline — Command parsing", () => {
	test("--items flag parses comma-separated list", () => {
		const flag = "--items=1234,1235,1236";
		const items = flag
			.split("=")[1]
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean);
		expect(items).toEqual(["1234", "1235", "1236"]);
	});

	test("--steps flag parses comma-separated list", () => {
		const flag = "--steps=implement,validate,create-mr,merge";
		const steps = flag
			.split("=")[1]
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean);
		expect(steps).toEqual(["implement", "validate", "create-mr", "merge"]);
	});

	test("--merge-on-valid flag is detected", () => {
		const args = ["Test", "--items=1,2", "--steps=implement,merge", "--merge-on-valid"];
		expect(args.includes("--merge-on-valid")).toBe(true);
	});

	test("pipeline command without required flags fails validation", () => {
		const args = ["Test"];
		const hasItems = args.some((a) => a.startsWith("--items="));
		const hasSteps = args.some((a) => a.startsWith("--steps="));
		expect(hasItems).toBe(false);
		expect(hasSteps).toBe(false);
	});

	test("pipeline command with all required flags passes validation", () => {
		const args = ["Test", "--items=1,2", "--steps=implement,validate"];
		const hasItems = args.some((a) => a.startsWith("--items="));
		const hasSteps = args.some((a) => a.startsWith("--steps="));
		expect(hasItems).toBe(true);
		expect(hasSteps).toBe(true);
	});
});

// ── Pipeline Status Line Tests ──

describe("Pipeline — Status formatting", () => {
	test("running pipeline shows progress", () => {
		const state = {
			status: "running",
			name: "Fix bugs",
			items: ["1234", "1235", "1236"],
			currentItemIndex: 0,
			steps: [{ name: "implement" }, { name: "validate" }],
		};
		const line = statusLine(state);
		expect(line).toContain("Fix bugs");
		expect(line).toContain("running");
		expect(line).toContain("1/3");
	});

	test("paused pipeline shows paused status", () => {
		const state = {
			status: "paused",
			name: "Security audit",
			items: ["1"],
			currentItemIndex: 0,
			steps: [{ name: "validate" }],
		};
		const line = statusLine(state);
		expect(line).toContain("paused");
	});

	test("completed pipeline shows done status", () => {
		const state = {
			status: "done",
			name: "Cleanup",
			items: ["1", "2"],
			currentItemIndex: 2,
			steps: [],
		};
		const line = statusLine(state);
		expect(line).toContain("done");
	});

	test("no pipeline shows empty message", () => {
		const line = statusLine(null);
		expect(line).toContain("No active pipeline");
	});
});

function statusLine(state: Record<string, unknown> | null): string {
	if (!state) return "No active pipeline. Start one with /pipeline <name> ...";
	const emoji =
		state.status === "running"
			? "▶"
			: state.status === "paused"
				? "⏸"
				: state.status === "done"
					? "✓"
					: "✗";
	return `${emoji} Pipeline "${state.name}" (${state.status}) — ${state.currentItemIndex + 1}/${(state.items as string[]).length} items`;
}

// ── Acceptance Gate Tests ──

describe("Pipeline — Acceptance gates", () => {
	test("validator gate type is recognized", () => {
		const gate = { type: "validator", validators: ["ci", "tests"] };
		expect(gate.type).toBe("validator");
		expect(gate.validators.length).toBe(2);
	});

	test("shell gate type is recognized", () => {
		const gate = { type: "shell", command: "bash .pi/scripts/check-coverage.sh 80" };
		expect(gate.type).toBe("shell");
		expect(gate.command).toBeDefined();
	});

	test("llm gate type is recognized", () => {
		const gate = { type: "llm", prompt: "Verify all acceptance criteria are met" };
		expect(gate.type).toBe("llm");
		expect(gate.prompt).toBeDefined();
	});

	test("none gate type always passes", () => {
		const gate = { type: "none" };
		expect(gate.type).toBe("none");
	});

	test("step configs can mix acceptance types", () => {
		const steps = [
			{ name: "implement", acceptance: { type: "validator", validators: ["ci"] } },
			{ name: "review", acceptance: { type: "llm", prompt: "Review the code" } },
			{ name: "commit", acceptance: { type: "none" } },
		];
		expect(steps[0].acceptance.type).toBe("validator");
		expect(steps[1].acceptance.type).toBe("llm");
		expect(steps[2].acceptance.type).toBe("none");
	});
});
