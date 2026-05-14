/**
 * Workflow config layer for GuardianCLI
 *
 * Parses YAML front matter from .pi/agent/AGENTS.md (the workflow contract file).
 * Provides typed getters with defaults, $VAR env indirection, and validation.
 *
 * Based on Symphony's workflow specification (Section 5-6).
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ── Config Schema with Defaults ──

export interface WorkspaceConfig {
	root: string;
	hooks: HookConfig;
}

export interface HookConfig {
	after_create?: string;
	before_run?: string;
	after_run?: string;
	before_remove?: string;
	timeout_ms: number;
}

export interface AgentConfig {
	max_turns: number;
	max_retry_backoff_ms: number;
	stall_timeout_ms: number;
}

export interface GenerateConfig {
	on_conflict: "overwrite" | "warn" | "skip";
	atomic_writes: boolean;
}

export interface ValidateConfig {
	fail_fast: boolean;
	timeout_ms: number;
}

export interface GuardianWorkflowConfig {
	workspace: WorkspaceConfig;
	agent: AgentConfig;
	generate: GenerateConfig;
	validate: ValidateConfig;
}

// Built-in defaults (Symphony spec Section 6.4)
const DEFAULTS: GuardianWorkflowConfig = {
	workspace: {
		root: ".pi/workspaces",
		hooks: {
			timeout_ms: 60000,
		},
	},
	agent: {
		max_turns: 20,
		max_retry_backoff_ms: 300000,
		stall_timeout_ms: 300000,
	},
	generate: {
		on_conflict: "warn",
		atomic_writes: true,
	},
	validate: {
		fail_fast: false,
		timeout_ms: 300000,
	},
};

// ── YAML Front Matter Parser (minimal, no external deps) ──

function parseSimpleYaml(text: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const currentPath: string[] = [];
	let currentIndent = -1;

	for (const line of text.split("\n")) {
		// Skip empty lines and comments
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		// Calculate indent level
		const indent = line.search(/\S/);

		// Handle key: value pairs
		const match = trimmed.match(/^(\w[\w.-]*)\s*:\s*(.*)$/);
		if (!match) continue;

		const key = match[1];
		let value = match[2].trim();

		// Remove inline comments
		if (value.includes(" #") && !value.startsWith('"') && !value.startsWith("'")) {
			value = value.slice(0, value.indexOf(" #")).trim();
		}

		// Adjust current path based on indent
		while (currentPath.length > 0 && indent <= currentIndent) {
			currentPath.pop();
			currentIndent = findIndentOfPath(text, currentPath);
		}

		if (value === "" || value === "|") {
			// Nested object or multiline string
			currentPath.push(key);
			currentIndent = indent;

			// Check for inline YAML block (after |)
			if (value === "|") {
				// Collect indented lines
				const lines: string[] = [];
				const rawLines = text.split("\n");
				const idx = rawLines.indexOf(line);
				for (let i = idx + 1; i < rawLines.length; i++) {
					const nextLine = rawLines[i];
					if (nextLine.trim() === "") continue;
					if (nextLine.search(/\S/) <= indent) break;
					lines.push(nextLine.slice(indent + 2));
				}
				setNested(result, [...currentPath], lines.join("\n").trim());
			} else {
				setNested(result, [...currentPath], {});
			}
		} else {
			// Scalar value
			const parsed = parseScalar(value);
			setNested(result, [...currentPath, key], parsed);
		}
	}

	return result;
}

function findIndentOfPath(text: string, path: string[]): number {
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const key = trimmed.match(/^(\w[\w.-]*)\s*:/)?.[1];
		if (key === path[path.length - 1]) return line.search(/\S/);
	}
	return -1;
}

function setNested(obj: Record<string, unknown>, path: string[], value: unknown): void {
	let current = obj;
	for (let i = 0; i < path.length - 1; i++) {
		const p = path[i];
		if (!(p in current) || typeof current[p] !== "object" || current[p] === null) {
			current[p] = {};
		}
		current = current[p] as Record<string, unknown>;
	}
	if (path.length > 0) {
		current[path[path.length - 1]] = value;
	}
}

function parseScalar(value: string): unknown {
	// Quoted strings
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}
	// Booleans
	if (value === "true") return true;
	if (value === "false") return false;
	// Null
	if (value === "null" || value === "~") return null;
	// Numbers
	const num = Number(value);
	if (!Number.isNaN(num)) return num;
	// Array shorthand [a, b, c]
	if (value.startsWith("[") && value.endsWith("]")) {
		const items = value
			.slice(1, -1)
			.split(",")
			.map((s) => parseScalar(s.trim()));
		return items;
	}
	return value;
}

// ── Public API ──

/**
 * Load and parse the workflow config from .pi/agent/AGENTS.md.
 * Returns the effective config (defaults + front matter overrides + $VAR resolution).
 */
export function loadWorkflowConfig(piDir: string): GuardianWorkflowConfig {
	const agentsPath = path.join(piDir, "agent", "AGENTS.md");
	let frontMatter: Record<string, unknown> = {};

	if (fs.existsSync(agentsPath)) {
		const content = fs.readFileSync(agentsPath, "utf-8");
		frontMatter = parseFrontMatter(content);
	}

	return deepMerge(
		DEFAULTS as unknown as Record<string, unknown>,
		frontMatter,
	) as unknown as GuardianWorkflowConfig;
}

/**
 * Extract YAML front matter from a markdown file.
 * Returns parsed front matter object, or {} if no front matter.
 */
export function parseFrontMatter(content: string): Record<string, unknown> {
	if (!content.startsWith("---\n")) return {};

	const endIdx = content.indexOf("\n---\n", 4);
	if (endIdx === -1) return {};

	const yamlBlock = content.slice(4, endIdx);
	return parseSimpleYaml(yamlBlock);
}

/**
 * Extract the prompt body (markdown after front matter).
 */
export function extractPromptBody(content: string): string {
	if (!content.startsWith("---\n")) return content.trim();

	const endIdx = content.indexOf("\n---\n", 4);
	if (endIdx === -1) return content.trim();

	return content.slice(endIdx + 5).trim();
}

/**
 * Resolve $VAR references in a string value using process.env.
 * Only resolves values that exactly match $VAR_NAME pattern.
 */
export function resolveEnvVars(value: string): string {
	return value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_match, varName) => {
		const envVal = process.env[varName];
		return envVal !== undefined ? envVal : `$${varName}`;
	});
}

/**
 * Deep merge: src overrides defaults, preserving nested structure.
 */
function deepMerge(
	defaults: Record<string, unknown>,
	src: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...defaults };

	for (const [key, value] of Object.entries(src)) {
		if (
			value &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			defaults[key] &&
			typeof defaults[key] === "object" &&
			!Array.isArray(defaults[key])
		) {
			result[key] = deepMerge(
				defaults[key] as Record<string, unknown>,
				value as Record<string, unknown>,
			);
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Validate the effective config before dispatch.
 * Returns null if valid, or an error string describing the issue.
 */
export function validateWorkflowConfig(config: GuardianWorkflowConfig): string | null {
	if (config.agent.max_turns < 1) return "agent.max_turns must be >= 1";
	if (config.agent.max_retry_backoff_ms < 1000) return "agent.max_retry_backoff_ms must be >= 1000";
	if (config.agent.stall_timeout_ms < 0) return "agent.stall_timeout_ms must be >= 0";
	if (!["overwrite", "warn", "skip"].includes(config.generate.on_conflict)) {
		return "generate.on_conflict must be 'overwrite', 'warn', or 'skip'";
	}
	if (config.validate.timeout_ms < 1000) return "validate.timeout_ms must be >= 1000";
	if (config.workspace.hooks.timeout_ms < 1000) return "workspace.hooks.timeout_ms must be >= 1000";
	return null;
}
