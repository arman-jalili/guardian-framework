/**
 * Workspace hooks for GuardianCLI
 *
 * Executes lifecycle hooks around agent/generate runs:
 * - after_create: runs once when workspace is first created
 * - before_run: runs before each generate/update attempt
 * - after_run: runs after each attempt (best effort, errors logged not fatal)
 * - before_remove: runs before workspace cleanup
 *
 * Based on Symphony's workspace hook specification (Section 9.4).
 */

import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { HookConfig } from "./workflow-config.js";

export interface HookResult {
	success: boolean;
	exitCode: number;
	stdout: string;
	stderr: string;
	durationMs: number;
}

const MAX_LOG_OUTPUT = 4096; // Truncate hook output in logs

/**
 * Execute a hook script with timeout.
 * Runs in the workspace directory with cwd set to the workspace path.
 */
export async function executeHook(
	hookName: string,
	script: string,
	workspacePath: string,
	timeoutMs: number,
): Promise<HookResult> {
	const startTime = Date.now();

	return new Promise<HookResult>((resolve) => {
		const proc = child_process.spawn("bash", ["-lc", script], {
			cwd: workspacePath,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: timeoutMs,
		});

		// Stall detection: if no output for stallTimeoutMs, consider it stalled
		const stallTimeoutMs = Math.min(timeoutMs, 60000); // Max 60s stall window
		let stallTimer: ReturnType<typeof setTimeout> | undefined;
		let stdout = "";
		let stderr = "";

		const resetStallTimer = () => {
			if (stallTimer) clearTimeout(stallTimer);
			hadOutput = false;
			stallTimer = setTimeout(() => {
				if (!proc.killed) {
					console.error(`[warn] Hook '${hookName}' stalled (no output for ${stallTimeoutMs}ms), terminating`);
					proc.kill("SIGTERM");
				}
			}, stallTimeoutMs);
		};

		proc.stdout.on("data", (d: Buffer) => {
			stdout += d.toString();
			if (stdout.length > MAX_LOG_OUTPUT * 2) stdout = stdout.slice(-MAX_LOG_OUTPUT);
			resetStallTimer();
		});

		proc.stderr.on("data", (d: Buffer) => {
			stderr += d.toString();
			if (stderr.length > MAX_LOG_OUTPUT * 2) stderr = stderr.slice(-MAX_LOG_OUTPUT);
			resetStallTimer();
		});

		// Start the stall timer
		resetStallTimer();

		proc.on("close", (code) => {
			resolve({
				success: code === 0,
				exitCode: code ?? 1,
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				durationMs: Date.now() - startTime,
			});
		});

		proc.on("error", (err) => {
			resolve({
				success: false,
				exitCode: 1,
				stdout: "",
				stderr: `Hook execution error: ${err.message}`,
				durationMs: Date.now() - startTime,
			});
		});
	});
}

/**
 * Run before_run hook if configured.
 * Failure is fatal to the current operation.
 */
export async function runBeforeRunHook(
	workspacePath: string,
	hooks: HookConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
	if (!hooks.before_run) return { ok: true };

	const result = await executeHook("before_run", hooks.before_run, workspacePath, hooks.timeout_ms);

	if (!result.success) {
		const detail = result.stderr || result.stdout || "exit code " + result.exitCode;
		const truncated = detail.length > 500 ? detail.slice(0, 500) + "..." : detail;
		return {
			ok: false,
			error: `before_run hook failed (${result.durationMs}ms): ${truncated}`,
		};
	}

	return { ok: true };
}

/**
 * Run after_run hook if configured.
 * Failure is logged but ignored (best effort).
 */
export async function runAfterRunHook(
	workspacePath: string,
	hooks: HookConfig,
): Promise<void> {
	if (!hooks.after_run) return;

	const result = await executeHook("after_run", hooks.after_run, workspacePath, hooks.timeout_ms);

	if (!result.success) {
		// Best effort: log but don't fail
		console.error(`[warn] after_run hook failed (${result.durationMs}ms): ${result.stderr || result.stdout}`);
	}
}

/**
 * Run after_create hook if configured.
 * Failure is fatal to workspace creation.
 */
export async function runAfterCreateHook(
	workspacePath: string,
	hooks: HookConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
	if (!hooks.after_create) return { ok: true };

	const result = await executeHook("after_create", hooks.after_create, workspacePath, hooks.timeout_ms);

	if (!result.success) {
		const detail = result.stderr || result.stdout || "exit code " + result.exitCode;
		const truncated = detail.length > 500 ? detail.slice(0, 500) + "..." : detail;
		return {
			ok: false,
			error: `after_create hook failed (${result.durationMs}ms): ${truncated}`,
		};
	}

	return { ok: true };
}

/**
 * Run before_remove hook if configured.
 * Failure is logged but cleanup proceeds.
 */
export async function runBeforeRemoveHook(
	workspacePath: string,
	hooks: HookConfig,
): Promise<void> {
	if (!hooks.before_remove) return;

	const result = await executeHook("before_remove", hooks.before_remove, workspacePath, hooks.timeout_ms);

	if (!result.success) {
		console.error(`[warn] before_remove hook failed (${result.durationMs}ms): ${result.stderr || result.stdout}`);
	}
}

/**
 * Ensure workspace directory exists.
 * If newly created, runs after_create hook.
 */
export async function ensureWorkspace(
	workspacePath: string,
	hooks: HookConfig,
): Promise<{ ok: true; created: boolean } | { ok: false; error: string }> {
	let created = false;

	try {
		if (!fs.existsSync(workspacePath)) {
			fs.mkdirSync(workspacePath, { recursive: true });
			created = true;
		} else if (!fs.statSync(workspacePath).isDirectory()) {
			// Path exists but is not a directory
			fs.rmSync(workspacePath, { recursive: true, force: true });
			fs.mkdirSync(workspacePath, { recursive: true });
			created = true;
		}
	} catch (err) {
		return {
			ok: false,
			error: `Failed to create workspace at ${workspacePath}: ${err}`,
		};
	}

	if (created) {
		const hookResult = await runAfterCreateHook(workspacePath, hooks);
		if (!hookResult.ok) return hookResult;
	}

	return { ok: true, created };
}

/**
 * Clean up workspace directory.
 * Runs before_remove hook first.
 */
export async function cleanupWorkspace(
	workspacePath: string,
	hooks: HookConfig,
): Promise<void> {
	if (fs.existsSync(workspacePath)) {
		await runBeforeRemoveHook(workspacePath, hooks);
		try {
			fs.rmSync(workspacePath, { recursive: true, force: true });
		} catch (err) {
			console.error(`[warn] Failed to remove workspace ${workspacePath}: ${err}`);
		}
	}
}

/**
 * Validate that a workspace path is safely contained within workspace root.
 * Prevents path traversal attacks.
 */
export function isWorkspacePathSafe(workspacePath: string, workspaceRoot: string): boolean {
	const resolved = path.resolve(workspacePath);
	const root = path.resolve(workspaceRoot);

	if (!resolved.startsWith(root + path.sep) && resolved !== root) {
		return false;
	}

	return true;
}

/**
 * Sanitize an identifier for use as a workspace directory name.
 * Only [A-Za-z0-9._-] allowed; all other characters replaced with _.
 */
export function sanitizeWorkspaceKey(identifier: string): string {
	return identifier.replace(/[^A-Za-z0-9._-]/g, "_");
}
