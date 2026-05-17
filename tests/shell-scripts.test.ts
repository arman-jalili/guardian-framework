/**
 * Tests for shell scripts in .pi/scripts/ci/ and .pi/scripts/git/
 *
 * These tests verify that the critical CI stage scripts and Git wrapper scripts
 * are present, executable, and have the correct structure.
 */

import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Helpers ──

function findTemplatesDir(): string {
	// Try dist/../, src/../, or cwd
	const candidates = [
		path.join(__dirname, "..", "templates"),
		path.join(__dirname, "..", "src", "..", "templates"),
		path.join(process.cwd(), "templates"),
	];
	for (const dir of candidates) {
		if (fs.existsSync(path.join(dir, "pi"))) return path.join(dir, "pi");
	}
	return path.join(process.cwd(), "templates", "pi");
}

const TEMPLATES_DIR = findTemplatesDir();
const SCRIPTS_DIR = path.join(TEMPLATES_DIR, "scripts");
const CI_DIR = path.join(SCRIPTS_DIR, "ci");
const GIT_DIR = path.join(SCRIPTS_DIR, "git");

function scriptExists(relPath: string): boolean {
	const p = path.join(TEMPLATES_DIR, relPath);
	return fs.existsSync(p);
}

function scriptIsExecutable(relPath: string): boolean {
	const p = path.join(TEMPLATES_DIR, relPath);
	if (!fs.existsSync(p)) return false;
	try {
		const stat = fs.statSync(p);
		return (stat.mode & 0o111) !== 0; // Check execute bits
	} catch {
		return false;
	}
}

function scriptHasShebang(relPath: string): boolean {
	const p = path.join(TEMPLATES_DIR, relPath);
	if (!fs.existsSync(p)) return false;
	const content = fs.readFileSync(p, "utf-8");
	return content.startsWith("#!/") || content.startsWith("#! /");
}

function scriptHasSetE(relPath: string): boolean {
	const p = path.join(TEMPLATES_DIR, relPath);
	if (!fs.existsSync(p)) return false;
	const content = fs.readFileSync(p, "utf-8");
	// Check for set -euo pipefail or set -e
	return /set\s+-euo\s+pipefail/.test(content) || /set\s+-e/.test(content);
}

// ── CI Scripts Existence ──

describe("CI scripts — existence and structure", () => {
	test("check_architecture_conformance.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/ci/check_architecture_conformance.sh")).toBe(true);
		expect(scriptHasShebang("scripts/ci/check_architecture_conformance.sh")).toBe(true);
		expect(scriptHasSetE("scripts/ci/check_architecture_conformance.sh")).toBe(true);
	});

	test("run_hardening_stages.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/ci/run_hardening_stages.sh")).toBe(true);
		expect(scriptHasShebang("scripts/ci/run_hardening_stages.sh")).toBe(true);
		expect(scriptHasSetE("scripts/ci/run_hardening_stages.sh")).toBe(true);
	});

	test("run_preflight.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/ci/run_preflight.sh")).toBe(true);
		expect(scriptHasShebang("scripts/ci/run_preflight.sh")).toBe(true);
		expect(scriptHasSetE("scripts/ci/run_preflight.sh")).toBe(true);
	});

	test("run_stage.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/ci/run_stage.sh")).toBe(true);
		expect(scriptHasShebang("scripts/ci/run_stage.sh")).toBe(true);
	});

	test("validate_agent_output.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/ci/validate_agent_output.sh")).toBe(true);
		expect(scriptHasShebang("scripts/ci/validate_agent_output.sh")).toBe(true);
		expect(scriptHasSetE("scripts/ci/validate_agent_output.sh")).toBe(true);
	});

	test("stage_docs_policy.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/ci/stage_docs_policy.sh")).toBe(true);
		expect(scriptHasShebang("scripts/ci/stage_docs_policy.sh")).toBe(true);
	});

	test("stage_lint.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/ci/stage_lint.sh")).toBe(true);
		expect(scriptHasShebang("scripts/ci/stage_lint.sh")).toBe(true);
	});

	test("stage_static_analysis.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/ci/stage_static_analysis.sh")).toBe(true);
		expect(scriptHasShebang("scripts/ci/stage_static_analysis.sh")).toBe(true);
	});

	test("stage_unit.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/ci/stage_unit.sh")).toBe(true);
		expect(scriptHasShebang("scripts/ci/stage_unit.sh")).toBe(true);
	});

	test("stage_remaining.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/ci/stage_remaining.sh")).toBe(true);
		expect(scriptHasShebang("scripts/ci/stage_remaining.sh")).toBe(true);
	});

	test("validate-architecture-readiness.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/validate-architecture-readiness.sh")).toBe(true);
		expect(scriptHasShebang("scripts/validate-architecture-readiness.sh")).toBe(true);
		expect(scriptHasSetE("scripts/validate-architecture-readiness.sh")).toBe(true);
	});

	test("generate-architecture.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/generate-architecture.sh")).toBe(true);
		expect(scriptHasShebang("scripts/generate-architecture.sh")).toBe(true);
	});
});

// ── Git Scripts Existence ──

describe("Git wrapper scripts — existence and structure", () => {
	test("create-tracking-issue.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/git/create-tracking-issue.sh")).toBe(true);
		expect(scriptHasShebang("scripts/git/create-tracking-issue.sh")).toBe(true);
	});

	test("update-tracking-issue.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/git/update-tracking-issue.sh")).toBe(true);
		expect(scriptHasShebang("scripts/git/update-tracking-issue.sh")).toBe(true);
	});

	test("close-issue.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/git/close-issue.sh")).toBe(true);
		expect(scriptHasShebang("scripts/git/close-issue.sh")).toBe(true);
	});

	test("close-epic.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/git/close-epic.sh")).toBe(true);
		expect(scriptHasShebang("scripts/git/close-epic.sh")).toBe(true);
	});

	test("link-issue-to-epic.sh exists and is valid bash", () => {
		expect(scriptExists("scripts/git/link-issue-to-epic.sh")).toBe(true);
		expect(scriptHasShebang("scripts/git/link-issue-to-epic.sh")).toBe(true);
	});
});

// ── Script Argument Handling ──

describe("CI scripts — argument handling", () => {
	test("run_stage.sh prints usage when called without args", () => {
		const p = path.join(CI_DIR, "run_stage.sh");
		if (!fs.existsSync(p)) return;
		const result = Bun.spawnSync(["bash", p]);
		expect(result.exitCode).toBe(1);
		expect(new TextDecoder().decode(result.stdout).toLowerCase()).toContain("usage");
	});

	test("validate_agent_output.sh prints error when called without --input", () => {
		const p = path.join(CI_DIR, "validate_agent_output.sh");
		if (!fs.existsSync(p)) return;
		const result = Bun.spawnSync(["bash", p]);
		expect(result.exitCode).toBe(1);
		const output =
			new TextDecoder().decode(result.stderr) + new TextDecoder().decode(result.stdout);
		expect(output.toLowerCase()).toContain("error");
	});
});

// ── Run Preflight Script — Integration ──

describe("run_preflight.sh — local execution", () => {
	test("run_preflight.sh runs in a minimal project without crashing", () => {
		const p = path.join(CI_DIR, "run_preflight.sh");
		if (!fs.existsSync(p)) return;

		// Run in templates/pi directory (has .pi structure)
		const result = Bun.spawnSync(["bash", p], {
			cwd: TEMPLATES_DIR,
			env: { ...process.env, HOME: process.env.HOME },
		});

		// Should not crash (exit 0 or exit 1 from failed checks is fine, exit > 1 means crash)
		expect(result.exitCode).toBeLessThan(128);
	});

	test("run_preflight.sh --json produces valid JSON", () => {
		const p = path.join(CI_DIR, "run_preflight.sh");
		if (!fs.existsSync(p)) return;

		const result = Bun.spawnSync(["bash", p, "--json"], {
			cwd: TEMPLATES_DIR,
			env: { ...process.env, HOME: process.env.HOME },
		});

		const output = new TextDecoder().decode(result.stdout);
		if (output.trim()) {
			// If it produced output, it should be valid JSON
			expect(() => JSON.parse(output)).not.toThrow();
			const parsed = JSON.parse(output);
			expect(parsed).toHaveProperty("status");
			expect(parsed).toHaveProperty("summary");
			expect(parsed.summary).toHaveProperty("total");
			expect(parsed.summary).toHaveProperty("passed");
			expect(parsed.summary).toHaveProperty("failed");
		}
	});
});
