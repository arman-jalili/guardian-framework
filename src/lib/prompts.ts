/**
 * Interactive prompts for Guardian using @clack/prompts
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
import type { Language, RepoTool, Tool } from "./templates.js";
import { REPOSITORY_TOOLS, SUPPORTED_LANGUAGES, SUPPORTED_TOOLS } from "./templates.js";

export interface InitOptions {
	tools: Tool[];
	language: Language;
	buildTool?: "maven" | "gradle";
	repoTool: RepoTool;
	projectName: string;
	projectVersion: string;
	repository: string;
	groupId: string;
	archMode: "strict" | "simplified";
	domainDescription: string;
}

/**
 * Run interactive prompts for init command
 */
export async function runInitPrompts(): Promise<InitOptions | null> {
	intro("Guardian - Token-Optimized Agentic Framework Scaffolder");

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

	// Step 3: Repository
	const repository = await text({
		message: "Repository (owner/repo)?",
		placeholder: "my-org/my-project",
	});

	if (isCancel(repository)) {
		cancel("Cancelled");
		return null;
	}

	// Step 4: Repository tool selection (gh or glab)
	const repoTool = await select({
		message: "Which Git repository tool do you use?",
		options: [
			{
				value: "gh",
				label: "GitHub CLI (gh)",
				hint: "GitHub.com repositories",
			},
			{
				value: "glab",
				label: "GitLab CLI (glab)",
				hint: "GitLab.com or self-hosted GitLab",
			},
		],
	});

	if (isCancel(repoTool)) {
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
				value: "github",
				label: "GitHub Copilot CLI",
				hint: "Custom instructions, agents, settings.json",
			},
			{
				value: "omp",
				label: "oh-my-pi",
				hint: "Agent definitions, AGENTS.md, extensions",
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
			{ value: "java", label: "Java (Spring Boot)" },
		],
	});

	if (isCancel(language)) {
		cancel("Cancelled");
		return null;
	}

	// Step 6b: Build tool selection (only for Java)
	let buildTool: "maven" | "gradle" | undefined;
	if (language === "java") {
		buildTool = (await select({
			message: "Select Java build tool",
			options: [
				{ value: "maven", label: "Maven", hint: "mvn (Recommended)" },
				{ value: "gradle", label: "Gradle", hint: "gradle" },
			],
		})) as "maven" | "gradle";

		if (isCancel(buildTool)) {
			cancel("Cancelled");
			return null;
		}
		buildTool = buildTool as "maven" | "gradle";
	}

	// Step 6c: Architecture mode selection
	const archMode = await select({
		message: "Architecture mode?",
		options: [
			{
				value: "strict",
				label: "Strict Hexagonal (Recommended)",
				hint: "domain/ = pure business logic & interfaces only; concrete providers in infrastructure/",
			},
			{
				value: "simplified",
				label: "Simplified",
				hint: "domain/ may contain concrete providers; relaxed validation",
			},
		],
	});

	if (isCancel(archMode)) {
		cancel("Cancelled");
		return null;
	}

	// Step 7: Group/package prefix
	const groupId = await text({
		message: "Group/package prefix? (e.g., com.yourcompany)",
		placeholder: `com.${projectName}`,
		initialValue: `com.${projectName}`,
	});

	if (isCancel(groupId)) {
		cancel("Cancelled");
		return null;
	}

	// Step 8: Business domain description (optional)
	const domainDescription = await text({
		message: "Briefly describe your business domain (optional, seeds domain exploration)",
		placeholder: "e.g., A fintech platform for payment processing and fraud detection",
	});

	if (isCancel(domainDescription)) {
		cancel("Cancelled");
		return null;
	}

	// Step 9: Confirmation
	const confirmed = await confirm({
		message: `Ready to scaffold?
  Project: ${projectName} v${projectVersion}
  Repository: ${repository} (${repoTool})
  Tools: ${tools.join(", ")}
  Language: ${language}${buildTool ? `\n  Build Tool: ${buildTool}` : ""}
  Architecture: ${archMode}
  Group ID: ${groupId}
  Domain: ${domainDescription || "(none)"}`,
	});

	if (isCancel(confirmed) || !confirmed) {
		cancel("Cancelled");
		return null;
	}

	return {
		tools: tools as Tool[],
		language: language as Language,
		buildTool: buildTool as "maven" | "gradle" | undefined,
		repoTool: repoTool as RepoTool,
		projectName: projectName as string,
		projectVersion: projectVersion as string,
		repository: repository as string,
		groupId: groupId as string,
		archMode: archMode as "strict" | "simplified",
		domainDescription: domainDescription as string,
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
