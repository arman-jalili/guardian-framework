/**
 * Template loading utility for GuardianCLI
 *
 * Loads templates from templates/pi/ and templates/languages/
 * Provides template rendering with placeholder substitution
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Template directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_DIR = path.join(__dirname, "..", "..", "templates");
const PI_TEMPLATE_DIR = path.join(TEMPLATE_DIR, "pi");
const LANGUAGES_DIR = path.join(TEMPLATE_DIR, "languages");

// Supported languages
export const SUPPORTED_LANGUAGES = ["typescript", "rust", "python", "go"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

// Supported tools
export const SUPPORTED_TOOLS = ["pi", "claude", "opencode", "agents"] as const;

export type Tool = (typeof SUPPORTED_TOOLS)[number];

// Available validators
export const AVAILABLE_VALIDATORS = [
	"ci",
	"test",
	"security",
	"operations",
	"integration",
] as const;

export type Validator = (typeof AVAILABLE_VALIDATORS)[number];

// Available workflows
export const AVAILABLE_WORKFLOWS = [
	"feature-development",
	"bug-fix",
	"hotfix",
	"refactoring",
	"issue-implementation-series",
] as const;

export type Workflow = (typeof AVAILABLE_WORKFLOWS)[number];

// Placeholder mappings for template substitution
export interface TemplateContext {
	projectName: string;
	projectVersion: string;
	language: Language;
	projectType: string;
	repository: string;
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
};

/**
 * Check if templates directory exists
 */
export function templatesExist(): boolean {
	return fs.existsSync(PI_TEMPLATE_DIR);
}

/**
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
 * Read a template file content
 */
export function readTemplate(relativePath: string): string {
	const fullPath = path.join(PI_TEMPLATE_DIR, relativePath);
	if (!fs.existsSync(fullPath)) {
		throw new Error(`Template not found: ${relativePath}`);
	}
	return fs.readFileSync(fullPath, "utf-8");
}

/**
 * Read language patterns file
 */
export function readLanguagePatterns(language: Language): string {
	const fullPath = path.join(LANGUAGES_DIR, `${language}-patterns.md`);
	if (!fs.existsSync(fullPath)) {
		throw new Error(`Language patterns not found: ${language}`);
	}
	return fs.readFileSync(fullPath, "utf-8");
}

/**
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

	return result;
}

/**
 * Get template context with language defaults
 */
export function getDefaultContext(language: Language, projectName: string): TemplateContext {
	const defaults = LANGUAGE_DEFAULTS[language];

	return {
		projectName,
		projectVersion: "0.1.0",
		language,
		projectType: "Library",
		repository: "owner/repo",
		buildCommand: defaults.buildCommand,
		testCommand: defaults.testCommand,
		lintCommand: defaults.lintCommand,
		formatCommand: defaults.formatCommand,
		formatCheckCommand: defaults.formatCheckCommand,
		securityAuditCommand: defaults.securityAuditCommand,
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
 * Filter workflows based on selection
 */
export function filterWorkflows(selected: Workflow[]): Workflow[] {
	return selected;
}

/**
 * Get list of available scripts based on selected validators
 */
export function getValidatorScripts(validators: Validator[]): string[] {
	return validators.map((v) => `validate-${v}.sh`);
}

/**
 * Get list of workflow prompt files based on selected workflows
 */
export function getWorkflowPrompts(workflows: Workflow[]): string[] {
	return workflows.map((w) => `${w}.md`);
}
