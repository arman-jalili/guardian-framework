/**
 * Workflow config layer for Guardian
 *
 * Parses YAML front matter from .pi/agent/AGENTS.md (the workflow contract file).
 * Provides typed getters with defaults, $VAR env indirection, and validation.
 *
 * Based on Symphony's workflow specification (Section 5-6).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import YAML from "yaml";

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

export interface GoalConfig {
	enabled: boolean;
	max_turns: number;
	judge_validator: boolean;
}

export interface KanbanConfig {
	enabled: boolean;
	auto_create_tasks: boolean;
}

export interface HookEntryConfig {
	matcher?: string;
	command: string;
	timeout?: number;
}

export interface HookConfig {
	pre_tool_call?: HookEntryConfig[];
	post_tool_call?: HookEntryConfig[];
	pre_llm_call?: HookEntryConfig[];
	post_llm_call?: HookEntryConfig[];
	on_session_start?: HookEntryConfig[];
	on_session_end?: HookEntryConfig[];
	subagent_stop?: HookEntryConfig[];
}

export interface CuratorConfig {
	enabled: boolean;
	stale_after_days: number;
	archive_after_days: number;
	auto_review: boolean;
}

export interface DelegationConfig {
	max_spawn_depth: number;
	max_concurrent_children: number;
	max_iterations: number;
	child_timeout_ms: number;
}

export interface GuardianWorkflowConfig {
	workspace: WorkspaceConfig;
	agent: AgentConfig;
	generate: GenerateConfig;
	validate: ValidateConfig;
	goal: GoalConfig;
	kanban: KanbanConfig;
	hooks: HookConfig;
	curator: CuratorConfig;
	delegation: DelegationConfig;
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
	goal: {
		enabled: true,
		max_turns: 20,
		judge_validator: true,
	},
	kanban: {
		enabled: true,
		auto_create_tasks: true,
	},
	hooks: {},
	curator: {
		enabled: true,
		stale_after_days: 30,
		archive_after_days: 90,
		auto_review: true,
	},
	delegation: {
		max_spawn_depth: 1,
		max_concurrent_children: 3,
		max_iterations: 50,
		child_timeout_ms: 600000,
	},
};

// ── YAML Front Matter Parser (using yaml package) ──

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
	try {
		return (YAML.parse(yamlBlock) as Record<string, unknown>) ?? {};
	} catch {
		return {};
	}
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
 * Serialize an object to YAML front matter string (including --- delimiters).
 * Uses the yaml package for proper formatting that round-trips correctly.
 */
export function toYamlFrontMatter(data: Record<string, unknown>): string {
	const yamlContent = YAML.stringify(data, {
		lineWidth: 0,
		indent: 2,
	});
	return `---\n${yamlContent}---\n`;
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
