/**
 * Tests for tracking.ts
 *
 * Covers token recording, stats aggregation, USD estimation, formatting.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	clearHistory,
	estimateUsdSaved,
	formatTime,
	formatTokens,
	getHistory,
	getStats,
	track,
} from "../src/lib/tracking.js";

// Override the db path for tests by temporarily patching process.env
// The module uses getDbPath() internally which reads from os.homedir().
// We'll use a dedicated test fixture dir and reimport.

function getTestDbPath(tmpDir: string): string {
	const dataDir = path.join(tmpDir, ".local", "share", "guardian");
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
	}
	return path.join(dataDir, "history.json");
}

// Helper: directly manipulate the JSON file since we can't easily swap the module path
function writeTestRecords(tmpDir: string, records: unknown[]): void {
	const dbPath = getTestDbPath(tmpDir);
	fs.writeFileSync(dbPath, JSON.stringify(records, null, 2), "utf-8");
}

function readTestRecords(tmpDir: string): unknown[] {
	const dbPath = getTestDbPath(tmpDir);
	if (!fs.existsSync(dbPath)) return [];
	return JSON.parse(fs.readFileSync(dbPath, "utf-8")) as unknown[];
}

describe("formatTokens", () => {
	test("formats small token counts as-is", () => {
		expect(formatTokens(500)).toBe("500");
	});

	test("formats thousands with K suffix", () => {
		expect(formatTokens(5000)).toBe("5.0K");
		expect(formatTokens(12500)).toBe("12.5K");
	});

	test("formats millions with M suffix", () => {
		expect(formatTokens(1500000)).toBe("1.5M");
		expect(formatTokens(2300000)).toBe("2.3M");
	});
});

describe("formatTime", () => {
	test("formats milliseconds", () => {
		expect(formatTime(500)).toBe("500ms");
	});

	test("formats seconds", () => {
		expect(formatTime(1500)).toBe("1.5s");
		expect(formatTime(5000)).toBe("5.0s");
	});

	test("formats minutes", () => {
		expect(formatTime(125000)).toBe("2m5s");
		expect(formatTime(60000)).toBe("1m0s");
	});
});

describe("estimateUsdSaved", () => {
	test("estimates USD savings for default pricing", () => {
		const saved = estimateUsdSaved(1_000_000);
		// 500K input * $3/M + 500K output * $10/M = $1.5 + $5 = $6.50
		expect(saved).toBe(6.5);
	});

	test("estimates USD savings for Anthropic pricing", () => {
		const saved = estimateUsdSaved(1_000_000, "anthropic");
		// 500K input * $3/M + 500K output * $15/M = $1.5 + $7.5 = $9.00
		expect(saved).toBe(9);
	});

	test("uses default for unknown model", () => {
		const saved = estimateUsdSaved(1_000_000, "unknown_model");
		expect(saved).toBe(6.5);
	});

	test("returns 0 for 0 tokens", () => {
		expect(estimateUsdSaved(0)).toBe(0);
	});
});

describe("tracking lifecycle", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-tracking-"));
		// Create the data dir so getDbPath works
		const dataDir = path.join(tmpDir, ".local", "share", "guardian");
		fs.mkdirSync(dataDir, { recursive: true });
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test("track records a command execution", () => {
		track({
			validator: "ci",
			inputTokens: 10000,
			outputTokens: 5000,
			execTimeMs: 1500,
		});

		const records = getHistory(5);
		expect(records.length).toBeGreaterThan(0);
		const last = records[0];
		expect(last.validator).toBe("ci");
		expect(last.inputTokens).toBe(10000);
		expect(last.outputTokens).toBe(5000);
		expect(last.savedTokens).toBe(5000);
		expect(last.savingsPct).toBe(50);
		expect(last.execTimeMs).toBe(1500);
	});

	test("getHistory returns recent entries", () => {
		// Clear first, then add known entries
		clearHistory();
		track({ validator: "tests", inputTokens: 8000, outputTokens: 4000, execTimeMs: 2000 });
		track({ validator: "security", inputTokens: 12000, outputTokens: 3000, execTimeMs: 5000 });

		const history = getHistory(1);
		expect(history.length).toBe(1);
		expect(history[0].validator).toBe("security");
	});

	test("getStats aggregates across records", () => {
		clearHistory();
		track({ validator: "ci", inputTokens: 10000, outputTokens: 6000, execTimeMs: 1000 });
		track({ validator: "ci", inputTokens: 20000, outputTokens: 12000, execTimeMs: 2000 });
		track({ validator: "tests", inputTokens: 5000, outputTokens: 2000, execTimeMs: 500 });

		const stats = getStats(30);
		expect(stats.totalCommands).toBe(3);
		expect(stats.totalInputTokens).toBe(35000);
		expect(stats.totalOutputTokens).toBe(20000);
		expect(stats.totalSavedTokens).toBe(15000);
		expect(stats.topValidators.length).toBeGreaterThan(0);
		expect(stats.dailyBreakdown.length).toBeGreaterThan(0);
	});

	test("clearHistory removes all records", () => {
		track({ validator: "ci", inputTokens: 1000, outputTokens: 500, execTimeMs: 100 });
		clearHistory();
		expect(getHistory(10).length).toBe(0);
	});
});
