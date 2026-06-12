/**
 * Canonical Reference: .pi/architecture/modules/template-system.md#template-loading
 * Implements: ADR-003
 * Last Sync: 2026-05-31

 * Template loading utility for Guardian
 *
 * Loads templates from templates/pi/ and templates/languages/
 * Provides template rendering with placeholder substitution
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { type Result, tryCatch } from "./result.js";

// Template directory paths - resolve from package root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When bundled, we need to find the package root
// Try multiple paths to handle both dev and linked/published scenarios
export function findTemplateDir(): string {
	const possiblePaths = [
		// From dist/index.js -> project root
		path.join(__dirname, "..", "..", "templates"),
		// From src/lib/templates.ts -> project root (dev mode)
		path.join(__dirname, "..", "..", "..", "templates"),
		// From linked bin - resolve symlink
		path.resolve(path.dirname(fs.realpathSync(__filename)), "..", "templates"),
	];

	for (const p of possiblePaths) {
		if (fs.existsSync(p)) {
			return p;
		}
	}

	// Fallback: try to find via package.json resolution
	try {
		// @ts-ignore - bun specific
		const pkgPath = require.resolve("guardian-framework/package.json");
		return path.join(path.dirname(pkgPath), "templates");
	} catch {
		// Last resort - check common locations
		const cwdTemplates = path.join(process.cwd(), "templates");
		if (fs.existsSync(cwdTemplates)) {
			return cwdTemplates;
		}
	}

	throw new Error("Templates not found. Ensure templates/pi/ exists in package.");
}

export const TEMPLATE_DIR = findTemplateDir();
const PI_TEMPLATE_DIR = path.join(TEMPLATE_DIR, "pi");
const LANGUAGES_DIR = path.join(TEMPLATE_DIR, "languages");

// Supported languages
export const SUPPORTED_LANGUAGES = ["typescript", "rust", "python", "go", "java"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

// Supported tools
export const SUPPORTED_TOOLS = ["pi", "claude", "opencode", "agents", "github", "omp"] as const;

export type Tool = (typeof SUPPORTED_TOOLS)[number];

// Repository tools (for git operations)
export const REPOSITORY_TOOLS = ["gh", "glab"] as const;

export type RepoTool = (typeof REPOSITORY_TOOLS)[number];

// Available validators
export const AVAILABLE_VALIDATORS = [
	"ci",
	"tests",
	"security",
	"operations",
	"integration",
	"architecture",
	"canonical",
] as const;

export type Validator = (typeof AVAILABLE_VALIDATORS)[number];

// Available workflows
export const AVAILABLE_WORKFLOWS = [
	"feature-development",
	"bug-fix",
	"hotfix",
	"refactoring",
	"issue-implementation-series",
	// Epic/Issue Management
	"epic-plan",
	"issue-draft",
	"git-issues",
	"issue-closeout",
	"issue-merge",
	// Plan Conversion
	"plan-to-issues",
	// Blueprint Management
	"blueprint-validate",
	"sync-check",
	"context-refresh",
	"scope-analyzer",
	"pattern-extract",
	"blueprint-update",
] as const;

export type Workflow = (typeof AVAILABLE_WORKFLOWS)[number];

/**
 * Options for the `guardian project create` command.
 * The `layers` field contains decomposed interface sub-layer paths
 * (e.g., "interfaces/http", "interfaces/messaging") driven by ADRs.
 */
export interface ProjectCreateOptions {
	language: Language;
	buildTool?: "maven" | "gradle";
	groupId: string;
	packageName: string;
	modules: string[];
	layers: string[];
	ciStages: string[];
}

/**
 * Default options for project scaffolding per language.
 * Interface sub-layers reflect the project's delivery mechanisms.
 */
export const PROJECT_DEFAULTS: Record<Language, Partial<ProjectCreateOptions>> = {
	typescript: {
		layers: ["domain", "application", "infrastructure", "interfaces/http", "interfaces/graphql"],
	},
	rust: {
		layers: ["domain", "application", "infrastructure", "interfaces/http", "interfaces/cli"],
	},
	python: {
		layers: ["domain", "application", "infrastructure", "interfaces/http"],
	},
	go: {
		layers: ["domain", "application", "infrastructure", "interfaces/http"],
	},
	java: {
		layers: ["domain", "application", "infrastructure", "interfaces/http", "interfaces/messaging"],
	},
};

// Placeholder mappings for template substitution
export interface TemplateContext {
	projectName: string;
	projectVersion: string;
	language: Language;
	buildTool?: "maven" | "gradle";
	repository: string;
	repoTool: RepoTool;
	groupId: string;
	domainDescription?: string;
	buildCommand: string;
	testCommand: string;
	lintCommand: string;
	formatCommand: string;
	formatCheckCommand: string;
	securityAuditCommand: string;
	errorHandlingPattern: string;
	tracingPattern: string;
	cancellationPattern: string;
	atomicWritePattern: string;
	keyFile1: string;
	keyFile1Purpose: string;
	keyFile2: string;
	keyFile2Purpose: string;
}

// Language-specific defaults for commands
export const LANGUAGE_DEFAULTS: Record<
	Language,
	{
		buildCommand: string;
		testCommand: string;
		lintCommand: string;
		formatCommand: string;
		formatCheckCommand: string;
		securityAuditCommand: string;
		errorHandlingPattern: string;
		tracingPattern: string;
		cancellationPattern: string;
		atomicWritePattern: string;
	}
> = {
	typescript: {
		buildCommand: "bun build ./src/index.ts --outdir ./dist",
		testCommand: "bun test",
		lintCommand: "biome check .",
		formatCommand: "biome format . --write",
		formatCheckCommand: "biome check . --format-only",
		securityAuditCommand: "bun audit",
		errorHandlingPattern: "Result type pattern (ok/error)",
		tracingPattern: "Structured JSON logging",
		cancellationPattern: "AbortController pattern",
		atomicWritePattern: "Write-rename with .tmp file",
	},
	rust: {
		buildCommand: "cargo build",
		testCommand: "cargo test --all",
		lintCommand: "cargo clippy -- -D warnings",
		formatCommand: "cargo fmt",
		formatCheckCommand: "cargo fmt --check",
		securityAuditCommand: "cargo audit",
		errorHandlingPattern: "Result<T, E> pattern",
		tracingPattern: "tracing crate with structured spans",
		cancellationPattern: "CancellationToken pattern",
		atomicWritePattern: "tempfile + rename pattern",
	},
	python: {
		buildCommand: "python -m build",
		testCommand: "pytest",
		lintCommand: "ruff check .",
		formatCommand: "ruff format .",
		formatCheckCommand: "ruff format --check .",
		securityAuditCommand: "pip-audit",
		errorHandlingPattern: "Exception classes with typed fields",
		tracingPattern: "structlog with JSON output",
		cancellationPattern: "asyncio.CancelledError handling",
		atomicWritePattern: "tempfile.NamedTemporaryFile + rename",
	},
	go: {
		buildCommand: "go build ./...",
		testCommand: "go test ./...",
		lintCommand: "golangci-lint run",
		formatCommand: "gofmt -w .",
		formatCheckCommand: "gofmt -l .",
		securityAuditCommand: "govulncheck ./...",
		errorHandlingPattern: "Custom error types with errors.Is/As",
		tracingPattern: "slog structured logging",
		cancellationPattern: "context.Context cancellation",
		atomicWritePattern: "temp file + os.Rename",
	},
	java: {
		buildCommand: "mvn clean compile -q",
		testCommand: "mvn test -q",
		lintCommand: "mvn checkstyle:check -q",
		formatCommand: "mvn spotless:apply",
		formatCheckCommand: "mvn spotless:check",
		securityAuditCommand: "mvn dependency-check:check",
		errorHandlingPattern: "Spring @ControllerAdvice / Result type pattern",
		tracingPattern: "Micrometer Observation / SLF4j MDC",
		cancellationPattern: "Reactive Streams cancellation / @Async CompletableFuture",
		atomicWritePattern: "Spring Data CrudRepository.save()",
	},
};

/**
 * Canonical Reference: .pi/architecture/modules/template-system.md#template-loading
 * Implements: ADR-003
 * Last Sync: 2026-05-31

 * Check if templates directory exists
 */
export function templatesExist(): boolean {
	return fs.existsSync(PI_TEMPLATE_DIR);
}

/**
 * Canonical Reference: .pi/architecture/modules/template-system.md#template-loading
 * Implements: ADR-003
 * Last Sync: 2026-05-31

 * Get all template files in templates/pi/ recursively
 */
export function getPiTemplateFiles(): string[] {
	const files: string[] = [];

	function walk(dir: string): void {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(fullPath);
			} else {
				// Get relative path from pi template dir
				const relativePath = path.relative(PI_TEMPLATE_DIR, fullPath);
				files.push(relativePath);
			}
		}
	}

	if (fs.existsSync(PI_TEMPLATE_DIR)) {
		walk(PI_TEMPLATE_DIR);
	}

	return files;
}

/**
 * Canonical Reference: .pi/architecture/modules/template-system.md#template-loading
 * Implements: ADR-003
 * Last Sync: 2026-05-31

 * Read a template file content
 */
export function readTemplate(relativePath: string): Result<string, Error> {
	const fullPath = path.join(PI_TEMPLATE_DIR, relativePath);
	if (!fs.existsSync(fullPath)) {
		return { ok: false, error: new Error(`Template not found: ${relativePath}`) };
	}
	return tryCatch(() => fs.readFileSync(fullPath, "utf-8"));
}

/**
 * Canonical Reference: .pi/architecture/modules/template-system.md#template-loading
 * Implements: ADR-003
 * Last Sync: 2026-05-31

 * Read language patterns file
 */
export function readLanguagePatterns(language: Language): Result<string, Error> {
	const fullPath = path.join(LANGUAGES_DIR, `${language}-patterns.md`);
	if (!fs.existsSync(fullPath)) {
		return { ok: false, error: new Error(`Language patterns not found: ${language}`) };
	}
	return tryCatch(() => fs.readFileSync(fullPath, "utf-8"));
}

/**
 * Canonical Reference: .pi/architecture/modules/template-system.md#template-loading
 * Implements: ADR-003
 * Last Sync: 2026-05-31

 * Substitute placeholders in template content
 * Supports {{PLACEHOLDER}} format
 */
export function renderTemplate(content: string, context: Partial<TemplateContext>): string {
	let result = content;

	// Replace all {{PLACEHOLDER}} patterns
	for (const [key, value] of Object.entries(context)) {
		if (value !== undefined) {
			const placeholder = `{{${key.toUpperCase()}}}`;
			result = result.replaceAll(placeholder, value);
		}
	}

	// Also support [placeholder] format from original templates
	for (const [key, value] of Object.entries(context)) {
		if (value !== undefined) {
			// Convert camelCase to Title Case for bracket placeholders
			const bracketKey = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
			result = result.replaceAll(`[${bracketKey}]`, value);
			result = result.replaceAll(`[${key.replace(/([A-Z])/g, " $1").toLowerCase()}]`, value);
		}
	}

	const aliases: Record<string, keyof TemplateContext> = {
		"audit command": "securityAuditCommand",
		"build command": "buildCommand",
		"format check command": "formatCheckCommand",
		"format command": "formatCommand",
		"lint command": "lintCommand",
		"security audit command": "securityAuditCommand",
		"test command": "testCommand",
	};

	for (const [alias, key] of Object.entries(aliases)) {
		const value = context[key];
		if (value !== undefined) {
			result = result.replaceAll(`[${alias}]`, value);
		}
	}

	// Resolve $VAR_NAME references from process.env (Symphony spec Section 6.1)
	// Only resolves values that explicitly reference $VAR_NAME — env vars do not
	// globally override template values.
	result = result.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_match, varName) => {
		const envVal = process.env[varName];
		return envVal !== undefined ? envVal : `$${varName}`;
	});

	return result;
}

/**
 * Canonical Reference: .pi/architecture/modules/template-system.md#template-loading
 * Implements: ADR-003
 * Last Sync: 2026-05-31

 * Get template context with language defaults
 */
/**
 * Gradle command equivalents that override Maven defaults for Java projects.
 */
const GRADLE_COMMANDS: Record<string, string> = {
	buildCommand: "gradle build -q",
	testCommand: "gradle test -q",
	lintCommand: "gradle checkstyleMain -q",
	formatCommand: "gradle spotlessApply",
	formatCheckCommand: "gradle spotlessCheck",
	securityAuditCommand: "gradle dependencyCheck",
};

export function getDefaultContext(
	language: Language,
	projectName: string,
	repoTool: RepoTool = "gh",
	buildTool?: "maven" | "gradle",
	groupId?: string,
): TemplateContext {
	const defaults = LANGUAGE_DEFAULTS[language];

	// For Java with Gradle, override Maven defaults with Gradle commands
	const commandOverrides = language === "java" && buildTool === "gradle" ? GRADLE_COMMANDS : {};

	return {
		projectName,
		projectVersion: "0.1.0",
		language,
		buildTool: buildTool ?? (language === "java" ? "maven" : undefined),
		repository: "owner/repo",
		repoTool,
		groupId: groupId ?? `com.${projectName}`,
		buildCommand: commandOverrides.buildCommand ?? defaults.buildCommand,
		testCommand: commandOverrides.testCommand ?? defaults.testCommand,
		lintCommand: commandOverrides.lintCommand ?? defaults.lintCommand,
		formatCommand: commandOverrides.formatCommand ?? defaults.formatCommand,
		formatCheckCommand: commandOverrides.formatCheckCommand ?? defaults.formatCheckCommand,
		securityAuditCommand: commandOverrides.securityAuditCommand ?? defaults.securityAuditCommand,
		errorHandlingPattern: defaults.errorHandlingPattern,
		tracingPattern: defaults.tracingPattern,
		cancellationPattern: defaults.cancellationPattern,
		atomicWritePattern: defaults.atomicWritePattern,
		keyFile1: "src/index.ts",
		keyFile1Purpose: "Main entry point",
		keyFile2: "src/lib/core.ts",
		keyFile2Purpose: "Core library functions",
	};
}

/**
 * Canonical Reference: .pi/architecture/modules/template-system.md#template-loading
 * Implements: ADR-003
 * Last Sync: 2026-05-31

 * Filter validators based on selection
 * CI validator is always included
 */
export function filterValidators(selected: Validator[]): Validator[] {
	// CI is always required
	if (selected.includes("ci")) {
		return selected;
	}
	return ["ci", ...selected];
}

/**
 * Canonical Reference: .pi/architecture/modules/template-system.md#template-loading
 * Implements: ADR-003
 * Last Sync: 2026-05-31

 * Filter workflows based on selection
 */
export function filterWorkflows(selected: Workflow[]): Workflow[] {
	return selected;
}

/**
 * Canonical Reference: .pi/architecture/modules/template-system.md#template-loading
 * Implements: ADR-003
 * Last Sync: 2026-05-31

 * Get list of available scripts based on selected validators
 */
export function getValidatorScripts(validators: Validator[]): string[] {
	return validators.map((v) => `validate-${v}.sh`);
}

/**
 * Canonical Reference: .pi/architecture/modules/template-system.md#template-loading
 * Implements: ADR-003
 * Last Sync: 2026-05-31

 * Get list of workflow prompt files based on selected workflows
 */
export function getWorkflowPrompts(workflows: Workflow[]): string[] {
	return workflows.map((w) => `${w}.md`);
}
