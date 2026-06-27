/**
 * Unit tests for manifest.ts
 *
 * Covers:
 *  - createManifest
 *  - addFileRecord / addExportRecord
 *  - hashFile / hashDirectory
 *  - manifestExists / readManifest / writeManifest
 *  - categorizeFile
 *  - estimateTokens / calculateTokenStats
 *  - validateManifest
 *  - isFileModified
 */

import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

// Module under test
import {
	MANIFEST_FILE,
	addFileRecord,
	calculateTokenStats,
	categorizeFile,
	createManifest,
	estimateTokens,
	hashDirectory,
	hashFile,
	isFileModified,
	manifestExists,
	readManifest,
	validateManifest,
	writeManifest,
} from "../../src/lib/manifest";

function tempDir(): string {
	return fs.mkdtempSync(path.join(tmpdir(), "manifest-test-"));
}

describe("createManifest", () => {
	test("creates manifest with all required fields", () => {
		const manifest = createManifest({
			tools: ["pi", "claude"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: ["ci", "tests"],
			workflows: ["feature-development", "bug-fix"],
		});

		expect(manifest.schemaVersion).toBe("0.1");
		expect(manifest.frameworkVersion).toBe("0.1.0");
		expect(manifest.source).toBe("pi");
		expect(manifest.tools).toEqual(["pi", "claude"]);
		expect(manifest.language).toBe("typescript");
		expect(manifest.repoTool).toBe("gh");
		expect(manifest.groupId).toBe("com.test");
		expect(manifest.validators).toEqual(["ci", "tests"]);
		expect(manifest.workflows).toEqual(["feature-development", "bug-fix"]);
		expect(manifest.archMode).toBe("strict");
	});

	test("creates manifest with optional archMode", () => {
		const manifest = createManifest({
			tools: ["pi"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: [],
			workflows: [],
			archMode: "simplified",
		});

		expect(manifest.archMode).toBe("simplified");
	});

	test("creates manifest with templateContext", () => {
		const context = {
			projectName: "test-project",
			projectVersion: "0.1.0",
			language: "typescript" as const,
			repository: "owner/repo",
			repoTool: "gh" as const,
			groupId: "com.test",
			buildCommand: "bun build",
			testCommand: "bun test",
			lintCommand: "biome check",
			formatCommand: "biome format",
			formatCheckCommand: "biome check",
			securityAuditCommand: "bun audit",
			errorHandlingPattern: "Result type",
			tracingPattern: "JSON logging",
			cancellationPattern: "AbortController",
			atomicWritePattern: "write-rename",
			keyFile1: "src/index.ts",
			keyFile1Purpose: "Entry point",
			keyFile2: "src/lib/core.ts",
			keyFile2Purpose: "Core lib",
		};

		const manifest = createManifest({
			tools: ["pi"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: [],
			workflows: [],
			templateContext: context,
		});

		expect(manifest.templateContext?.projectName).toBe("test-project");
		expect(manifest.templateContext?.buildCommand).toBe("bun build");
	});
});

describe("addFileRecord", () => {
	test("adds file with SHA-256 hash", () => {
		const manifest = createManifest({
			tools: ["pi"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: [],
			workflows: [],
		});

		addFileRecord(manifest, ".pi/test.md", "user", "hello world");

		const record = manifest.files[".pi/test.md"];
		expect(record).toBeDefined();
		expect(record.category).toBe("user");
		expect(record.status).toBe("unchanged");
		expect(record.originalHash).toMatch(/^sha256:/);
	});

	test("multiple files are tracked separately", () => {
		const manifest = createManifest({
			tools: ["pi"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: [],
			workflows: [],
		});

		addFileRecord(manifest, "file1.md", "framework", "content1");
		addFileRecord(manifest, "file2.md", "user", "content2");

		expect(Object.keys(manifest.files)).toHaveLength(2);
	});
});

describe("categorizeFile", () => {
	test("categorizes user-editable files", () => {
		expect(categorizeFile("agent/AGENTS.md")).toBe("user");
		expect(categorizeFile("context/project.md")).toBe("user");
		expect(categorizeFile("context/patterns.md")).toBe("user");
		expect(categorizeFile("domain/exploration.md")).toBe("user");
	});

	test("categorizes framework-controlled files", () => {
		expect(categorizeFile("scripts/validate-ci.sh")).toBe("framework");
		expect(categorizeFile("extensions/kanban.ts")).toBe("framework");
		expect(categorizeFile("skills/agents/code-developer.md")).toBe("framework");
		expect(categorizeFile("prompts/feature-development.md")).toBe("framework");
	});

	test("categorizes generated export files", () => {
		expect(categorizeFile(".claude/CLAUDE.md")).toBe("generated");
		expect(categorizeFile(".opencode/context.md")).toBe("generated");
		expect(categorizeFile(".agents/project.md")).toBe("generated");
	});

	test("defaults to framework for unknown paths", () => {
		expect(categorizeFile("some/random/path.ts")).toBe("framework");
	});
});

describe("hashFile / hashDirectory", () => {
	test("hashFile returns SHA-256 hex string", () => {
		const dir = tempDir();
		const testFile = path.join(dir, "test.txt");
		fs.writeFileSync(testFile, "hello world", "utf-8");

		const hash = hashFile(testFile);
		expect(hash).toHaveLength(64); // SHA-256 hex length
		expect(hash).toMatch(/^[a-f0-9]+$/);
	});

	test("hashFile returns empty string for missing file", () => {
		expect(hashFile("/nonexistent/file.txt")).toBe("");
	});

	test("hashDirectory returns deterministic hash", () => {
		const dir = tempDir();
		fs.writeFileSync(path.join(dir, "a.txt"), "aaa", "utf-8");
		fs.writeFileSync(path.join(dir, "b.txt"), "bbb", "utf-8");

		const hash1 = hashDirectory(dir);
		const hash2 = hashDirectory(dir);
		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64);
	});

	test("hashDirectory returns empty string for missing dir", () => {
		expect(hashDirectory("/nonexistent/dir")).toBe("");
	});
});

describe("manifestExists / readManifest / writeManifest", () => {
	test("manifestExists returns true when manifest exists", () => {
		const dir = tempDir();
		const manifest = createManifest({
			tools: ["pi"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: [],
			workflows: [],
		});

		writeManifest(dir, manifest);
		expect(manifestExists(dir)).toBe(true);
	});

	test("manifestExists returns false when no manifest", () => {
		const dir = tempDir();
		expect(manifestExists(dir)).toBe(false);
	});

	test("readManifest returns null for non-existent file", () => {
		expect(readManifest("/nonexistent")).toBeNull();
	});

	test("writeManifest creates valid JSON", () => {
		const dir = tempDir();
		const manifest = createManifest({
			tools: ["pi"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: [],
			workflows: [],
		});

		writeManifest(dir, manifest);
		const loaded = readManifest(dir);
		expect(loaded).not.toBeNull();
		expect(loaded?.source).toBe("pi");
		expect(loaded?.tools).toEqual(["pi"]);
	});

	test("writeManifest uses atomic write (temp file + rename)", () => {
		const dir = tempDir();
		const manifest = createManifest({
			tools: ["pi"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: [],
			workflows: [],
		});

		writeManifest(dir, manifest);
		// Temp file should be cleaned up
		const tmpPath = path.join(dir, `${MANIFEST_FILE}.tmp`);
		expect(fs.existsSync(tmpPath)).toBe(false);
	});
});

describe("isFileModified", () => {
	test("detects modified file", () => {
		const manifest = createManifest({
			tools: ["pi"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: [],
			workflows: [],
		});

		addFileRecord(manifest, "test.md", "user", "original content");
		const modified = isFileModified(manifest, "test.md", "different content");
		expect(modified).toBe(true);
	});

	test("returns false for unchanged file", () => {
		const manifest = createManifest({
			tools: ["pi"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: [],
			workflows: [],
		});

		addFileRecord(manifest, "test.md", "user", "same content");
		const modified = isFileModified(manifest, "test.md", "same content");
		expect(modified).toBe(false);
	});

	test("returns true for untracked file", () => {
		const manifest = createManifest({
			tools: ["pi"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: [],
			workflows: [],
		});

		const modified = isFileModified(manifest, "untracked.md", "content");
		expect(modified).toBe(true);
	});
});

describe("validateManifest", () => {
	test("validates a valid manifest", () => {
		const manifest = createManifest({
			tools: ["pi"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: [],
			workflows: [],
		});

		const result = validateManifest(manifest);
		expect(result).not.toBeNull();
		expect(result?.source).toBe("pi");
	});

	test("rejects null/undefined", () => {
		expect(validateManifest(null)).toBeNull();
		expect(validateManifest(undefined)).toBeNull();
	});

	test("rejects manifest with wrong source", () => {
		const bad = { source: "claude", tools: [], language: "ts", validators: [] };
		expect(validateManifest(bad)).toBeNull();
	});

	test("rejects manifest missing required fields", () => {
		expect(validateManifest({})).toBeNull();
	});
});

describe("estimateTokens / calculateTokenStats", () => {
	test("estimateTokens computes rough token count", () => {
		// ~4 chars per token
		expect(estimateTokens("hello world")).toBe(3); // "hello world" = 11 chars / 4 = 2.75 → ceil 3
		expect(estimateTokens("")).toBe(0);
		expect(estimateTokens("a")).toBe(1);
	});

	test("calculateTokenStats aggregates all files", () => {
		const dir = tempDir();
		const manifest = createManifest({
			tools: ["pi"],
			language: "typescript",
			repoTool: "gh",
			groupId: "com.test",
			validators: [],
			workflows: [],
		});

		const f1 = path.join(dir, "file1.md");
		const f2 = path.join(dir, "file2.md");
		fs.writeFileSync(f1, "hello world", "utf-8");
		fs.writeFileSync(f2, "some longer text here for testing", "utf-8");

		addFileRecord(manifest, "file1.md", "user", "hello world");
		addFileRecord(manifest, "file2.md", "framework", "some longer text here for testing");

		const stats = calculateTokenStats(dir, manifest);
		expect(stats.totalTokens).toBeGreaterThan(0);
		expect(stats.byCategory.user).toBeDefined();
		expect(stats.byCategory.framework).toBeDefined();
		expect(stats.lastCalculatedAt).toBeDefined();
	});

	test("estimateToken returns 0 for empty strings", () => {
		expect(estimateTokens("")).toBe(0);
	});
});
