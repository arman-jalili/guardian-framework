/**
 * Tests for code-filter.ts
 *
 * Covers language detection, minimal/aggressive filtering, truncation,
 * and savings estimation.
 */

import { describe, expect, test } from "bun:test";
import {
	filterCode as codeFilter,
	detectLanguage,
	estimateFilterSavings,
	filterCode,
	smartTruncate,
} from "../src/lib/code-filter.js";

// ── Language Detection ──

describe("detectLanguage", () => {
	test("detects TypeScript", () => {
		expect(detectLanguage("app.ts")).toBe("typescript");
		expect(detectLanguage("component.tsx")).toBe("typescript");
	});

	test("detects JavaScript", () => {
		expect(detectLanguage("index.js")).toBe("javascript");
		expect(detectLanguage("module.mjs")).toBe("javascript");
	});

	test("detects Rust", () => {
		expect(detectLanguage("main.rs")).toBe("rust");
	});

	test("detects Python", () => {
		expect(detectLanguage("app.py")).toBe("python");
		expect(detectLanguage("setup.pyw")).toBe("python");
	});

	test("detects Go", () => {
		expect(detectLanguage("server.go")).toBe("go");
	});

	test("detects data formats", () => {
		expect(detectLanguage("config.json")).toBe("data");
		expect(detectLanguage("schema.yaml")).toBe("data");
		expect(detectLanguage("data.toml")).toBe("data");
		expect(detectLanguage("readme.md")).toBe("data");
	});

	test("detects C/C++/Java/Ruby/Shell", () => {
		expect(detectLanguage("main.c")).toBe("c");
		expect(detectLanguage("app.cpp")).toBe("cpp");
		expect(detectLanguage("App.java")).toBe("java");
		expect(detectLanguage("script.rb")).toBe("ruby");
		expect(detectLanguage("deploy.sh")).toBe("shell");
	});

	test("returns unknown for unrecognized extensions", () => {
		expect(detectLanguage("file.xyz")).toBe("unknown");
	});

	test("handles case-insensitive extensions", () => {
		expect(detectLanguage("APP.TS")).toBe("typescript");
		expect(detectLanguage("Main.RS")).toBe("rust");
	});
});

// ── Minimal Filter ──

describe("minimal filter (comments stripping)", () => {
	test("strips single-line comments in TypeScript", () => {
		const input = `// This is a comment
export function hello() {
  // Another comment
  return "world";
}`;
		const result = codeFilter(input, "typescript", "minimal");
		expect(result).not.toContain("// This is a comment");
		expect(result).toContain("export function hello()");
	});

	test("strips block comments in C-style languages", () => {
		const input = `/* Block comment */
int main() {
  return 0;
}`;
		const result = codeFilter(input, "c", "minimal");
		expect(result).not.toContain("Block comment");
		expect(result).toContain("int main()");
	});

	test("strips # comments in Python and Shell", () => {
		const input = `# This is a comment
def hello():
    return "world"`;
		const result = codeFilter(input, "python", "minimal");
		expect(result).not.toContain("# This is a comment");
		expect(result).toContain("def hello():");
	});

	test("preserves docstrings in Python", () => {
		const input = `"""Module docstring"""
def hello():
    """Function docstring"""
    return "world"`;
		const result = codeFilter(input, "python", "minimal");
		expect(result).toContain('"""Module docstring"""');
		expect(result).toContain('"""Function docstring"""');
	});

	test("normalizes multiple blank lines", () => {
		const input = `fn main() {


    let x = 1;


    println!("{}", x);
}`;
		const result = codeFilter(input, "rust", "minimal");
		// Should not have 3+ consecutive newlines
		expect(result).not.toMatch(/\n{3,}/);
	});

	test("keeps doc comments in Rust (///)", () => {
		const input = `/// Doc comment
pub fn hello() -> String {
    "world".to_string()
}`;
		const result = codeFilter(input, "rust", "minimal");
		expect(result).toContain("/// Doc comment");
	});
});

// ── Aggressive Filter ──

describe("aggressive filter (body stripping)", () => {
	test("replaces function bodies with implementation comment in Rust", () => {
		const input = `pub fn add(a: i32, b: i32) -> i32 {
    let result = a + b;
    result
}

pub struct User {
    name: String,
}`;
		const result = codeFilter(input, "rust", "aggressive");
		expect(result).toContain("pub fn add");
		expect(result).toContain("// ... implementation");
		expect(result).toContain("pub struct User");
	});

	test("strips function bodies in JavaScript", () => {
		const input = `import { foo } from './bar';

function greet(name) {
    console.log('Hello', name);
    return name;
}

const x = 42;`;
		const result = codeFilter(input, "javascript", "aggressive");
		expect(result).toContain("import { foo }");
		expect(result).toContain("function greet(name)");
		expect(result).toContain("// ... implementation");
	});

	test("keeps imports in TypeScript", () => {
		const input = `import { useState } from 'react';
import type { Props } from './types';

export function Component(props: Props) {
    return useState(0);
}`;
		const result = codeFilter(input, "typescript", "aggressive");
		expect(result).toContain("import { useState }");
		expect(result).toContain("import type { Props }");
		expect(result).toContain("export function Component");
	});

	test("never modifies data formats", () => {
		const input = `{
  "key": "value",
  // comments in JSONC
  "count": 42
}`;
		const result = codeFilter(input, "data", "aggressive");
		// Data files should get minimal filter (comments stripped) but not body stripping
		expect(result).toContain('"key"');
		expect(result).toContain('"count"');
	});
});

// ── None Filter ──

describe("none filter", () => {
	test("returns content unchanged", () => {
		const input = "// Keep this comment\nexport const x = 1;";
		expect(codeFilter(input, "typescript", "none")).toBe(input);
	});
});

// ── Smart Truncate ──

describe("smartTruncate", () => {
	test("returns full content when under limit", () => {
		const input = "line1\nline2\nline3";
		expect(smartTruncate(input, 10, "typescript")).toBe(input);
	});

	test("truncates with informative marker", () => {
		const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
		const result = smartTruncate(lines, 5, "typescript");
		expect(result).toContain("more lines");
		expect(result.split("\n").length).toBeLessThanOrEqual(6);
	});
});

// ── Savings Estimation ──

describe("estimateFilterSavings", () => {
	test("calculates savings between original and filtered", () => {
		const original = "// Comment\n// Comment\n// Comment\nexport const x = 1;";
		const filtered = "export const x = 1;";
		const savings = estimateFilterSavings(original, filtered);
		expect(savings.originalTokens).toBeGreaterThan(savings.filteredTokens);
		expect(savings.savedTokens).toBeGreaterThan(0);
		expect(savings.savingsPct).toBeGreaterThan(0);
	});

	test("returns 0 savings for identical content", () => {
		const content = "export const x = 1;";
		const savings = estimateFilterSavings(content, content);
		expect(savings.savedTokens).toBe(0);
		expect(savings.savingsPct).toBe(0);
	});
});
