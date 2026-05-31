/**
 * Unit tests for language-aware code filtering.
 */

import { describe, expect, test } from "bun:test";

import {
	detectLanguage,
	estimateFilterSavings,
	filterCode,
	smartTruncate,
} from "../src/lib/code-filter";

// ── Language Detection ──

describe("detectLanguage", () => {
	test("recognises common extensions", () => {
		expect(detectLanguage("main.rs")).toBe("rust");
		expect(detectLanguage("app.py")).toBe("python");
		expect(detectLanguage("index.ts")).toBe("typescript");
		expect(detectLanguage("index.tsx")).toBe("typescript");
		expect(detectLanguage("lib.go")).toBe("go");
		expect(detectLanguage("main.c")).toBe("c");
		expect(detectLanguage("app.cpp")).toBe("cpp");
		expect(detectLanguage("Main.java")).toBe("java");
		expect(detectLanguage("script.sh")).toBe("shell");
		expect(detectLanguage("script.bash")).toBe("shell");
		expect(detectLanguage("script.zsh")).toBe("shell");
		expect(detectLanguage("data.json")).toBe("data");
		expect(detectLanguage("config.yaml")).toBe("data");
		expect(detectLanguage("deps.lock")).toBe("data");
	});

	test("returns unknown for unrecognised extension", () => {
		expect(detectLanguage("file.xyz")).toBe("unknown");
		expect(detectLanguage("README")).toBe("unknown");
	});

	test("handles extension case-insensitively", () => {
		expect(detectLanguage("Main.RS")).toBe("rust");
		expect(detectLanguage("app.PY")).toBe("python");
	});
});

// ── Minimal Filter ──

describe("minimalFilter (via filterCode)", () => {
	test("strips single-line comments in TypeScript", () => {
		const input = `import { foo } from "bar";
// This is a comment
export function hello() {
	return "world";
}`;
		const filtered = filterCode(input, "typescript", "minimal");
		expect(filtered).toContain('import { foo } from "bar"');
		expect(filtered).not.toContain("// This is a comment");
		expect(filtered).toContain("export function hello()");
	});

	test("strips block comments in TypeScript", () => {
		const input = `/* header comment */
function foo() {}`;
		const filtered = filterCode(input, "typescript", "minimal");
		expect(filtered).not.toContain("header comment");
		expect(filtered).toContain("function foo()");
	});

	test("preserves Python docstrings", () => {
		const input = `"""Module docstring."""
def hello():
    """Function docstring."""
    pass`;
		const filtered = filterCode(input, "python", "minimal");
		expect(filtered).toContain("Module docstring");
		expect(filtered).toContain("Function docstring");
		expect(filtered).toContain("def hello()");
	});

	test("strips shell comments", () => {
		const input = `#!/bin/bash
# This is a comment
echo "hello"`;
		const filtered = filterCode(input, "shell", "minimal");
		expect(filtered).not.toContain("# This is a comment");
		expect(filtered).toContain("echo");
	});

	test("returns content unchanged at none level", () => {
		const input = `// comment
fn main() {}`;
		expect(filterCode(input, "rust", "none")).toBe(input);
	});

	test("normalises multiple blank lines", () => {
		const input = "fn a() {}\n\n\n\nfn b() {}";
		const filtered = filterCode(input, "rust", "minimal");
		expect(filtered).not.toMatch(/\n{3,}/);
	});
});

// ── Aggressive Filter ──

describe("aggressiveFilter (via filterCode)", () => {
	test("keeps imports and signatures, replaces bodies in TypeScript", () => {
		const input = `import { foo } from "bar";

export function hello(): string {
	return "world";
}

const X = 42;`;
		const filtered = filterCode(input, "typescript", "aggressive");
		expect(filtered).toContain('import { foo } from "bar"');
		expect(filtered).toContain("export function hello()");
		expect(filtered).toContain("const X = 42");
		expect(filtered).not.toContain('"world"');
	});

	test("keeps Rust function signatures and replaces bodies", () => {
		const input = `pub fn add(a: i32, b: i32) -> i32 {
    a + b
}`;
		const filtered = filterCode(input, "rust", "aggressive");
		expect(filtered).toContain("pub fn add(a: i32, b: i32) -> i32");
		expect(filtered).not.toContain("a + b");
	});

	test("keeps Python function signatures", () => {
		const input = `def hello(name: str) -> str:
    return f"Hello, {name}"`;
		const filtered = filterCode(input, "python", "aggressive");
		expect(filtered).toContain("def hello(name: str) -> str");
	});

	test("keeps Go function signatures", () => {
		const input = `func Add(a int, b int) int {
	return a + b
}`;
		const filtered = filterCode(input, "go", "aggressive");
		expect(filtered).toContain("func Add(a int, b int) int");
	});

	test("data formats are never aggressively filtered", () => {
		const input = `{
  "key": "value",
  "number": 42
}`;
		const filtered = filterCode(input, "data", "aggressive");
		expect(filtered).toContain("key");
		expect(filtered).toContain("value");
	});

	test("keeps Rust struct/enum/trait signatures", () => {
		const input = `pub struct User {
    pub name: String,
}

pub trait Service {
    fn handle(&self);
}`;
		const filtered = filterCode(input, "rust", "aggressive");
		expect(filtered).toContain("pub struct User");
		expect(filtered).toContain("pub trait Service");
	});
});

// ── Smart Truncate ──

describe("smartTruncate", () => {
	test("returns content unchanged when within limit", () => {
		const input = "line1\nline2\nline3";
		expect(smartTruncate(input, 10, "typescript")).toBe(input);
	});

	test("truncates and adds count when exceeding limit", () => {
		const lines = Array.from({ length: 20 }, (_, i) => `line ${i}`);
		const input = lines.join("\n");
		const result = smartTruncate(input, 5, "typescript");
		expect(result.split("\n").length).toBeLessThanOrEqual(6);
		expect(result).toMatch(/\[\d+ more lines\]/);
	});
});

// ── Filter Savings Estimation ──

describe("estimateFilterSavings", () => {
	test("calculates correct savings percentage", () => {
		const original = "a".repeat(400);
		const filtered = "a".repeat(200);
		const { originalTokens, filteredTokens, savedTokens, savingsPct } = estimateFilterSavings(
			original,
			filtered,
		);
		expect(originalTokens).toBe(100);
		expect(filteredTokens).toBe(50);
		expect(savedTokens).toBe(50);
		expect(savingsPct).toBe(50);
	});

	test("handles zero-length input", () => {
		const result = estimateFilterSavings("", "");
		expect(result.savingsPct).toBe(0);
	});
});
