/**
 * Project Structure Generator
 *
 * Reads architecture modules and layer decisions, emits a source directory tree
 * with .gitkeep files and placeholder source files with canonical reference headers.
 *
 * Canonical Reference: .pi/architecture/modules/project-scaffolding-epic0.md#structure-generator
 * Last Sync: 2026-06-03
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { tryCatch } from "./result.js";
import type { Language, ProjectCreateOptions } from "./templates.js";

export interface GeneratedFile {
	path: string;
	content: string;
}

export interface StructurePlan {
	modules: string[];
	layers: string[];
	files: GeneratedFile[];
}

/**
 * Read module names from .pi/architecture/modules/*.md files.
 * Extracts the first `# Title` heading from each file.
 */
export function discoverModules(archDir: string): string[] {
	const modulesDir = path.join(archDir, "modules");
	if (!fs.existsSync(modulesDir)) {
		return [];
	}

	const modules: string[] = [];
	try {
		const files = fs.readdirSync(modulesDir);
		for (const file of files) {
			if (!file.endsWith(".md")) continue;
			if (file === "module-template.md") continue;
			const content = fs.readFileSync(path.join(modulesDir, file), "utf-8");
			const match = content.match(/^#\s+(.+)/m);
			if (match) {
				const name = match[1].trim();
				// Strip " Module" suffix if present (common in scaffolded docs)
				modules.push(name.replace(/\s*Module$/i, ""));
			}
		}
	} catch {
		// Ignore read errors
	}
	return modules;
}

/**
 * Determine layer paths by checking for explicit config or falling back to defaults.
 * Layer paths with "/" create nested directories (e.g., "interfaces/http" → interfaces/http/).
 */
export function resolveLayers(
	archDir: string,
	language: Language,
	defaults: Partial<ProjectCreateOptions>,
): string[] {
	// Check module docs for explicit layers field
	const modulesDir = path.join(archDir, "modules");
	if (fs.existsSync(modulesDir)) {
		try {
			const files = fs.readdirSync(modulesDir);
			for (const file of files) {
				if (!file.endsWith(".md")) continue;
				const content = fs.readFileSync(path.join(modulesDir, file), "utf-8");
				const layersMatch = content.match(/^layers:\s*\[(.*?)\]/m);
				if (layersMatch) {
					return layersMatch[1]
						.split(",")
						.map((s) => s.trim().replace(/['"]/g, ""))
						.filter(Boolean);
				}
			}
		} catch {
			// Ignore
		}
	}

	// Check ADRs for delivery mechanism keywords
	const decisionsDir = path.join(archDir, "decisions");
	const adrLayers = new Set<string>();
	adrLayers.add("domain");
	adrLayers.add("application");
	adrLayers.add("infrastructure");

	if (fs.existsSync(decisionsDir)) {
		try {
			const files = fs.readdirSync(decisionsDir);
			for (const file of files) {
				if (!file.endsWith(".md")) continue;
				const content = fs.readFileSync(path.join(decisionsDir, file), "utf-8").toLowerCase();
				if (content.includes("rest") || content.includes("http") || content.includes("grpc")) {
					adrLayers.add("interfaces/http");
				}
				if (content.includes("graphql")) {
					adrLayers.add("interfaces/graphql");
				}
				if (
					content.includes("messaging") ||
					content.includes("event") ||
					content.includes("pub/sub") ||
					content.includes("queue")
				) {
					adrLayers.add("interfaces/messaging");
				}
				if (
					content.includes("cli") ||
					content.includes("scheduled") ||
					content.includes("command")
				) {
					adrLayers.add("interfaces/cli");
				}
			}
		} catch {
			// Ignore
		}
	}

	// If ADRs specified any interface sub-layers, use those; otherwise fall back to defaults
	const hasInterfaceLayers = [...adrLayers].some((l) => l.startsWith("interfaces/"));
	if (hasInterfaceLayers) {
		return [...adrLayers];
	}

	// Fall back to language defaults
	return defaults.layers ?? ["domain", "application", "infrastructure", "interfaces/http"];
}

/**
 * Generate the source directory tree and placeholder files.
 * Returns list of created/planned files.
 */
export function generateProjectStructure(
	targetDir: string,
	options: {
		language: Language;
		groupId: string;
		modules: string[];
		layers: string[];
		dryRun?: boolean;
	},
): StructurePlan {
	const { language, groupId, modules, layers, dryRun } = options;
	const files: GeneratedFile[] = [];

	// Determine source path prefix based on language
	const srcPrefix = language === "java" ? path.join("src", "main", "java") : "src";
	const groupPath = groupId.replace(/\./g, "/");

	for (const moduleName of modules) {
		for (const layer of layers) {
			// Layer paths with "/" become nested directories
			const dirPath = path.join(targetDir, srcPrefix, groupPath, moduleName, layer);

			// Create .gitkeep in each leaf directory
			const gitkeepPath = path.join(dirPath, ".gitkeep");
			files.push({
				path: gitkeepPath,
				content: "",
			});

			if (!dryRun) {
				fs.mkdirSync(dirPath, { recursive: true });
				fs.writeFileSync(gitkeepPath, "", "utf-8");
			}

			// Create a placeholder source file with canonical reference header
			const ext = language === "java" ? ".java" : ".ts";
			const placeholderFileName = `${moduleName}_${layer.replace(/[/ ]/g, "_")}${ext}`;
			const placeholderPath = path.join(dirPath, placeholderFileName);

			const moduleDocName = moduleName.toLowerCase().replace(/\s+/g, "-");
			const canonicalRef = `// Canonical Reference: .pi/architecture/modules/${moduleDocName}.md#${layer}`;

			files.push({
				path: placeholderPath,
				content: `${canonicalRef}\n// ${layer} layer — ${moduleName} module\n`,
			});

			if (!dryRun) {
				fs.writeFileSync(placeholderPath, files[files.length - 1].content, "utf-8");
			}
		}
	}

	return { modules, layers, files };
}

/**
 * Main entry point: discover modules + layers, generate structure.
 */
export function runProjectGenerator(
	targetDir: string,
	archDir: string,
	options: {
		language: Language;
		groupId: string;
		buildTool?: "maven" | "gradle";
		dryRun?: boolean;
		defaults: Partial<ProjectCreateOptions>;
	},
): StructurePlan {
	const modules = options.dryRun
		? ["billing", "notifications", "shared"] // Sample modules for dry-run display
		: discoverModules(archDir);

	const resolvedModules = modules.length > 0 ? modules : ["shared"];
	const layers = resolveLayers(archDir, options.language, options.defaults);

	return generateProjectStructure(targetDir, {
		language: options.language,
		groupId: options.groupId,
		modules: resolvedModules,
		layers,
		dryRun: options.dryRun,
	});
}
