/**
 * Tests for integrity.ts
 *
 * Covers hash storage, verification, tamper detection, directory scanning.
 *
 * Note: integrity.ts uses hardcoded `.guardian/` relative to cwd, so tests
 * must chdir into the temp directory before calling storeHash/removeHash.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { removeHash, storeHash, verifyDirectory, verifyFile } from "../src/lib/integrity.js";

describe("hash storage and verification", () => {
	let tmpDir: string;
	let testFile: string;
	let originalCwd: string;

	beforeAll(() => {
		originalCwd = process.cwd();
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-integrity-"));
		testFile = path.join(tmpDir, "src", "app.ts");
		fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
		fs.writeFileSync(testFile, "export const hello = 'world';\n", "utf-8");

		// Change cwd so storeHash writes .guardian/ in tmpDir
		process.chdir(tmpDir);
	});

	afterAll(() => {
		process.chdir(originalCwd);
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test("storeHash creates hash file", () => {
		const hashResult = storeHash(testFile);
		expect(hashResult.ok).toBe(true);
		expect(hashResult.ok ? hashResult.value.length : 0).toBe(64); // SHA-256 hex

		const hashDir = path.join(tmpDir, ".guardian");
		expect(fs.existsSync(hashDir)).toBe(true);

		const hashFiles = fs.readdirSync(hashDir).filter((f) => f.endsWith(".sha256"));
		expect(hashFiles.length).toBeGreaterThan(0);
	});

	test("verifyFile returns verified for unchanged file", () => {
		const result = verifyFile(testFile);
		expect(result.state).toBe("verified");
		expect(result.expectedHash).toBe(result.actualHash);
	});

	test("verifyFile returns tampered for modified file", () => {
		// Tamper with the file
		fs.writeFileSync(testFile, "export const hello = 'tampered';\n", "utf-8");
		const result = verifyFile(testFile);
		expect(result.state).toBe("tampered");
		expect(result.expectedHash).not.toBe(result.actualHash);
	});

	test("verifyFile returns no-baseline for file without hash", () => {
		const newFile = path.join(tmpDir, "src", "new.ts");
		fs.writeFileSync(newFile, "export const x = 1;\n", "utf-8");
		const result = verifyFile(newFile);
		expect(result.state).toBe("no-baseline");
	});

	test("verifyFile returns orphaned-hash for deleted file", () => {
		const orphanFile = path.join(tmpDir, "src", "deleted.ts");
		// Store hash first
		fs.writeFileSync(orphanFile, "content\n", "utf-8");
		const orphanResult = storeHash(orphanFile);
		expect(orphanResult.ok).toBe(true);
		// Then delete the file
		fs.rmSync(orphanFile);
		const result = verifyFile(orphanFile);
		expect(result.state).toBe("orphaned-hash");
	});

	test("verifyFile returns not-installed for missing file without hash", () => {
		const missing = path.join(tmpDir, "src", "missing.ts");
		const result = verifyFile(missing);
		expect(result.state).toBe("not-installed");
	});

	test("removeHash deletes hash file", () => {
		// Write a fresh file and store hash
		const fileForRemove = path.join(tmpDir, "src", "remove-test.ts");
		fs.writeFileSync(fileForRemove, "content\n", "utf-8");
		const removeTestResult = storeHash(fileForRemove);
		expect(removeTestResult.ok).toBe(true);
		const hashDir = path.join(tmpDir, ".guardian");
		const before = fs.readdirSync(hashDir).filter((f) => f.endsWith(".sha256")).length;
		expect(before).toBeGreaterThan(0);

		removeHash(fileForRemove);
		const after = fs.readdirSync(hashDir).filter((f) => f.endsWith(".sha256")).length;
		expect(after).toBe(before - 1);
	});
});

describe("verifyDirectory", () => {
	let tmpDir: string;
	let originalCwd: string;

	beforeAll(() => {
		originalCwd = process.cwd();
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-integrity-dir-"));
		// Create some files
		fs.writeFileSync(path.join(tmpDir, "a.ts"), "a\n", "utf-8");
		fs.writeFileSync(path.join(tmpDir, "b.ts"), "b\n", "utf-8");

		// Store hashes (need to be in tmpDir for .guardian/ to be created there)
		process.chdir(tmpDir);
		const aResult = storeHash(path.join(tmpDir, "a.ts"));
		expect(aResult.ok).toBe(true);
		const bResult = storeHash(path.join(tmpDir, "b.ts"));
		expect(bResult.ok).toBe(true);
	});

	afterAll(() => {
		process.chdir(originalCwd);
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test("verifyDirectory finds all tracked files", () => {
		const report = verifyDirectory(tmpDir);
		expect(report.summary.total).toBeGreaterThanOrEqual(2);
		expect(report.summary.verified).toBeGreaterThanOrEqual(2);
	});

	test("verifyDirectory detects tampered files in batch", () => {
		// Tamper with one file
		fs.writeFileSync(path.join(tmpDir, "a.ts"), "tampered!\n", "utf-8");
		const report = verifyDirectory(tmpDir);
		expect(report.summary.tampered).toBeGreaterThanOrEqual(1);
	});
});
