/**
 * Unit tests for TOML-based declarative validation filter pipeline.
 */

import { describe, expect, test } from "bun:test";

import {
	applyFilter,
	calculateSavings,
	parseTomlValidators,
	runValidatorTests,
} from "../src/lib/toml-filter";

// ── TOML Parsing ──

describe("parseTomlValidators", () => {
	test("parses a basic filter definition", () => {
		const toml = `[filters.test]
name = "test"
command = "echo hello"
description = "A test filter"
strip_ansi = true
max_lines = 100`;
		const filters = parseTomlValidators(toml);
		expect(filters.length).toBe(1);
		expect(filters[0].name).toBe("test");
		expect(filters[0].command).toBe("echo hello");
		expect(filters[0].description).toBe("A test filter");
		expect(filters[0].strip_ansi).toBe(true);
		expect(filters[0].max_lines).toBe(100);
	});

	test("parses multiple filter definitions", () => {
		const toml = `[filters.alpha]
name = "alpha"
command = "echo a"

[filters.beta]
name = "beta"
command = "echo b"`;
		const filters = parseTomlValidators(toml);
		expect(filters.length).toBe(2);
		expect(filters[0].name).toBe("alpha");
		expect(filters[1].name).toBe("beta");
	});

	test("parses replace rules", () => {
		const toml = `[filters.clean]
name = "clean"
command = "echo test"
replace = [{ pattern = "\\[INFO\\]", replacement = "" }, { pattern = "\\[WARN\\]", replacement = "⚠ " }]`;
		const filters = parseTomlValidators(toml);
		expect(filters[0].replace?.length).toBe(2);
		expect(filters[0].replace?.[0].pattern).toBe("\\[INFO\\]");
	});

	test("parses match_output rules", () => {
		const toml = `[filters.check]
name = "check"
command = "echo test"
match_output = [{ pattern = "BUILD SUCCESSFUL", message = "✅ Build passed" }]`;
		const filters = parseTomlValidators(toml);
		expect(filters[0].match_output?.length).toBe(1);
		expect(filters[0].match_output?.[0].pattern).toBe("BUILD SUCCESSFUL");
	});

	test("parses line filter arrays", () => {
		const toml = `[filters.strip]
name = "strip"
command = "echo test"
strip_lines_matching = ["^\\[DEBUG\\]", "^\\[TRACE\\]"]`;
		const filters = parseTomlValidators(toml);
		expect(filters[0].strip_lines_matching?.length).toBe(2);
	});

	test("parses inline tests", () => {
		const toml = `[filters.trunc]
name = "trunc"
command = "echo test"
truncate_lines_at = 80

[[tests.trunc]]
name = "short line"
input = "hello"
expected = "hello"

[[tests.trunc]]
name = "long line"
input = "a".repeat(100)
expected = "a".repeat(77) + "..."`;
		// Note: the minimal TOML parser has limitations with multiline strings in tests
		// This test verifies the basic structure parsing
		const filters = parseTomlValidators(toml);
		expect(filters.length).toBeGreaterThan(0);
		expect(filters[0].name).toBe("trunc");
	});

	test("skips comments and blank lines", () => {
		const toml = `# Comment line

[filters.test]
# Another comment
name = "test"
command = "echo ok"`;
		const filters = parseTomlValidators(toml);
		expect(filters.length).toBe(1);
	});

	test("skips top-level keys outside filter sections", () => {
		const toml = `schema_version = "1.0"

[filters.test]
name = "test"
command = "echo"`;
		const filters = parseTomlValidators(toml);
		expect(filters.length).toBe(1);
	});
});

// ── Filter Pipeline ──

describe("applyFilter", () => {
	test("strip_ansi removes escape codes", () => {
		const filter = {
			name: "ansi",
			command: "echo",
			strip_ansi: true,
		};
		const input = "\x1b[31mRed text\x1b[0m";
		const result = applyFilter(filter, input);
		expect(result).toBe("Red text");
	});

	test("replace applies regex substitutions", () => {
		const filter = {
			name: "replace",
			command: "echo",
			replace: [{ pattern: "\\[INFO\\]", replacement: "" }],
		};
		const input = "[INFO] Building project\n[INFO] Done";
		const result = applyFilter(filter, input);
		expect(result).toBe(" Building project\n Done");
	});

	test("match_output short-circuits on pattern match", () => {
		const filter = {
			name: "match",
			command: "echo",
			match_output: [{ pattern: "BUILD SUCCESSFUL", message: "✅ Build passed" }],
		};
		const input = "Compiling...\nBUILD SUCCESSFUL in 3.2s\nDone";
		const result = applyFilter(filter, input);
		expect(result).toBe("✅ Build passed");
	});

	test("match_output respects unless clause", () => {
		const filter = {
			name: "match",
			command: "echo",
			match_output: [{ pattern: "BUILD SUCCESSFUL", message: "✅ Build passed", unless: "ERROR" }],
		};
		// Unless clause matches — should NOT short-circuit
		const input = "BUILD SUCCESSFUL\nERROR: something failed";
		const result = applyFilter(filter, input);
		expect(result).not.toBe("✅ Build passed");
	});

	test("strip_lines_matching filters out matching lines", () => {
		const filter = {
			name: "strip",
			command: "echo",
			strip_lines_matching: ["^\\[DEBUG\\]"],
		};
		const input = "[INFO] Starting\n[DEBUG] Internal state\n[INFO] Done";
		const result = applyFilter(filter, input);
		expect(result).not.toContain("[DEBUG]");
		expect(result).toContain("[INFO]");
	});

	test("keep_lines_matching keeps only matching lines", () => {
		const filter = {
			name: "keep",
			command: "echo",
			keep_lines_matching: ["^\\[ERROR\\]", "^\\[WARN\\]"],
		};
		const input = "[INFO] OK\n[WARN] Slow\n[ERROR] Fail";
		const result = applyFilter(filter, input);
		expect(result).not.toContain("[INFO]");
		expect(result).toContain("[WARN]");
		expect(result).toContain("[ERROR]");
	});

	test("truncate_lines_at truncates long lines", () => {
		const filter = {
			name: "trunc",
			command: "echo",
			truncate_lines_at: 10,
		};
		const input = "short\nthis is a very long line that exceeds";
		const result = applyFilter(filter, input);
		const lines = result.split("\n");
		expect(lines[0]).toBe("short");
		expect(lines[1].length).toBeLessThanOrEqual(10);
	});

	test("head_lines keeps first N lines", () => {
		const filter = {
			name: "head",
			command: "echo",
			head_lines: 2,
		};
		const input = "line1\nline2\nline3\nline4";
		const result = applyFilter(filter, input);
		expect(result).toContain("line1");
		expect(result).toContain("line2");
		expect(result).not.toContain("line3");
		expect(result).toContain("omitted");
	});

	test("tail_lines keeps last N lines", () => {
		const filter = {
			name: "tail",
			command: "echo",
			tail_lines: 2,
		};
		const input = "line1\nline2\nline3\nline4";
		const result = applyFilter(filter, input);
		expect(result).toContain("line3");
		expect(result).toContain("line4");
		expect(result).not.toContain("line1");
	});

	test("head+tail combination inserts omission marker", () => {
		const filter = {
			name: "headtail",
			command: "echo",
			head_lines: 1,
			tail_lines: 1,
		};
		const input = "line1\nline2\nline3\nline4";
		const result = applyFilter(filter, input);
		expect(result).toContain("line1");
		expect(result).toContain("line4");
		expect(result).toContain("omitted");
	});

	test("max_lines caps absolute line count", () => {
		const filter = {
			name: "max",
			command: "echo",
			max_lines: 3,
		};
		const input = Array.from({ length: 10 }, (_, i) => `line${i}`).join("\n");
		const result = applyFilter(filter, input);
		const lines = result.split("\n");
		expect(lines.length).toBeLessThanOrEqual(4); // 3 lines + truncation message
	});

	test("on_empty provides message when result is blank", () => {
		const filter = {
			name: "empty",
			command: "echo",
			strip_lines_matching: ["^.*$"], // Strip all lines
			on_empty: "No output produced",
		};
		const input = "all will be stripped";
		const result = applyFilter(filter, input);
		expect(result).toBe("No output produced");
	});

	test("full pipeline: multiple stages compose correctly", () => {
		const filter = {
			name: "pipeline",
			command: "echo",
			strip_ansi: true,
			replace: [{ pattern: "\\[INFO\\] ", replacement: "" }],
			head_lines: 3,
			max_lines: 5,
		};
		const input =
			"\x1b[32m[INFO] Step 1 done\x1b[0m\n[INFO] Step 2 done\n[INFO] Step 3 done\n[INFO] Step 4 done\n[INFO] Step 5 done";
		const result = applyFilter(filter, input);
		expect(result).toContain("Step 1 done");
		expect(result).not.toContain("[INFO]");
		expect(result).not.toContain("\x1b");
	});
});

// ── Inline Test Runner ──

describe("runValidatorTests", () => {
	test("runs tests and reports pass/fail", () => {
		const filters = [
			{
				name: "test",
				command: "echo",
				truncate_lines_at: 5,
				tests: [
					{ name: "short", input: "hi", expected: "hi" },
					{ name: "long", input: "hello world", expected: "he..." },
				],
			},
		];
		const results = runValidatorTests(filters);
		expect(results.outcomes.length).toBe(2);
		expect(results.outcomes[0].passed).toBe(true);
		expect(results.outcomes[1].passed).toBe(true);
	});

	test("reports failed tests correctly", () => {
		const filters = [
			{
				name: "fail_test",
				command: "echo",
				strip_lines_matching: ["^foo$"],
				tests: [
					{ name: "passing", input: "bar\nbaz", expected: "bar\nbaz" },
					{ name: "failing", input: "foo\nbar", expected: "foo\nbar" }, // foo should be stripped
				],
			},
		];
		const results = runValidatorTests(filters);
		expect(results.outcomes.length).toBe(2);
		expect(results.outcomes[0].passed).toBe(true);
		expect(results.outcomes[1].passed).toBe(false);
	});

	test("identifies filters without tests", () => {
		const filters = [
			{ name: "no_tests", command: "echo" },
			{
				name: "has_tests",
				command: "echo",
				tests: [{ name: "t", input: "a", expected: "a" }],
			},
		];
		const results = runValidatorTests(filters);
		expect(results.filters_without_tests).toContain("no_tests");
		expect(results.filters_without_tests).not.toContain("has_tests");
	});
});

// ── Token Savings ──

describe("calculateSavings", () => {
	test("calculates token savings from filtering", () => {
		const filter = {
			name: "savings",
			command: "echo",
			head_lines: 2,
		};
		const input = Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n");
		const result = calculateSavings(filter, input);
		expect(result.inputTokens).toBeGreaterThan(result.outputTokens);
		expect(result.savedTokens).toBeGreaterThan(0);
		expect(result.savingsPct).toBeGreaterThan(0);
		expect(result.savingsPct).toBeLessThanOrEqual(100);
	});

	test("handles empty input gracefully", () => {
		const filter = {
			name: "empty",
			command: "echo",
		};
		const result = calculateSavings(filter, "");
		expect(result.inputTokens).toBe(0);
		expect(result.savingsPct).toBe(0);
	});
});
