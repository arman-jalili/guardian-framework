/**
 * Manifest schema and management for Guardian
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { TemplateContext } from "./templates.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

// Manifest file name
export const MANIFEST_FILE = "guardian-manifest.json";

// Current framework version
export const FRAMEWORK_VERSION = "1.0.0";

// Manifest schema version
export const SCHEMA_VERSION = "1.0";

/**
 * File category in manifest
 */
export type FileCategory = "framework" | "user" | "generated";

/**
 * File status in manifest
 */
export type FileStatus = "unchanged" | "modified" | "deleted" | "configured";

/**
 * File record in manifest
 */
export interface FileRecord {
	category: FileCategory;
	originalHash?: string;
	currentHash?: string;
	status: FileStatus;
}

/**
 * Export record in manifest
 */
export interface ExportRecord {
	path: string;
	generatedAt: string | null;
	sourceHash: string | null;
}

/**
 * Full manifest schema
 */
export interface GuardianManifest {
	schemaVersion: string;
	frameworkVersion: string;
	source: string; // Always "pi"
	tools: string[];
	language: string;
	repoTool: string; // "gh" or "glab"
	validators: string[];
	workflows: string[];
	files: Record<string, FileRecord>;
	exports: Record<string, ExportRecord>;
	templateContext?: TemplateContext;
	scaffoldedAt: string;
	lastUpdatedAt: string;
	// Token accounting (Guardian addition)
	tokenStats?: TokenStats;
}

export interface TokenStats {
	totalTokens: number;
	byCategory: Record<string, number>;
	byFile: Record<string, number>;
	lastCalculatedAt: string;
}

/**

/**
 * Calculate SHA-256 hash of file content
 */
export function hashFile(filePath: string): string {
	if (!fs.existsSync(filePath)) {
		return "";
	}
	const content = fs.readFileSync(filePath, "utf-8");
	return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Calculate hash of directory contents
 * Used for sourceHash in exports
 */
export function hashDirectory(dirPath: string): string {
	if (!fs.existsSync(dirPath)) {
		return "";
	}

	const hashes: string[] = [];
	const files = getAllFiles(dirPath);

	for (const file of files.sort()) {
		const relativePath = path.relative(dirPath, file);
		const fileHash = hashFile(file);
		hashes.push(`${relativePath}:${fileHash}`);
	}

	return crypto.createHash("sha256").update(hashes.join("\n")).digest("hex");
}

/**
 * Get all files in directory recursively
 */
function getAllFiles(dirPath: string): string[] {
	const files: string[] = [];

	function walk(dir: string): void {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(fullPath);
			} else if (entry.isFile()) {
				files.push(fullPath);
			}
		}
	}

	walk(dirPath);
	return files;
}

/**
 * Check if manifest exists in target directory
 */
export function manifestExists(targetDir: string): boolean {
	const manifestPath = path.join(targetDir, MANIFEST_FILE);
	return fs.existsSync(manifestPath);
}

/**
 * Read manifest from target directory
 */
export function readManifest(targetDir: string): GuardianManifest | null {
	const manifestPath = path.join(targetDir, MANIFEST_FILE);
	if (!fs.existsSync(manifestPath)) {
		return null;
	}

	try {
		const content = fs.readFileSync(manifestPath, "utf-8");
		return JSON.parse(content) as GuardianManifest;
	} catch {
		return null;
	}
}

/**
 * Write manifest to target directory (atomic write)
 */
export function writeManifest(targetDir: string, manifest: GuardianManifest): void {
	const manifestPath = path.join(targetDir, MANIFEST_FILE);
	const tempPath = `${manifestPath}.tmp`;

	// Write to temp file first
	fs.writeFileSync(tempPath, JSON.stringify(manifest, null, 2), "utf-8");

	// Atomic rename
	fs.renameSync(tempPath, manifestPath);
}

/**
 * Create new manifest for scaffold
 */
export function createManifest(options: {
	tools: string[];
	language: string;
	repoTool: string;
	validators: string[];
	workflows: string[];
	templateContext?: TemplateContext;
}): GuardianManifest {
	const now = new Date().toISOString();

	return {
		schemaVersion: SCHEMA_VERSION,
		frameworkVersion: FRAMEWORK_VERSION,
		source: "pi",
		tools: options.tools,
		language: options.language,
		repoTool: options.repoTool,
		validators: options.validators,
		workflows: options.workflows,
		files: {},
		exports: {},
		templateContext: options.templateContext,
		scaffoldedAt: now,
		lastUpdatedAt: now,
	};
}

/**
 * Add file record to manifest
 */
export function addFileRecord(
	manifest: GuardianManifest,
	filePath: string,
	category: FileCategory,
	content: string,
): void {
	const hash = crypto.createHash("sha256").update(content).digest("hex");

	manifest.files[filePath] = {
		category,
		originalHash: `sha256:${hash}`,
		status: "unchanged",
	};
}

/**
 * Add export record to manifest
 */
export function addExportRecord(
	manifest: GuardianManifest,
	tool: string,
	exportPath: string,
	sourceDir: string,
): void {
	const sourceHash = hashDirectory(sourceDir);

	manifest.exports[tool] = {
		path: exportPath,
		generatedAt: new Date().toISOString(),
		sourceHash: `sha256:${sourceHash}`,
	};
}

/**
 * Update manifest after scaffold
 */
export function updateManifestAfterScaffold(
	targetDir: string,
	manifest: GuardianManifest,
	scaffoldedFiles: Record<string, { category: FileCategory; content: string }>,
): void {
	// Add all scaffolded files to manifest
	for (const [filePath, record] of Object.entries(scaffoldedFiles)) {
		addFileRecord(manifest, filePath, record.category, record.content);
	}

	// Add export records for each selected tool
	for (const tool of manifest.tools) {
		if (tool !== "pi") {
			const exportPath = `.${tool}/`;
			addExportRecord(manifest, tool, exportPath, path.join(targetDir, ".pi"));
		}
	}

	// Update timestamps
	manifest.lastUpdatedAt = new Date().toISOString();

	// Write manifest
	writeManifest(targetDir, manifest);
}

/**
 * Check if file has been modified since scaffold
 */
export function isFileModified(
	manifest: GuardianManifest,
	filePath: string,
	currentContent: string,
): boolean {
	const record = manifest.files[filePath];
	if (!record) {
		return true; // New file, considered modified
	}

	const currentHash = crypto.createHash("sha256").update(currentContent).digest("hex");
	const storedHash = getStoredHash(record);
	if (!storedHash) {
		return true;
	}

	return currentHash !== storedHash;
}

function getStoredHash(record: FileRecord): string | null {
	const hash = record.currentHash ?? record.originalHash;
	return hash ? hash.replace("sha256:", "") : null;
}

/**
 * Get file category from manifest
 */
export function getFileCategory(manifest: GuardianManifest, filePath: string): FileCategory | null {
	const record = manifest.files[filePath];
	return record?.category ?? null;
}

/**
 * Determine file category based on path
 */
export function categorizeFile(relativePath: string): FileCategory {
	// User-editable files
	const userEditable = ["agent/AGENTS.md", "context/project.md", "context/patterns.md"];

	if (userEditable.some((p) => relativePath.includes(p))) {
		return "user";
	}

	// Framework-controlled files
	const frameworkPatterns = [
		"scripts/",
		"extensions/",
		"skills/",
		"prompts/",
		"context/checklists.md",
		"context/output-formats.md",
	];

	if (frameworkPatterns.some((p) => relativePath.startsWith(p))) {
		return "framework";
	}

	// Generated files (in exports)
	if (
		relativePath.startsWith(".claude/") ||
		relativePath.startsWith(".opencode/") ||
		relativePath.startsWith(".agents/")
	) {
		return "generated";
	}

	// Default to framework for pi source files
	return "framework";
}

/**
 * Validate manifest schema
 */
export function validateManifest(manifest: unknown): GuardianManifest | null {
	if (!manifest || typeof manifest !== "object") {
		return null;
	}

	const m = manifest as Record<string, unknown>;

	// Required fields
	const requiredFields = [
		"schemaVersion",
		"frameworkVersion",
		"source",
		"tools",
		"language",
		"validators",
	];

	for (const field of requiredFields) {
		if (!(field in m)) {
			return null;
		}
	}

	// Validate source is "pi"
	if (m.source !== "pi") {
		return null;
	}

	return manifest as GuardianManifest;
}

// ── Token Accounting ──

/**
 * Estimate token count for a string.
 * Rough approximation: ~4 chars per token (consistent with pi's estimateTokens).
 * Accuracy is approximately +/-15% for typical English text and code. Precise
 * tokenization requires a model-specific tokenizer (e.g. tiktoken).
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Calculate token stats for all files in the manifest.
 */
export function calculateTokenStats(targetDir: string, manifest: GuardianManifest): TokenStats {
	const byCategory: Record<string, number> = {};
	const byFile: Record<string, number> = {};
	let totalTokens = 0;

	for (const [filePath, record] of Object.entries(manifest.files)) {
		const fullPath = path.join(targetDir, filePath);
		if (!fs.existsSync(fullPath)) continue;

		const content = fs.readFileSync(fullPath, "utf-8");
		const tokens = estimateTokens(content);

		byFile[filePath] = tokens;
		byCategory[record.category] = (byCategory[record.category] ?? 0) + tokens;
		totalTokens += tokens;
	}

	return {
		totalTokens,
		byCategory,
		byFile,
		lastCalculatedAt: new Date().toISOString(),
	};
}
