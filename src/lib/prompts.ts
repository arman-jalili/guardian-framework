/**
 * Interactive prompts for GuardianCLI using @clack/prompts
 */

import {
	cancel,
	confirm,
	intro,
	isCancel,
	multiselect,
	outro,
	select,
	spinner,
	text,
} from "@clack/prompts";
import type { Language, Tool, Validator, Workflow } from "./templates.js";
import {
	AVAILABLE_VALIDATORS,
	AVAILABLE_WORKFLOWS,
	SUPPORTED_LANGUAGES,
	SUPPORTED_TOOLS,
} from "./templates.js";

export interface InitOptions {
	tools: Tool[];
	language: Language;
	validators: Validator[];
	workflows: Workflow[];
	projectName: string;
	projectVersion: string;
	projectType: string;
	repository: string;
}

/**
 * Run interactive prompts for init command
 */
export async function runInitPrompts(): Promise<InitOptions | null> {
	intro("GuardianCLI - Token-Optimized Agentic Framework Scaffolder");

	// Step 1: Project name
	const projectName = await text({
		message: "What is your project name?",
		placeholder: "my-project",
		validate: (value) => {
			if (!value.trim()) return "Project name is required";
			if (value.includes(" ")) return "Use dashes instead of spaces";
			return undefined;
		},
	});

	if (isCancel(projectName)) {
		cancel("Cancelled");
		return null;
	}

	// Step 2: Project version
	const projectVersion = await text({
		message: "Project version?",
		placeholder: "0.1.0",
		initialValue: "0.1.0",
	});

	if (isCancel(projectVersion)) {
		cancel("Cancelled");
		return null;
	}

	// Step 3: Project type
	const projectType = await select({
		message: "Project type?",
		options: [
			{ value: "CLI", label: "CLI application" },
			{ value: "Web App", label: "Web application" },
			{ value: "Library", label: "Library/Package" },
			{ value: "API", label: "API/Backend" },
			{ value: "Other", label: "Other" },
		],
	});

	if (isCancel(projectType)) {
		cancel("Cancelled");
		return null;
	}

	// Step 4: Repository
	const repository = await text({
		message: "Repository (owner/repo)?",
		placeholder: "my-org/my-project",
	});

	if (isCancel(repository)) {
		cancel("Cancelled");
		return null;
	}

	// Step 5: AI Tool selection (multi-select, pi recommended)
	const tools = await multiselect({
		message: "Select AI tools to scaffold (pi is recommended for full features)",
		options: [
			{
				value: "pi",
				label: "pi (Recommended)",
				hint: "Full features: extensions, skills, prompts",
			},
			{
				value: "claude",
				label: "Claude Code",
				hint: "Static export: .md files, manual scripts",
			},
			{
				value: "opencode",
				label: "OpenCode",
				hint: "Static export: .txt prompts, manual scripts",
			},
			{
				value: "agents",
				label: "Antigravity",
				hint: "Static export: flat agents structure",
			},
		],
		initialValues: ["pi"],
	});

	if (isCancel(tools)) {
		cancel("Cancelled");
		return null;
	}

	// Step 6: Language selection
	const language = await select({
		message: "Select programming language",
		options: [
			{ value: "typescript", label: "TypeScript/JavaScript (Bun)" },
			{ value: "rust", label: "Rust" },
			{ value: "python", label: "Python" },
			{ value: "go", label: "Go" },
		],
	});

	if (isCancel(language)) {
		cancel("Cancelled");
		return null;
	}

	// Step 7: Validator selection (CI pre-selected and locked)
	const validators = await multiselect({
		message: "Select validators (CI is always required)",
		options: [
			{
				value: "ci",
				label: "CI validation",
				hint: "Required - build, lint, format check",
			},
			{
				value: "test",
				label: "Test validation",
				hint: "Unit and integration tests",
			},
			{
				value: "security",
				label: "Security validation",
				hint: "Secrets, injection, path traversal checks",
			},
			{
				value: "operations",
				label: "Operations validation",
				hint: "Tracing, cancellation, atomic writes",
			},
			{
				value: "integration",
				label: "Integration validation",
				hint: "Component integration checks",
			},
		],
		initialValues: ["ci", "test"],
	});

	if (isCancel(validators)) {
		cancel("Cancelled");
		return null;
	}

	// Step 8: Workflow selection (all optional)
	const workflows = await multiselect({
		message: "Select workflow prompts",
		options: [
			{
				value: "feature-development",
				label: "Feature Development",
				hint: "New features workflow",
			},
			{
				value: "bug-fix",
				label: "Bug Fix",
				hint: "Bug fixing workflow",
			},
			{
				value: "hotfix",
				label: "Emergency Hotfix",
				hint: "Production fixes workflow",
			},
			{
				value: "refactoring",
				label: "Refactoring",
				hint: "Code improvement workflow",
			},
			{
				value: "issue-implementation-series",
				label: "Issue Implementation",
				hint: "Batch GitHub issues workflow",
			},
		],
		initialValues: ["feature-development", "bug-fix"],
	});

	if (isCancel(workflows)) {
		cancel("Cancelled");
		return null;
	}

	// Step 9: Confirmation
	const confirmed = await confirm({
		message: `Ready to scaffold?
  Tools: ${tools.join(", ")}
  Language: ${language}
  Validators: ${validators.join(", ")}
  Workflows: ${workflows.length > 0 ? workflows.join(", ") : "none"}
  Project: ${projectName} v${projectVersion}`,
	});

	if (isCancel(confirmed) || !confirmed) {
		cancel("Cancelled");
		return null;
	}

	return {
		tools: tools as Tool[],
		language: language as Language,
		validators: validators as Validator[],
		workflows: workflows as Workflow[],
		projectName: projectName as string,
		projectVersion: projectVersion as string,
		projectType: projectType as string,
		repository: repository as string,
	};
}

/**
 * Show progress spinner during scaffold
 */
export function startSpinner(message: string): ReturnType<typeof spinner> {
	const s = spinner();
	s.start(message);
	return s;
}

/**
 * Show success message and exit
 */
export function showSuccess(message: string): void {
	outro(message);
}

/**
 * Show error message and exit
 */
export function showError(message: string): void {
	cancel(message);
}

/**
 * Ask for confirmation to overwrite existing framework
 */
export async function confirmOverwrite(): Promise<boolean> {
	const overwrite = await confirm({
		message: "Framework already exists. Overwrite?",
	});

	if (isCancel(overwrite)) {
		return false;
	}

	return overwrite;
}

/**
 * Ask for confirmation to merge with existing framework
 */
export async function confirmMerge(): Promise<boolean> {
	const merge = await confirm({
		message: "Framework already exists. Merge/update?",
	});

	if (isCancel(merge)) {
		return false;
	}

	return merge;
}

/**
 * Ask which action to take for existing framework
 */
export async function askExistingFrameworkAction(): Promise<
	"overwrite" | "merge" | "cancel" | null
> {
	const action = await select({
		message: "Framework already exists. What would you like to do?",
		options: [
			{ value: "merge", label: "Smart merge", hint: "Preserve user edits, update framework files" },
			{ value: "overwrite", label: "Overwrite", hint: "Replace all files" },
			{ value: "cancel", label: "Cancel", hint: "Exit without changes" },
		],
	});

	if (isCancel(action)) {
		return null;
	}

	return action as "overwrite" | "merge" | "cancel";
}
