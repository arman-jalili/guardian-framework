/**
 * Tests for workflow-config.ts
 *
 * Covers YAML front-matter parsing, config loading, deep merge,
 * $VAR resolution, and validation.
 */

import { describe, expect, test } from "bun:test";
import {
	extractPromptBody,
	loadWorkflowConfig,
	parseFrontMatter,
	validateWorkflowConfig,
} from "../src/lib/workflow-config.js";

// ── YAML Front-Matter Parser ──

describe("parseFrontMatter", () => {
	test("parses simple key-value pairs", () => {
		const content = `---
workspace:
  root: ".pi/workspaces"
agent:
  max_turns: 20
---
Body content here
`;
		const fm = parseFrontMatter(content);
		expect(fm).toHaveProperty("workspace");
		expect(fm).toHaveProperty("agent");
		expect((fm.workspace as Record<string, unknown>).root).toBe(".pi/workspaces");
		expect((fm.agent as Record<string, unknown>).max_turns).toBe(20);
	});

	test("parses boolean and null values", () => {
		const content = `---
active: true
debug: false
nothing: null
tilde: ~
---
body`;
		const fm = parseFrontMatter(content);
		expect(fm.active).toBe(true);
		expect(fm.debug).toBe(false);
		expect(fm.nothing).toBeNull();
		expect(fm.tilde).toBeNull();
	});

	test("parses number values", () => {
		const content = `---
timeout_ms: 60000
count: 42
negative: -10
---
body`;
		const fm = parseFrontMatter(content);
		expect(fm.timeout_ms).toBe(60000);
		expect(fm.count).toBe(42);
		expect(fm.negative).toBe(-10);
	});

	test("parses array values", () => {
		const content = `---
tools: ["pi", "claude", "agents"]
---
body`;
		const fm = parseFrontMatter(content);
		expect(fm.tools).toEqual(["pi", "claude", "agents"]);
	});

	test("parses quoted strings", () => {
		const content = `---
name: "hello world"
single: 'also quoted'
unquoted: simple
---
body`;
		const fm = parseFrontMatter(content);
		expect(fm.name).toBe("hello world");
		expect(fm.single).toBe("also quoted");
		expect(fm.unquoted).toBe("simple");
	});

	test("returns {} when no front matter", () => {
		const content = "# Just a markdown file\n\nNo front matter here.";
		expect(parseFrontMatter(content)).toEqual({});
	});

	test("returns {} when front matter is incomplete", () => {
		const content = `---
name: test
No closing delimiter`;
		expect(parseFrontMatter(content)).toEqual({});
	});

	test("skips comment lines", () => {
		const content = `---
# This is a comment
name: value
---
body`;
		const fm = parseFrontMatter(content);
		expect(fm.name).toBe("value");
	});

	test("handles nested objects", () => {
		const content = `---
workspace:
  root: ".pi/workspaces"
  hooks:
    timeout_ms: 60000
    before_run: "echo hi"
---
body`;
		const fm = parseFrontMatter(content);
		const workspace = fm.workspace as Record<string, unknown>;
		expect(workspace.root).toBe(".pi/workspaces");
		const hooks = workspace.hooks as Record<string, unknown>;
		expect(hooks.timeout_ms).toBe(60000);
		expect(hooks.before_run).toBe("echo hi");
	});
});

// ── Extract Prompt Body ──

describe("extractPromptBody", () => {
	test("returns body after front matter", () => {
		const content = `---
name: test
---
This is the body text.
`;
		expect(extractPromptBody(content)).toBe("This is the body text.");
	});

	test("returns entire content when no front matter", () => {
		const content = "Just a plain file.";
		expect(extractPromptBody(content)).toBe("Just a plain file.");
	});

	test("trims whitespace from body", () => {
		const content = `---
name: test
---

  Body with leading space  
`;
		expect(extractPromptBody(content)).toBe("Body with leading space");
	});
});

// ── Config Validation ──

describe("validateWorkflowConfig", () => {
	test("accepts valid default config", () => {
		const config = {
			workspace: { root: ".pi/workspaces", hooks: { timeout_ms: 60000 } },
			agent: { max_turns: 20, max_retry_backoff_ms: 300000, stall_timeout_ms: 300000 },
			generate: { on_conflict: "warn" as const, atomic_writes: true },
			validate: { fail_fast: false, timeout_ms: 300000 },
		};
		expect(validateWorkflowConfig(config)).toBeNull();
	});

	test("rejects max_turns < 1", () => {
		const config = {
			workspace: { root: ".pi", hooks: { timeout_ms: 60000 } },
			agent: { max_turns: 0, max_retry_backoff_ms: 300000, stall_timeout_ms: 300000 },
			generate: { on_conflict: "warn" as const, atomic_writes: true },
			validate: { fail_fast: false, timeout_ms: 300000 },
		};
		expect(validateWorkflowConfig(config)).toContain("max_turns");
	});

	test("rejects max_retry_backoff_ms < 1000", () => {
		const config = {
			workspace: { root: ".pi", hooks: { timeout_ms: 60000 } },
			agent: { max_turns: 1, max_retry_backoff_ms: 500, stall_timeout_ms: 0 },
			generate: { on_conflict: "warn" as const, atomic_writes: true },
			validate: { fail_fast: false, timeout_ms: 300000 },
		};
		expect(validateWorkflowConfig(config)).toContain("max_retry_backoff_ms");
	});

	test("rejects invalid on_conflict value", () => {
		const config = {
			workspace: { root: ".pi", hooks: { timeout_ms: 60000 } },
			agent: { max_turns: 1, max_retry_backoff_ms: 300000, stall_timeout_ms: 0 },
			generate: { on_conflict: "invalid" as unknown as "warn", atomic_writes: true },
			validate: { fail_fast: false, timeout_ms: 300000 },
		};
		expect(validateWorkflowConfig(config)).toContain("on_conflict");
	});

	test("rejects validate.timeout_ms < 1000", () => {
		const config = {
			workspace: { root: ".pi", hooks: { timeout_ms: 60000 } },
			agent: { max_turns: 1, max_retry_backoff_ms: 300000, stall_timeout_ms: 0 },
			generate: { on_conflict: "warn" as const, atomic_writes: true },
			validate: { fail_fast: false, timeout_ms: 500 },
		};
		expect(validateWorkflowConfig(config)).toContain("validate.timeout_ms");
	});

	test("rejects workspace.hooks.timeout_ms < 1000", () => {
		const config = {
			workspace: { root: ".pi", hooks: { timeout_ms: 500 } },
			agent: { max_turns: 1, max_retry_backoff_ms: 300000, stall_timeout_ms: 0 },
			generate: { on_conflict: "warn" as const, atomic_writes: true },
			validate: { fail_fast: false, timeout_ms: 300000 },
		};
		expect(validateWorkflowConfig(config)).toContain("workspace.hooks.timeout_ms");
	});
});

// ── loadWorkflowConfig ──

describe("loadWorkflowConfig", () => {
	test("returns defaults when no AGENTS.md exists", () => {
		const config = loadWorkflowConfig("/tmp/nonexistent-guardian-test");
		expect(config.workspace.root).toBe(".pi/workspaces");
		expect(config.agent.max_turns).toBe(20);
		expect(config.generate.on_conflict).toBe("warn");
		expect(config.validate.fail_fast).toBe(false);
	});
});
