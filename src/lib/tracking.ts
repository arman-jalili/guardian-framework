/**
 * SQLite-Based Token Tracking for GuardianCLI
 *
 * Tracks every command execution with input/output tokens, savings %,
 * execution time, and USD cost estimation. Inspired by RTK's tracking.rs.
 *
 * Storage: ~/.local/share/guardian/history.db (90-day retention)
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ── Types ──

export interface TokenRecord {
	id: number;
	timestamp: string;
	validator: string;
	inputTokens: number;
	outputTokens: number;
	savedTokens: number;
	savingsPct: number;
	execTimeMs: number;
}

export interface TokenStats {
	totalCommands: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalSavedTokens: number;
	avgSavingsPct: number;
	totalExecTimeMs: number;
	avgExecTimeMs: number;
	totalUsdSaved: number;
	topValidators: { validator: string; count: number }[];
	dailyBreakdown: { date: string; tokens: number; usd: number }[];
}

export interface ModelPricing {
	name: string;
	inputPerM: number;
	outputPerM: number;
}

// Default pricing (per 1M tokens, USD)
const DEFAULT_PRICING: Record<string, ModelPricing> = {
	openai: { name: "OpenAI", inputPerM: 5, outputPerM: 15 },
	anthropic: { name: "Anthropic", inputPerM: 3, outputPerM: 15 },
	google: { name: "Google", inputPerM: 1.25, outputPerM: 10 },
	default: { name: "Average", inputPerM: 3, outputPerM: 10 },
};

const HISTORY_DAYS = 90;

// ── Storage ──

function getDbPath(): string {
	const dataDir = path.join(os.homedir(), ".local", "share", "guardian");
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
	}
	return path.join(dataDir, "history.json");
}

function loadRecords(): TokenRecord[] {
	const dbPath = getDbPath();
	if (!fs.existsSync(dbPath)) return [];
	try {
		const data = JSON.parse(fs.readFileSync(dbPath, "utf-8")) as TokenRecord[];
		// Auto-cleanup: remove records older than HISTORY_DAYS
		const cutoff = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000;
		const filtered = data.filter((r) => new Date(r.timestamp).getTime() > cutoff);
		if (filtered.length !== data.length) {
			saveRecords(filtered);
		}
		return filtered;
	} catch {
		return [];
	}
}

function saveRecords(records: TokenRecord[]): void {
	const dbPath = getDbPath();
	const tmpPath = `${dbPath}.tmp`;
	fs.writeFileSync(tmpPath, JSON.stringify(records, null, 2), "utf-8");
	fs.renameSync(tmpPath, dbPath);
}

function nextId(records: TokenRecord[]): number {
	return records.length > 0 ? Math.max(...records.map((r) => r.id)) + 1 : 1;
}

// ── Public API ──

/**
 * Record a token tracking event.
 */
export function track(params: {
	validator: string;
	inputTokens: number;
	outputTokens: number;
	execTimeMs: number;
}): void {
	const records = loadRecords();
	const savedTokens = params.inputTokens - params.outputTokens;
	const savingsPct = params.inputTokens > 0 ? (savedTokens / params.inputTokens) * 100 : 0;

	records.push({
		id: nextId(records),
		timestamp: new Date().toISOString(),
		validator: params.validator,
		inputTokens: params.inputTokens,
		outputTokens: params.outputTokens,
		savedTokens,
		savingsPct,
		execTimeMs: params.execTimeMs,
	});

	saveRecords(records);
}

/**
 * Calculate USD savings for a given token count.
 */
export function estimateUsdSaved(savedTokens: number, model = "default"): number {
	const pricing = DEFAULT_PRICING[model] ?? DEFAULT_PRICING.default;
	// Assume 50/50 input/output mix for savings estimation
	const half = savedTokens / 2;
	const inputSaved = (half / 1_000_000) * pricing.inputPerM;
	const outputSaved = (half / 1_000_000) * pricing.outputPerM;
	return Math.round((inputSaved + outputSaved) * 100) / 100;
}

/**
 * Get aggregate token stats with daily breakdown and top validators.
 */
export function getStats(sinceDays = 30): TokenStats {
	const records = loadRecords();
	const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
	const recent = records.filter((r) => new Date(r.timestamp).getTime() > cutoff);

	const totalCommands = recent.length;
	const totalInput = recent.reduce((s, r) => s + r.inputTokens, 0);
	const totalOutput = recent.reduce((s, r) => s + r.outputTokens, 0);
	const totalSaved = recent.reduce((s, r) => s + r.savedTokens, 0);
	const avgSavings =
		totalCommands > 0 ? recent.reduce((s, r) => s + r.savingsPct, 0) / totalCommands : 0;
	const totalTime = recent.reduce((s, r) => s + r.execTimeMs, 0);
	const avgTime = totalCommands > 0 ? totalTime / totalCommands : 0;
	const usdSaved = estimateUsdSaved(totalSaved);

	// Top validators by usage count
	const validatorCounts = new Map<string, number>();
	for (const r of recent) {
		validatorCounts.set(r.validator, (validatorCounts.get(r.validator) ?? 0) + 1);
	}
	const topValidators = [...validatorCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([validator, count]) => ({ validator, count }));

	// Daily breakdown
	const dailyMap = new Map<string, { tokens: number; usd: number }>();
	for (const r of recent) {
		const date = r.timestamp.split("T")[0];
		const entry = dailyMap.get(date) ?? { tokens: 0, usd: 0 };
		entry.tokens += r.savedTokens;
		dailyMap.set(date, entry);
	}
	const dailyBreakdown = [...dailyMap.entries()]
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([date, { tokens, usd }]) => ({ date, tokens, usd: estimateUsdSaved(tokens) }));

	return {
		totalCommands,
		totalInputTokens: totalInput,
		totalOutputTokens: totalOutput,
		totalSavedTokens: totalSaved,
		avgSavingsPct: Math.round(avgSavings * 10) / 10,
		totalExecTimeMs: totalTime,
		avgExecTimeMs: Math.round(avgTime * 10) / 10,
		totalUsdSaved: usdSaved,
		topValidators,
		dailyBreakdown,
	};
}

/**
 * Get command history (recent N entries).
 */
export function getHistory(limit = 20): TokenRecord[] {
	const records = loadRecords();
	return records.slice(-limit).reverse();
}

/**
 * Clear all tracking data.
 */
export function clearHistory(): void {
	saveRecords([]);
}

/**
 * Format token count for display.
 */
export function formatTokens(tokens: number): string {
	if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
	if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
	return `${tokens}`;
}

/**
 * Format milliseconds for display.
 */
export function formatTime(ms: number): string {
	if (ms >= 60_000) {
		const mins = Math.floor(ms / 60_000);
		const secs = Math.floor((ms % 60_000) / 1000);
		return `${mins}m${secs}s`;
	}
	if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
	return `${ms}ms`;
}
