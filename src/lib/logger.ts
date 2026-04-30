/**
 * Structured logging for GuardianCLI
 *
 * Emits JSON-structured log lines with timestamp, level, message, and context.
 * Based on Symphony's logging conventions (Section 13.1).
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	context?: Record<string, unknown>;
}

// ── Logger State ──

let logLevel: LogLevel = "info";
let logOutput: NodeJS.WriteStream = process.stderr;

/**
 * Configure the logger.
 */
export function configureLogger(options: { level?: LogLevel; output?: NodeJS.WriteStream } = {}): void {
	if (options.level) logLevel = options.level;
	if (options.output) logOutput = options.output;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

/**
 * Emit a structured log entry.
 */
export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
	if (LEVEL_ORDER[level] < LEVEL_ORDER[logLevel]) return;

	const entry: LogEntry = {
		timestamp: new Date().toISOString(),
		level,
		message,
		...(context ? { context } : {}),
	};

	logOutput.write(JSON.stringify(entry) + "\n");
}

/**
 * Convenience functions for each level.
 */
export const logger = {
	debug: (message: string, context?: Record<string, unknown>) => log("debug", message, context),
	info: (message: string, context?: Record<string, unknown>) => log("info", message, context),
	warn: (message: string, context?: Record<string, unknown>) => log("warn", message, context),
	error: (message: string, context?: Record<string, unknown>) => log("error", message, context),

	// Issue-specific logging (Symphony convention)
	issue: (issueId: string, message: string, context?: Record<string, unknown>) =>
		log("info", message, { issue_id: issueId, ...context }),

	// Tool-specific logging
	tool: (tool: string, message: string, context?: Record<string, unknown>) =>
		log("info", message, { tool, ...context }),

	// Action-outcome logging
	action: (action: string, outcome: "completed" | "failed" | "retrying" | "skipped", reason?: string) =>
		log("info", `${action} ${outcome}`, { action, outcome, ...(reason ? { reason } : {}) }),
};
