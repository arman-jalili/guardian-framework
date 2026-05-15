/**
 * Tests for trust.ts
 *
 * Covers trust/revoke/check lifecycle, content-change detection, env override.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	checkTrust,
	listTrusted,
	revokeTrust,
	trustFile,
	trustStatusMessage,
} from "../src/lib/trust.js";

describe("trust lifecycle", () => {
	let tmpDir: string;
	let testFile: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-trust-"));
		testFile = path.join(tmpDir, "test-config.toml");
		fs.writeFileSync(testFile, 'name = "test"\n', "utf-8");
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test("untrusted file returns untrusted status", () => {
		expect(checkTrust(tmpDir, testFile)).toBe("untrusted");
	});

	test("trusting a file returns trusted status", () => {
		trustFile(tmpDir, testFile);
		expect(checkTrust(tmpDir, testFile)).toBe("trusted");
	});

	test("modifying content after trust returns content-changed", () => {
		// Trust the file first
		trustFile(tmpDir, testFile);
		expect(checkTrust(tmpDir, testFile)).toBe("trusted");

		// Modify the content
		fs.writeFileSync(testFile, 'name = "modified"\n', "utf-8");
		expect(checkTrust(tmpDir, testFile)).toBe("content-changed");
	});

	test("re-trusting after content change returns trusted again", () => {
		// Re-trust the modified file
		trustFile(tmpDir, testFile);
		expect(checkTrust(tmpDir, testFile)).toBe("trusted");
	});

	test("revoking trust returns untrusted", () => {
		revokeTrust(tmpDir, testFile);
		expect(checkTrust(tmpDir, testFile)).toBe("untrusted");
	});

	test("listTrusted returns empty after revoke", () => {
		expect(listTrusted(tmpDir)).toEqual([]);
	});

	test("listTrusted returns trusted files", () => {
		trustFile(tmpDir, testFile);
		const trusted = listTrusted(tmpDir);
		expect(trusted.length).toBe(1);
		expect(trusted[0].filePath).toBe(testFile);
		expect(trusted[0].hash.length).toBe(64); // SHA-256 hex
	});
});

describe("trust status messages", () => {
	test("trusted status message", () => {
		const msg = trustStatusMessage("trusted", "config.toml");
		expect(msg).toContain("Trusted");
		expect(msg).toContain("config.toml");
	});

	test("untrusted status message", () => {
		const msg = trustStatusMessage("untrusted", "config.toml");
		expect(msg).toContain("Untrusted");
		expect(msg).toContain("config.toml");
	});

	test("content-changed status message", () => {
		const msg = trustStatusMessage("content-changed", "config.toml");
		expect(msg).toContain("Content changed");
	});

	test("env-override status message", () => {
		const msg = trustStatusMessage("env-override", "config.toml");
		expect(msg).toContain("GUARDIAN_TRUST_OVERRIDE");
	});
});

describe("env override", () => {
	test("GUARDIAN_TRUST_OVERRIDE=1 bypasses trust check", () => {
		const saved = process.env.GUARDIAN_TRUST_OVERRIDE;
		process.env.GUARDIAN_TRUST_OVERRIDE = "1";

		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-trust-env-"));
		const testFile = path.join(tmpDir, "config.toml");
		fs.writeFileSync(testFile, "x = 1\n", "utf-8");

		// Not trusted, but env override should pass
		expect(checkTrust(tmpDir, testFile)).toBe("env-override");

		fs.rmSync(tmpDir, { recursive: true, force: true });
		process.env.GUARDIAN_TRUST_OVERRIDE = saved;
	});
});
