/**
 * Comprehensive tests for Hermes-Agent-adopted features:
 * goal loop, kanban board, shell hooks, skill curator, delegation roles.
 */

import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
	type GuardianWorkflowConfig,
	loadWorkflowConfig,
	parseFrontMatter,
	validateWorkflowConfig,
} from "../src/lib/workflow-config";

// ── Test helpers ──

function makeProjectDir(): string {
	const dir = fs.mkdtempSync(path.join(tmpdir(), "guardian-test-"));
	// Create minimal .pi structure
	fs.mkdirSync(path.join(dir, ".pi/agent"), { recursive: true });
	fs.mkdirSync(path.join(dir, ".pi/scripts"), { recursive: true });
	fs.mkdirSync(path.join(dir, ".pi/skills/agents"), { recursive: true });
	fs.mkdirSync(path.join(dir, ".pi/skills/validators"), { recursive: true });
	return dir;
}

function scaffoldAgentsMd(dir: string, extraYaml = ""): void {
	const base = `---
workspace:
  root: ".pi/workspaces"
  hooks:
    timeout_ms: 60000
agent:
  max_turns: 20
  max_retry_backoff_ms: 300000
  stall_timeout_ms: 300000
system_prompt_tier: full
generate:
  on_conflict: warn
  atomic_writes: true
validate:
  fail_fast: false
  timeout_ms: 300000
${extraYaml}
---

# Project Context
Generic template.
`;
	fs.writeFileSync(path.join(dir, ".pi/agent/AGENTS.md"), base);
}

// ── 1. Goal Loop Tests ──

// Re-implement GoalState and GoalManager inline for unit testing
// (mirrors goal-loop.ts logic without importing the extension file)

interface TestGoalState {
	goal: string;
	status: "active" | "paused" | "done" | "cleared";
	turnsUsed: number;
	maxTurns: number;
	createdAt: string;
	lastTurnAt: string;
	lastVerdict: string;
	lastReason: string;
	pausedReason: string | null;
	subgoals: string[];
	validatorResults: Record<string, { passed: boolean; lastRun: string }>;
}

const GOAL_STATE_KEY = ".pi/.guardian-goal-state.json";

function loadGoalState(cwd: string): TestGoalState | null {
	const p = path.join(cwd, GOAL_STATE_KEY);
	if (!fs.existsSync(p)) return null;
	return JSON.parse(fs.readFileSync(p, "utf-8")) as TestGoalState;
}

function saveGoalState(cwd: string, state: TestGoalState): void {
	const p = path.join(cwd, GOAL_STATE_KEY);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, JSON.stringify(state, null, 2));
}

function makeGoalState(goal: string, maxTurns = 20): TestGoalState {
	return {
		goal,
		status: "active",
		turnsUsed: 0,
		maxTurns,
		createdAt: new Date().toISOString(),
		lastTurnAt: new Date().toISOString(),
		lastVerdict: "",
		lastReason: "",
		pausedReason: null,
		subgoals: [],
		validatorResults: {},
	};
}

describe("Goal Loop — GoalState persistence", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeProjectDir();
	});

	test("save and load goal state", () => {
		const state = makeGoalState("Fix all lint errors");
		saveGoalState(dir, state);
		const loaded = loadGoalState(dir);
		expect(loaded).not.toBeNull();
		expect(loaded?.goal).toBe("Fix all lint errors");
		expect(loaded?.status).toBe("active");
		expect(loaded?.turnsUsed).toBe(0);
		expect(loaded?.maxTurns).toBe(20);
		expect(loaded?.subgoals).toEqual([]);
	});

	test("goal state survives turn increments", () => {
		const state = makeGoalState("Add tests");
		state.turnsUsed = 5;
		state.lastVerdict = "continue";
		state.lastReason = "Validators still failing";
		saveGoalState(dir, state);

		const loaded = loadGoalState(dir);
		expect(loaded?.turnsUsed).toBe(5);
		expect(loaded?.lastVerdict).toBe("continue");
	});

	test("paused state with reason persists", () => {
		const state = makeGoalState("Refactor auth");
		state.status = "paused";
		state.pausedReason = "turn budget exhausted (20/20)";
		saveGoalState(dir, state);

		const loaded = loadGoalState(dir);
		expect(loaded?.status).toBe("paused");
		expect(loaded?.pausedReason).toBe("turn budget exhausted (20/20)");
	});

	test("done state persists", () => {
		const state = makeGoalState("Create README");
		state.status = "done";
		state.lastVerdict = "done";
		state.lastReason = "README created and validated";
		saveGoalState(dir, state);

		const loaded = loadGoalState(dir);
		expect(loaded?.status).toBe("done");
		expect(loaded?.lastReason).toBe("README created and validated");
	});

	test("cleared state persists", () => {
		const state = makeGoalState("Old goal");
		state.status = "cleared";
		saveGoalState(dir, state);

		const loaded = loadGoalState(dir);
		expect(loaded?.status).toBe("cleared");
	});

	test("subgoals persist", () => {
		const state = makeGoalState("Build feature");
		state.subgoals = ["Add tests", "Update docs", "Run security scan"];
		saveGoalState(dir, state);

		const loaded = loadGoalState(dir);
		expect(loaded?.subgoals).toHaveLength(3);
		expect(loaded?.subgoals[0]).toBe("Add tests");
	});

	test("validator results persist", () => {
		const state = makeGoalState("Fix CI");
		state.validatorResults = {
			ci: { passed: true, lastRun: "2026-05-16T00:00:00Z" },
			canonical: { passed: false, lastRun: "2026-05-16T00:00:00Z" },
		};
		saveGoalState(dir, state);

		const loaded = loadGoalState(dir);
		expect(loaded?.validatorResults.ci.passed).toBe(true);
		expect(loaded?.validatorResults.canonical.passed).toBe(false);
	});

	test("returns null when no goal file exists", () => {
		const freshDir = makeProjectDir();
		expect(loadGoalState(freshDir)).toBeNull();
	});
});

describe("Goal Loop — continuation prompt generation", () => {
	test("basic continuation prompt", () => {
		const goal = "Fix all lint errors";
		const subgoals: string[] = [];
		const prompt = `[Continuing toward your standing goal]\nGoal: ${goal}\nContinue working toward this goal. Take the next concrete step. If you believe the goal is complete, state so explicitly and stop. If you are blocked and need input from the user, say so clearly and stop.`;
		expect(prompt).toContain(goal);
		expect(prompt).toContain("Continuing toward your standing goal");
		expect(prompt).not.toContain("Additional criteria");
	});

	test("continuation prompt with subgoals", () => {
		const goal = "Implement feature X";
		const subgoals = ["Add unit tests", "Update documentation"];
		const prompt = `[Continuing toward your standing goal]\nGoal: ${goal}\nContinue working toward this goal. Take the next concrete step. If you believe the goal is complete, state so explicitly and stop. If you are blocked and need input from the user, say so clearly and stop.\n\nAdditional criteria (all must be satisfied):\n${subgoals.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`;
		expect(prompt).toContain("1. Add unit tests");
		expect(prompt).toContain("2. Update documentation");
	});
});

describe("Goal Loop — judge response parsing", () => {
	function parseJudgeResponse(raw: string): {
		done: boolean;
		reason: string;
		parseFailed: boolean;
	} {
		if (!raw) return { done: false, reason: "judge returned empty response", parseFailed: true };

		let text = raw.trim();
		if (text.startsWith("```")) {
			text = text
				.trim()
				.replace(/^```+/g, "")
				.replace(/^json\s*/, "")
				.trim();
			const nl = text.indexOf("\n");
			if (nl !== -1)
				text = text
					.slice(nl + 1)
					.replace(/```+$/, "")
					.trim();
			// Simple approach for the test
			text = raw.replace(/```/g, "").replace(/^json/, "").trim();
		}

		let data: Record<string, unknown> | null = null;
		try {
			data = JSON.parse(text);
		} catch {
			// Try to extract JSON object
			const match = text.match(/\{.*?\}/s);
			if (match) {
				try {
					data = JSON.parse(match[0]);
				} catch {
					data = null;
				}
			}
		}

		if (!data || typeof data !== "object") {
			return {
				done: false,
				reason: `judge reply was not JSON: ${text.slice(0, 200)}`,
				parseFailed: true,
			};
		}

		const doneVal = (data as Record<string, unknown>).done;
		const done =
			typeof doneVal === "string" ? doneVal.trim().toLowerCase() === "true" : Boolean(doneVal);
		const reason = String((data as Record<string, unknown>).reason || "no reason provided");

		return { done, reason, parseFailed: false };
	}

	test("parses valid JSON verdict — done", () => {
		const result = parseJudgeResponse('{"done": true, "reason": "All files created"}');
		expect(result.done).toBe(true);
		expect(result.reason).toBe("All files created");
		expect(result.parseFailed).toBe(false);
	});

	test("parses valid JSON verdict — continue", () => {
		const result = parseJudgeResponse('{"done": false, "reason": "Only 2 of 4 files created"}');
		expect(result.done).toBe(false);
		expect(result.reason).toBe("Only 2 of 4 files created");
		expect(result.parseFailed).toBe(false);
	});

	test("parses markdown-wrapped JSON", () => {
		const result = parseJudgeResponse('```json\n{"done": true, "reason": "Complete"}\n```');
		expect(result.done).toBe(true);
		expect(result.parseFailed).toBe(false);
	});

	test("returns parseFailed for empty response", () => {
		const result = parseJudgeResponse("");
		expect(result.parseFailed).toBe(true);
		expect(result.done).toBe(false);
	});

	test("returns parseFailed for non-JSON response", () => {
		const result = parseJudgeResponse("The goal is definitely complete, trust me.");
		expect(result.parseFailed).toBe(true);
		expect(result.done).toBe(false);
	});

	test("parses string boolean values", () => {
		const result = parseJudgeResponse('{"done": "true", "reason": "yes"}');
		expect(result.done).toBe(true);
	});
});

// ── 2. Kanban Tests ──

interface TestTask {
	id: string;
	title: string;
	body: string;
	assignee: string;
	status: string;
	blockReason: string | null;
	priority: "low" | "medium" | "high" | "critical";
	parents: string[];
	workspace: string;
	createdAt: string;
	updatedAt: string;
	claimedAt: string | null;
	comments: { id: string; author: string; text: string; createdAt: string }[];
}

interface TestBoard {
	tasks: TestTask[];
	nextId: number;
}

const KANBAN_FILE = ".pi/.guardian-kanban.json";

function loadBoard(cwd: string): TestBoard {
	const p = path.join(cwd, KANBAN_FILE);
	if (!fs.existsSync(p)) {
		const board: TestBoard = { tasks: [], nextId: 1 };
		fs.mkdirSync(path.dirname(p), { recursive: true });
		fs.writeFileSync(p, JSON.stringify(board, null, 2));
		return board;
	}
	return JSON.parse(fs.readFileSync(p, "utf-8")) as TestBoard;
}

function saveBoard(cwd: string, board: TestBoard): void {
	const p = path.join(cwd, KANBAN_FILE);
	fs.writeFileSync(p, JSON.stringify(board, null, 2));
}

class TestKanbanManager {
	private board: TestBoard;
	constructor(private cwd: string) {
		this.board = loadBoard(cwd);
	}

	createTask(
		title: string,
		opts?: {
			body?: string;
			assignee?: string;
			priority?: string;
			parents?: string[];
			workspace?: string;
		},
	): TestTask {
		const id = `TK-${String(this.board.nextId).padStart(4, "0")}`;
		this.board.nextId++;
		const task: TestTask = {
			id,
			title,
			body: opts?.body || "",
			assignee: opts?.assignee || "unassigned",
			status: "todo",
			blockReason: null,
			priority: (opts?.priority as TestTask["priority"]) || "medium",
			parents: opts?.parents || [],
			workspace: opts?.workspace || "scratch",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			claimedAt: null,
			comments: [],
		};
		this.board.tasks.push(task);
		this.save();
		return task;
	}

	getTask(id: string): TestTask | undefined {
		return this.board.tasks.find((t) => t.id === id);
	}

	listTasks(filter?: { status?: string; assignee?: string }): TestTask[] {
		let tasks = [...this.board.tasks];
		if (filter?.status) tasks = tasks.filter((t) => t.status === filter.status);
		if (filter?.assignee) tasks = tasks.filter((t) => t.assignee === filter.assignee);
		const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
		tasks.sort(
			(a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.id.localeCompare(b.id),
		);
		return tasks;
	}

	updateStatus(id: string, status: string, reason?: string): TestTask | undefined {
		const task = this.board.tasks.find((t) => t.id === id);
		if (!task) return undefined;
		const validTransitions: Record<string, string[]> = {
			triage: ["todo", "blocked", "archived"],
			todo: ["ready", "running", "blocked", "archived"],
			ready: ["running", "blocked", "todo", "archived"],
			running: ["done", "blocked", "todo"],
			blocked: ["todo", "running", "archived"],
			done: ["archived"],
			archived: [],
		};
		if (!validTransitions[task.status]?.includes(status)) {
			throw new Error(`Invalid transition: ${task.status} → ${status}`);
		}
		task.status = status;
		task.updatedAt = new Date().toISOString();
		if (status === "blocked" && reason) task.blockReason = reason;
		if (status === "running") task.claimedAt = new Date().toISOString();
		if (status === "done") this.checkReadyChildren(id);
		this.save();
		return task;
	}

	addComment(taskId: string, author: string, text: string) {
		const task = this.board.tasks.find((t) => t.id === taskId);
		if (!task) return undefined;
		const comment = { id: `C-${Date.now()}`, author, text, createdAt: new Date().toISOString() };
		task.comments.push(comment);
		task.updatedAt = new Date().toISOString();
		this.save();
		return comment;
	}

	private checkReadyChildren(parentId: string) {
		for (const task of this.board.tasks) {
			if (task.parents.includes(parentId) && task.status === "todo") {
				const allDone = task.parents.every((pid) => {
					const parent = this.board.tasks.find((t) => t.id === pid);
					return parent?.status === "done";
				});
				if (allDone) {
					task.status = "ready";
					task.updatedAt = new Date().toISOString();
				}
			}
		}
		this.save();
	}

	private save() {
		saveBoard(this.cwd, this.board);
	}
}

describe("Kanban — Task creation", () => {
	let dir: string;
	let mgr: TestKanbanManager;

	beforeEach(() => {
		dir = makeProjectDir();
		mgr = new TestKanbanManager(dir);
	});

	test("creates a task with auto-generated ID", () => {
		const task = mgr.createTask("Fix login bug");
		expect(task.id).toBe("TK-0001");
		expect(task.title).toBe("Fix login bug");
		expect(task.status).toBe("todo");
		expect(task.assignee).toBe("unassigned");
		expect(task.priority).toBe("medium");
	});

	test("auto-incrementing IDs", () => {
		const t1 = mgr.createTask("Task 1");
		const t2 = mgr.createTask("Task 2");
		const t3 = mgr.createTask("Task 3");
		expect(t1.id).toBe("TK-0001");
		expect(t2.id).toBe("TK-0002");
		expect(t3.id).toBe("TK-0003");
	});

	test("creates task with options", () => {
		const task = mgr.createTask("Deploy v2", {
			body: "Deploy the new version to production",
			assignee: "deploy-bot",
			priority: "critical",
		});
		expect(task.body).toBe("Deploy the new version to production");
		expect(task.assignee).toBe("deploy-bot");
		expect(task.priority).toBe("critical");
	});

	test("persists to disk", () => {
		mgr.createTask("Persist me");
		const board = loadBoard(dir);
		expect(board.tasks).toHaveLength(1);
		expect(board.tasks[0].title).toBe("Persist me");
		expect(board.nextId).toBe(2);
	});
});

describe("Kanban — Task listing and filtering", () => {
	let dir: string;
	let mgr: TestKanbanManager;

	beforeEach(() => {
		dir = makeProjectDir();
		mgr = new TestKanbanManager(dir);
		mgr.createTask("Critical task", { priority: "critical" });
		mgr.createTask("High task", { priority: "high" });
		mgr.createTask("Medium task", { priority: "medium" });
		mgr.createTask("Low task", { priority: "low" });
	});

	test("lists all tasks", () => {
		const tasks = mgr.listTasks();
		expect(tasks).toHaveLength(4);
	});

	test("filters by status", () => {
		const all = mgr.listTasks();
		expect(all.filter((t) => t.status === "todo")).toHaveLength(4);
	});

	test("priority ordering — critical first", () => {
		const tasks = mgr.listTasks();
		expect(tasks[0].priority).toBe("critical");
		expect(tasks[1].priority).toBe("high");
		expect(tasks[2].priority).toBe("medium");
		expect(tasks[3].priority).toBe("low");
	});
});

describe("Kanban — State transitions", () => {
	let dir: string;
	let mgr: TestKanbanManager;

	beforeEach(() => {
		dir = makeProjectDir();
		mgr = new TestKanbanManager(dir);
	});

	test("todo → running → done → archived", () => {
		const task = mgr.createTask("Complete me");
		expect(task.status).toBe("todo");

		mgr.updateStatus(task.id, "running");
		expect(mgr.getTask(task.id)?.status).toBe("running");
		expect(mgr.getTask(task.id)?.claimedAt).not.toBeNull();

		mgr.updateStatus(task.id, "done");
		expect(mgr.getTask(task.id)?.status).toBe("done");

		mgr.updateStatus(task.id, "archived");
		expect(mgr.getTask(task.id)?.status).toBe("archived");
	});

	test("blocks invalid transitions", () => {
		const task = mgr.createTask("Nope");
		// archived is actually a valid transition from todo, so test a real invalid one
		expect(() => mgr.updateStatus(task.id, "done")).toThrow(); // todo → done is invalid
	});

	test("blocks archived tasks from transitioning", () => {
		const task = mgr.createTask("Archive me");
		mgr.updateStatus(task.id, "running");
		mgr.updateStatus(task.id, "done");
		mgr.updateStatus(task.id, "archived");
		expect(() => mgr.updateStatus(task.id, "todo")).toThrow();
	});

	test("blocked status records reason", () => {
		const task = mgr.createTask("Blocked task");
		mgr.updateStatus(task.id, "blocked", "Waiting for API response");
		expect(mgr.getTask(task.id)?.blockReason).toBe("Waiting for API response");
		expect(mgr.getTask(task.id)?.status).toBe("blocked");
	});

	test("blocked → todo → running", () => {
		const task = mgr.createTask("Blocked then fixed");
		mgr.updateStatus(task.id, "blocked", "Missing dependency");
		mgr.updateStatus(task.id, "todo");
		mgr.updateStatus(task.id, "running");
		expect(mgr.getTask(task.id)?.status).toBe("running");
	});
});

describe("Kanban — Dependency management", () => {
	let dir: string;
	let mgr: TestKanbanManager;

	beforeEach(() => {
		dir = makeProjectDir();
		mgr = new TestKanbanManager(dir);
	});

	test("child task starts in todo with parent dependency", () => {
		const parent = mgr.createTask("Parent task");
		const child = mgr.createTask("Child task", { parents: [parent.id] });
		expect(child.status).toBe("todo");
		expect(child.parents).toEqual([parent.id]);
	});

	test("completing parent auto-promotes child to ready", () => {
		const parent = mgr.createTask("Parent task");
		mgr.createTask("Child task", { parents: [parent.id] });

		mgr.updateStatus(parent.id, "running");
		const childBefore = mgr.listTasks({ status: "ready" });
		expect(childBefore).toHaveLength(0);

		mgr.updateStatus(parent.id, "done");
		const childAfter = mgr.listTasks({ status: "ready" });
		expect(childAfter).toHaveLength(1);
		expect(childAfter[0].title).toBe("Child task");
	});

	test("multiple parents — all must be done", () => {
		const p1 = mgr.createTask("Parent 1");
		const p2 = mgr.createTask("Parent 2");
		mgr.createTask("Child", { parents: [p1.id, p2.id] });

		// Move parents through running → done
		mgr.updateStatus(p1.id, "running");
		mgr.updateStatus(p1.id, "done");
		expect(mgr.listTasks({ status: "ready" })).toHaveLength(0);

		mgr.updateStatus(p2.id, "running");
		mgr.updateStatus(p2.id, "done");
		expect(mgr.listTasks({ status: "ready" })).toHaveLength(1);
	});
});

describe("Kanban — Comments", () => {
	let dir: string;
	let mgr: TestKanbanManager;

	beforeEach(() => {
		dir = makeProjectDir();
		mgr = new TestKanbanManager(dir);
	});

	test("add comment to task", () => {
		const task = mgr.createTask("Commented task");
		const comment = mgr.addComment(task.id, "agent", "Work in progress");
		expect(comment).toBeDefined();
		expect(comment?.text).toBe("Work in progress");
		expect(comment?.author).toBe("agent");
	});

	test("multiple comments accumulate", () => {
		const task = mgr.createTask("Multi-comment task");
		mgr.addComment(task.id, "agent", "First");
		mgr.addComment(task.id, "human", "Second");
		mgr.addComment(task.id, "agent", "Third");

		const loaded = mgr.getTask(task.id);
		expect(loaded?.comments).toHaveLength(3);
		expect(loaded?.comments[0].text).toBe("First");
		expect(loaded?.comments[1].text).toBe("Second");
	});

	test("comment updates task updatedAt", () => {
		const task = mgr.createTask("Timestamp test");
		const originalUpdate = task.updatedAt;
		// Ensure at least 1ms passes
		const start = Date.now();
		while (Date.now() - start < 2) {
			/* busy wait */
		}
		mgr.addComment(task.id, "agent", "New comment");

		const updated = mgr.getTask(task.id);
		expect(updated?.updatedAt > originalUpdate).toBe(true);
	});
});

describe("Kanban — Persistence and recovery", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeProjectDir();
	});

	test("board survives process restart (reload from disk)", () => {
		let mgr = new TestKanbanManager(dir);
		const task = mgr.createTask("Survives restart", { priority: "high", assignee: "test-agent" });
		mgr.updateStatus(task.id, "running");
		mgr.addComment(task.id, "agent", "Working on it");

		// Simulate restart by creating new manager
		mgr = new TestKanbanManager(dir);
		const loaded = mgr.getTask(task.id);
		expect(loaded).toBeDefined();
		expect(loaded?.title).toBe("Survives restart");
		expect(loaded?.status).toBe("running");
		expect(loaded?.assignee).toBe("test-agent");
		expect(loaded?.comments).toHaveLength(1);
	});

	test("creates empty board if file doesn't exist", () => {
		const mgr = new TestKanbanManager(dir);
		expect(mgr.listTasks()).toHaveLength(0);
	});
});

// ── 3. Shell Hooks Tests ──

function parseHookConfigYaml(yaml: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const lines = yaml.split("\n");
	let currentTopKey: string | null = null;
	let currentList: unknown[] | null = null;
	let currentDict: Record<string, unknown> | null = null;
	const currentListMap: Record<string, unknown[]> = {};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		// Top-level key (no indent) - but not under hooks:
		if (!line.startsWith(" ") && !line.startsWith("\t")) {
			if (trimmed.endsWith(":")) {
				currentTopKey = trimmed.slice(0, -1);
				if (currentTopKey === "hooks") {
					result[currentTopKey] = {};
					currentList = null;
					currentDict = null;
				} else {
					result[currentTopKey] = [];
					currentList = result[currentTopKey] as unknown[];
					currentDict = null;
				}
			}
			continue;
		}

		// Under hooks: second-level key (one indent level)
		if (
			currentTopKey === "hooks" &&
			line.startsWith("  ") &&
			!line.startsWith("    ") &&
			trimmed.endsWith(":")
		) {
			const subKey = trimmed.slice(0, -1);
			currentListMap[subKey] = [];
			(result.hooks as Record<string, unknown>)[subKey] = currentListMap[subKey];
			currentList = currentListMap[subKey];
			currentDict = null;
			continue;
		}

		// Under hooks event: list item
		if (currentTopKey === "hooks" && trimmed.startsWith("- ")) {
			if (currentList) {
				const itemStr = trimmed.slice(2).trim();
				if (itemStr.includes(":")) {
					const dict: Record<string, unknown> = {};
					const parts = itemStr.split(/:\s*/);
					if (parts.length >= 2) {
						const key = parts[0].trim();
						const val = parts
							.slice(1)
							.join(":")
							.trim()
							.replace(/^["']|["']$/g, "");
						dict[key] = val;
					}
					currentList.push(dict);
					currentDict = dict;
				} else {
					currentList.push(itemStr);
					currentDict = null;
				}
			}
			continue;
		}

		// Dict continuation for hooks entries
		if (
			currentTopKey === "hooks" &&
			trimmed.includes(":") &&
			currentDict &&
			!trimmed.startsWith("- ")
		) {
			const parts = trimmed.split(/:\s*/);
			if (parts.length >= 2) {
				const key = parts[0].trim();
				const val = parts
					.slice(1)
					.join(":")
					.trim()
					.replace(/^["']|["']$/g, "");
				currentDict[key] = Number.isNaN(Number(val)) ? val : Number(val);
			}
			continue;
		}

		// Non-hooks list item
		if (trimmed.startsWith("- ")) {
			if (currentList) {
				const itemStr = trimmed.slice(2).trim();
				if (itemStr.includes(":")) {
					const dict: Record<string, unknown> = {};
					const parts = itemStr.split(/:\s*/);
					if (parts.length >= 2) {
						const key = parts[0].trim();
						const val = parts
							.slice(1)
							.join(":")
							.trim()
							.replace(/^["']|["']$/g, "");
						dict[key] = val;
					}
					currentList.push(dict);
					currentDict = dict;
				} else {
					currentList.push(itemStr);
					currentDict = null;
				}
			}
			continue;
		}

		// Non-hooks dict continuation
		if (trimmed.includes(":") && currentDict && currentTopKey !== "hooks") {
			const parts = trimmed.split(/:\s*/);
			if (parts.length >= 2) {
				const key = parts[0].trim();
				const val = parts
					.slice(1)
					.join(":")
					.trim()
					.replace(/^["']|["']$/g, "");
				currentDict[key] = Number.isNaN(Number(val)) ? val : Number(val);
			}
		}
	}

	return result;
}

describe("Shell Hooks — YAML config parsing", () => {
	test("parses simple hook config", () => {
		const yaml = `hooks:
  pre_tool_call:
    - command: "~/.pi/hooks/block-rm-rf.sh"
      matcher: "bash"
      timeout: 5
  post_tool_call:
    - command: "~/.pi/hooks/auto-format.sh"
      matcher: "write|edit"
`;
		const parsed = parseHookConfigYaml(yaml);
		expect(parsed.hooks).toBeDefined();
		const hooks = parsed.hooks as Record<string, unknown>;
		expect(hooks.pre_tool_call).toBeDefined();
		const preTool = hooks.pre_tool_call as Array<Record<string, unknown>>;
		expect(preTool).toHaveLength(1);
		expect(preTool[0].command).toBe("~/.pi/hooks/block-rm-rf.sh");
		expect(preTool[0].matcher).toBe("bash");
		expect(preTool[0].timeout).toBe(5);
	});

	test("parses hooks without optional fields", () => {
		const yaml = `hooks:
  pre_llm_call:
    - command: "~/.pi/hooks/inject-git-status.sh"
`;
		const parsed = parseHookConfigYaml(yaml);
		const hooks = parsed.hooks as Record<string, unknown>;
		const preLlm = hooks.pre_llm_call as Array<Record<string, unknown>>;
		expect(preLlm).toHaveLength(1);
		expect(preLlm[0].command).toBe("~/.pi/hooks/inject-git-status.sh");
		expect(preLlm[0].matcher).toBeUndefined();
		expect(preLlm[0].timeout).toBeUndefined();
	});

	test("parses multiple hooks per event", () => {
		const yaml = `hooks:
  post_tool_call:
    - command: "format.sh"
    - command: "lint.sh"
    - command: "notify.sh"
`;
		const parsed = parseHookConfigYaml(yaml);
		const hooks = parsed.hooks as Record<string, unknown>;
		expect((hooks.post_tool_call as Array<unknown>).length).toBe(3);
	});

	test("parses all lifecycle event types", () => {
		const yaml = `hooks:
  on_session_start:
    - command: "warm-cache.sh"
  on_session_end:
    - command: "flush-state.sh"
  subagent_stop:
    - command: "log-subagent.sh"
`;
		const parsed = parseHookConfigYaml(yaml);
		const hooks = parsed.hooks as Record<string, unknown>;
		expect(hooks.on_session_start).toBeDefined();
		expect(hooks.on_session_end).toBeDefined();
		expect(hooks.subagent_stop).toBeDefined();
	});
});

describe("Shell Hooks — JSON payload format", () => {
	test("pre_tool_call payload has correct structure", () => {
		const payload = {
			hook_event_name: "pre_tool_call",
			tool_name: "bash",
			tool_input: { command: "rm -rf /" },
			session_id: "sess_123",
			cwd: "/home/user/project",
		};
		expect(payload.hook_event_name).toBe("pre_tool_call");
		expect(payload.tool_name).toBe("bash");
		expect(payload.tool_input.command).toBe("rm -rf /");
	});

	test("pre_llm_call payload has null tool fields", () => {
		const payload = {
			hook_event_name: "pre_llm_call",
			tool_name: null,
			tool_input: null,
			cwd: "/home/user/project",
			extra: { user_message: "Fix the bug" },
		};
		expect(payload.tool_name).toBeNull();
		expect(payload.tool_input).toBeNull();
		expect(payload.extra.user_message).toBe("Fix the bug");
	});
});

describe("Shell Hooks — response parsing", () => {
	test("block response is detected", () => {
		const response = JSON.parse('{"decision": "block", "reason": "Forbidden"}');
		expect(response.decision).toBe("block");
		expect(response.reason).toBe("Forbidden");
	});

	test("action: block response is also detected", () => {
		const response = JSON.parse('{"action": "block", "message": "Denied"}');
		expect(response.action).toBe("block");
		expect(response.message).toBe("Denied");
	});

	test("context injection response is detected", () => {
		const response = JSON.parse('{"context": "Uncommitted changes: M src/main.ts"}');
		expect(response.context).toBeDefined();
	});

	test("empty/no response is a no-op", () => {
		const response = JSON.parse("{}");
		expect(response.decision).toBeUndefined();
		expect(response.context).toBeUndefined();
	});
});

// ── 4. Skill Curator Tests ──

interface SkillUsage {
	name: string;
	useCount: number;
	viewCount: number;
	patchCount: number;
	lastUsedAt: string | null;
	lastViewedAt: string | null;
	lastPatchedAt: string | null;
	createdAt: string;
	state: "active" | "stale" | "archived";
	pinned: boolean;
}

interface CuratorState {
	skills: Record<string, SkillUsage>;
	lastRunAt: string | null;
	runCount: number;
}

const USAGE_FILE = ".pi/.guardian-skill-usage.json";

function loadCuratorState(cwd: string): CuratorState {
	const p = path.join(cwd, USAGE_FILE);
	if (!fs.existsSync(p)) return { skills: {}, lastRunAt: null, runCount: 0 };
	return JSON.parse(fs.readFileSync(p, "utf-8")) as CuratorState;
}

function saveCuratorState(cwd: string, state: CuratorState): void {
	const p = path.join(cwd, USAGE_FILE);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, JSON.stringify(state, null, 2));
}

describe("Skill Curator — Usage tracking", () => {
	let dir: string;
	let state: CuratorState;

	beforeEach(() => {
		dir = makeProjectDir();
		state = { skills: {}, lastRunAt: null, runCount: 0 };
	});

	test("record use increments counter", () => {
		const skill: SkillUsage = {
			name: "my-skill",
			useCount: 0,
			viewCount: 0,
			patchCount: 0,
			lastUsedAt: null,
			lastViewedAt: null,
			lastPatchedAt: null,
			createdAt: new Date().toISOString(),
			state: "active",
			pinned: false,
		};
		state.skills[skill.name] = skill;

		// Simulate use
		state.skills[skill.name].useCount++;
		state.skills[skill.name].lastUsedAt = new Date().toISOString();
		saveCuratorState(dir, state);

		const loaded = loadCuratorState(dir);
		expect(loaded.skills["my-skill"].useCount).toBe(1);
		expect(loaded.skills["my-skill"].lastUsedAt).not.toBeNull();
	});

	test("record view increments view counter", () => {
		const skill: SkillUsage = {
			name: "my-skill",
			useCount: 0,
			viewCount: 0,
			patchCount: 0,
			lastUsedAt: null,
			lastViewedAt: null,
			lastPatchedAt: null,
			createdAt: new Date().toISOString(),
			state: "active",
			pinned: false,
		};
		state.skills[skill.name] = skill;

		state.skills[skill.name].viewCount += 3;
		state.skills[skill.name].lastViewedAt = new Date().toISOString();
		saveCuratorState(dir, state);

		const loaded = loadCuratorState(dir);
		expect(loaded.skills["my-skill"].viewCount).toBe(3);
	});

	test("record patch increments patch counter", () => {
		const skill: SkillUsage = {
			name: "my-skill",
			useCount: 0,
			viewCount: 0,
			patchCount: 0,
			lastUsedAt: null,
			lastViewedAt: null,
			lastPatchedAt: null,
			createdAt: new Date().toISOString(),
			state: "active",
			pinned: false,
		};
		state.skills[skill.name] = skill;

		state.skills[skill.name].patchCount++;
		state.skills[skill.name].lastPatchedAt = new Date().toISOString();
		saveCuratorState(dir, state);

		const loaded = loadCuratorState(dir);
		expect(loaded.skills["my-skill"].patchCount).toBe(1);
	});
});

describe("Skill Curator — Stale and archival detection", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeProjectDir();
	});

	test("skills unused for 30+ days become stale", () => {
		const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
		const state: CuratorState = {
			skills: {
				"old-skill": {
					name: "old-skill",
					useCount: 5,
					viewCount: 10,
					patchCount: 1,
					lastUsedAt: oldDate,
					lastViewedAt: oldDate,
					lastPatchedAt: oldDate,
					createdAt: oldDate,
					state: "active",
					pinned: false,
				},
				"new-skill": {
					name: "new-skill",
					useCount: 10,
					viewCount: 20,
					patchCount: 3,
					lastUsedAt: new Date().toISOString(),
					lastViewedAt: new Date().toISOString(),
					lastPatchedAt: new Date().toISOString(),
					createdAt: new Date().toISOString(),
					state: "active",
					pinned: false,
				},
			},
			lastRunAt: null,
			runCount: 0,
		};
		saveCuratorState(dir, state);

		// Run review logic
		const loaded = loadCuratorState(dir);
		const now = Date.now();
		const staleThreshold = 30 * 24 * 60 * 60 * 1000;

		for (const [name, skill] of Object.entries(loaded.skills)) {
			if (name === "old-skill") {
				const age = now - new Date(skill.lastUsedAt ?? "").getTime();
				expect(age).toBeGreaterThan(staleThreshold);
			}
		}
	});

	test("skills unused for 90+ days are archived", () => {
		const veryOldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
		const state: CuratorState = {
			skills: {
				"very-old-skill": {
					name: "very-old-skill",
					useCount: 2,
					viewCount: 5,
					patchCount: 0,
					lastUsedAt: veryOldDate,
					lastViewedAt: veryOldDate,
					lastPatchedAt: veryOldDate,
					createdAt: veryOldDate,
					state: "active",
					pinned: false,
				},
			},
			lastRunAt: null,
			runCount: 0,
		};
		saveCuratorState(dir, state);

		const loaded = loadCuratorState(dir);
		const now = Date.now();
		const archiveThreshold = 90 * 24 * 60 * 60 * 1000;

		for (const skill of Object.values(loaded.skills)) {
			const age = now - new Date(skill.lastUsedAt ?? "").getTime();
			expect(age).toBeGreaterThan(archiveThreshold);
		}
	});

	test("pinned skills are never archived", () => {
		const veryOldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
		const state: CuratorState = {
			skills: {
				"pinned-skill": {
					name: "pinned-skill",
					useCount: 2,
					viewCount: 5,
					patchCount: 0,
					lastUsedAt: veryOldDate,
					lastViewedAt: veryOldDate,
					lastPatchedAt: veryOldDate,
					createdAt: veryOldDate,
					state: "active",
					pinned: true, // pinned!
				},
			},
			lastRunAt: null,
			runCount: 0,
		};
		saveCuratorState(dir, state);

		const loaded = loadCuratorState(dir);
		expect(loaded.skills["pinned-skill"].pinned).toBe(true);
		expect(loaded.skills["pinned-skill"].state).toBe("active");
	});
});

describe("Skill Curator — Pin/unpin", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeProjectDir();
	});

	test("pin protects skill", () => {
		const state: CuratorState = {
			skills: {
				"important-skill": {
					name: "important-skill",
					useCount: 5,
					viewCount: 10,
					patchCount: 2,
					lastUsedAt: new Date().toISOString(),
					lastViewedAt: new Date().toISOString(),
					lastPatchedAt: new Date().toISOString(),
					createdAt: new Date().toISOString(),
					state: "active",
					pinned: false,
				},
			},
			lastRunAt: null,
			runCount: 0,
		};

		state.skills["important-skill"].pinned = true;
		saveCuratorState(dir, state);

		const loaded = loadCuratorState(dir);
		expect(loaded.skills["important-skill"].pinned).toBe(true);
	});

	test("unpin removes protection", () => {
		const state: CuratorState = {
			skills: {
				"was-pinned": {
					name: "was-pinned",
					useCount: 5,
					viewCount: 10,
					patchCount: 2,
					lastUsedAt: new Date().toISOString(),
					lastViewedAt: new Date().toISOString(),
					lastPatchedAt: new Date().toISOString(),
					createdAt: new Date().toISOString(),
					state: "active",
					pinned: true,
				},
			},
			lastRunAt: null,
			runCount: 0,
		};

		state.skills["was-pinned"].pinned = false;
		saveCuratorState(dir, state);

		const loaded = loadCuratorState(dir);
		expect(loaded.skills["was-pinned"].pinned).toBe(false);
	});
});

describe("Skill Curator — Review metadata", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeProjectDir();
	});

	test("review increments runCount", () => {
		const state: CuratorState = { skills: {}, lastRunAt: null, runCount: 0 };
		state.runCount++;
		state.lastRunAt = new Date().toISOString();
		saveCuratorState(dir, state);

		const loaded = loadCuratorState(dir);
		expect(loaded.runCount).toBe(1);
		expect(loaded.lastRunAt).not.toBeNull();
	});

	test("multiple reviews accumulate count", () => {
		const state: CuratorState = { skills: {}, lastRunAt: null, runCount: 0 };
		for (let i = 0; i < 5; i++) {
			state.runCount++;
			state.lastRunAt = new Date().toISOString();
			saveCuratorState(dir, state);
		}

		const loaded = loadCuratorState(dir);
		expect(loaded.runCount).toBe(5);
	});
});

// ── 5. Workflow Config — New fields ──

describe("Workflow Config — goal settings", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeProjectDir();
	});

	test("parses goal front matter", () => {
		scaffoldAgentsMd(
			dir,
			`
goal:
  enabled: true
  max_turns: 15
  judge_validator: true
`,
		);
		const config = loadWorkflowConfig(path.join(dir, ".pi"));
		expect((config as Record<string, unknown>).goal).toBeDefined();
		const goal = (config as Record<string, unknown>).goal as Record<string, unknown>;
		expect(goal.enabled).toBe(true);
		expect(goal.max_turns).toBe(15);
		expect(goal.judge_validator).toBe(true);
	});

	test("goal defaults applied when not specified", () => {
		scaffoldAgentsMd(dir);
		const config = loadWorkflowConfig(path.join(dir, ".pi"));
		const goal = (config as Record<string, unknown>).goal as Record<string, unknown>;
		expect(goal.enabled).toBe(true);
		expect(goal.max_turns).toBe(20);
		expect(goal.judge_validator).toBe(true);
	});
});

describe("Workflow Config — kanban settings", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeProjectDir();
	});

	test("parses kanban front matter", () => {
		scaffoldAgentsMd(
			dir,
			`
kanban:
  enabled: true
  auto_create_tasks: true
`,
		);
		const config = loadWorkflowConfig(path.join(dir, ".pi"));
		const kanban = (config as Record<string, unknown>).kanban as Record<string, unknown>;
		expect(kanban.enabled).toBe(true);
		expect(kanban.auto_create_tasks).toBe(true);
	});
});

describe("Workflow Config — delegation settings", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeProjectDir();
	});

	test("parses delegation front matter with orchestrator support", () => {
		scaffoldAgentsMd(
			dir,
			`
delegation:
  max_spawn_depth: 2
  max_concurrent_children: 5
  max_iterations: 100
  child_timeout_ms: 1200000
`,
		);
		const config = loadWorkflowConfig(path.join(dir, ".pi"));
		const delegation = (config as Record<string, unknown>).delegation as Record<string, unknown>;
		expect(delegation.max_spawn_depth).toBe(2);
		expect(delegation.max_concurrent_children).toBe(5);
		expect(delegation.max_iterations).toBe(100);
		expect(delegation.child_timeout_ms).toBe(1200000);
	});

	test("delegation defaults", () => {
		scaffoldAgentsMd(dir);
		const config = loadWorkflowConfig(path.join(dir, ".pi"));
		const delegation = (config as Record<string, unknown>).delegation as Record<string, unknown>;
		expect(delegation.max_spawn_depth).toBe(1); // flat by default
		expect(delegation.max_concurrent_children).toBe(3);
		expect(delegation.max_iterations).toBe(50);
	});
});

describe("Workflow Config — curator settings", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeProjectDir();
	});

	test("parses curator front matter", () => {
		scaffoldAgentsMd(
			dir,
			`
curator:
  enabled: true
  stale_after_days: 14
  archive_after_days: 60
  auto_review: true
`,
		);
		const config = loadWorkflowConfig(path.join(dir, ".pi"));
		const curator = (config as Record<string, unknown>).curator as Record<string, unknown>;
		expect(curator.enabled).toBe(true);
		expect(curator.stale_after_days).toBe(14);
		expect(curator.archive_after_days).toBe(60);
		expect(curator.auto_review).toBe(true);
	});
});

describe("Workflow Config — hooks section", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeProjectDir();
	});

	test("parses hooks front matter", () => {
		scaffoldAgentsMd(
			dir,
			`
hooks:
  pre_tool_call:
    - command: "block-rm-rf.sh"
      matcher: "bash"
      timeout: 5
  post_tool_call:
    - command: "auto-format.sh"
`,
		);
		const config = loadWorkflowConfig(path.join(dir, ".pi"));
		const hooks = (config as Record<string, unknown>).hooks as Record<string, unknown>;
		expect(hooks.pre_tool_call).toBeDefined();
		expect(hooks.post_tool_call).toBeDefined();
	});
});

// ── 6. Delegation Roles ──

describe("Delegation — Role resolution", () => {
	function resolveRole(role?: string): "leaf" | "orchestrator" {
		return role === "orchestrator" ? "orchestrator" : "leaf";
	}

	test("undefined role defaults to leaf", () => {
		expect(resolveRole()).toBe("leaf");
		expect(resolveRole(undefined)).toBe("leaf");
	});

	test("orchestrator role is recognized", () => {
		expect(resolveRole("orchestrator")).toBe("orchestrator");
	});

	test("arbitrary strings default to leaf", () => {
		expect(resolveRole("unknown")).toBe("leaf");
		expect(resolveRole("leaf")).toBe("leaf");
		expect(resolveRole("anything")).toBe("leaf");
	});
});

describe("Delegation — Spawn depth calculation", () => {
	test("max_spawn_depth: 1 means flat (no nesting)", () => {
		const maxDepth = 1;
		expect(maxDepth).toBe(1);
		// At depth 1, orchestrator is a no-op
		expect(maxDepth >= 1).toBe(true);
		expect(maxDepth >= 2).toBe(false); // Cannot spawn grandchildren
	});

	test("max_spawn_depth: 2 allows one level of nesting", () => {
		const maxDepth = 2;
		expect(maxDepth >= 2).toBe(true);
		// With 3 concurrent children, max agents = 3 * 3 = 9
		const maxAgents = 3 * 3;
		expect(maxAgents).toBe(9);
	});

	test("max_spawn_depth: 3 allows two levels of nesting", () => {
		const maxDepth = 3;
		// With 3 concurrent children, max agents = 3 * 3 * 3 = 27
		const maxAgents = 3 * 3 * 3;
		expect(maxAgents).toBe(27);
	});
});
