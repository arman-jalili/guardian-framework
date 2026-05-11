/**
 * Persistent retry queue for GuardianCLI
 *
 * Survives process restarts by storing retry state in `.pi/.guardian-retry-state.json`.
 * Based on Symphony spec Section 4.1.7 (RetryEntry) and Section 8.4 (Retry and Backoff).
 */

import * as fs from "node:fs";
import * as path from "node:path";

const RETRY_STATE_FILE = ".guardian-retry-state.json";

export interface RetryEntry {
	key: string;        // Unique identifier (e.g., tool name or operation key)
	attempt: number;    // 1-based attempt count
	scheduledAtMs: number;  // Monotonic timestamp when this retry becomes due
	error: string;      // Last error message
	meta?: Record<string, unknown>;  // Arbitrary context
}

export interface RetryState {
	entries: RetryEntry[];
	lastUpdated: string;
}

/**
 * Get the retry state file path within a target directory.
 */
function getStatePath(targetDir: string): string {
	return path.join(targetDir, ".pi", RETRY_STATE_FILE);
}

/**
 * Load retry state from disk.
 * Returns empty state if file doesn't exist or is invalid.
 */
export function loadRetryState(targetDir: string): RetryState {
	const filePath = getStatePath(targetDir);
	if (!fs.existsSync(filePath)) {
		return { entries: [], lastUpdated: new Date().toISOString() };
	}

	try {
		const raw = fs.readFileSync(filePath, "utf-8");
		const parsed = JSON.parse(raw) as RetryState;
		if (!parsed.entries || !Array.isArray(parsed.entries)) {
			return { entries: [], lastUpdated: new Date().toISOString() };
		}
		return parsed;
	} catch {
		return { entries: [], lastUpdated: new Date().toISOString() };
	}
}

/**
 * Save retry state to disk (atomic write via temp file + rename).
 */
export function saveRetryState(targetDir: string, state: RetryState): void {
	const filePath = getStatePath(targetDir);
	const tempPath = `${filePath}.tmp`;

	state.lastUpdated = new Date().toISOString();

	fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf-8");
	fs.renameSync(tempPath, filePath);
}

/**
 * Schedule a retry for the given key.
 * Cancels any existing retry for the same key and replaces it.
 *
 * @param delayMs - Delay in milliseconds before this retry is due
 */
export function scheduleRetry(
	targetDir: string,
	key: string,
	delayMs: number,
	error: string,
	meta?: Record<string, unknown>,
	attempt?: number,
): void {
	const state = loadRetryState(targetDir);

	// Remove existing entry for same key
	state.entries = state.entries.filter((e) => e.key !== key);

	state.entries.push({
		key,
		attempt: attempt ?? 1,
		scheduledAtMs: Date.now() + delayMs,
		error,
		meta,
	});

	saveRetryState(targetDir, state);
}

/**
 * Get all retries that are currently due (scheduled time has passed).
 */
export function getDueRetries(targetDir: string): RetryEntry[] {
	const state = loadRetryState(targetDir);
	const now = Date.now();
	return state.entries.filter((e) => e.scheduledAtMs <= now);
}

/**
 * Remove a retry entry by key.
 */
export function clearRetry(targetDir: string, key: string): void {
	const state = loadRetryState(targetDir);
	state.entries = state.entries.filter((e) => e.key !== key);
	saveRetryState(targetDir, state);
}

/**
 * Clear all retry entries.
 */
export function clearAllRetries(targetDir: string): void {
	saveRetryState(targetDir, { entries: [], lastUpdated: new Date().toISOString() });
}

/**
 * Calculate exponential backoff delay.
 * delay = min(baseDelayMs * 2^(attempt-1), maxBackoffMs)
 */
export function calculateBackoff(
	attempt: number,
	baseDelayMs: number,
	maxBackoffMs: number,
): number {
	const delay = baseDelayMs * Math.pow(2, attempt - 1);
	return Math.min(delay, maxBackoffMs);
}
