/**
 * Language-Aware Code Filtering for Guardian
 *
 * Strips comments, function bodies, and boilerplate from source code to save
 * tokens when reading files. Inspired by RTK's filter.rs.
 *
 * Three filter levels:
 *   - None: Keep everything (0% reduction)
 *   - Minimal: Strip comments only (20-40% reduction)
 *   - Aggressive: Strip comments + function bodies (60-90% reduction)
 *
 * Language support: Rust, Python, JavaScript, TypeScript, Go, C, C++, Java, Ruby, Shell
 */

// ── Types ──

export type FilterLevel = "none" | "minimal" | "aggressive";

export type Language =
	| "rust"
	| "python"
	| "javascript"
	| "typescript"
	| "go"
	| "c"
	| "cpp"
	| "java"
	| "ruby"
	| "shell"
	| "data"
	| "unknown";

interface CommentPatterns {
	line: string | null;
	blockStart: string | null;
	blockEnd: string | null;
	docLine: string | null;
	docBlockStart: string | null;
}

// ── Language Detection ──

const EXTENSION_MAP: Record<string, Language> = {
	rs: "rust",
	py: "python",
	pyw: "python",
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	ts: "typescript",
	tsx: "typescript",
	go: "go",
	c: "c",
	h: "c",
	cpp: "cpp",
	cc: "cpp",
	cxx: "cpp",
	hpp: "cpp",
	java: "java",
	rb: "ruby",
	sh: "shell",
	bash: "shell",
	zsh: "shell",
	json: "data",
	jsonc: "data",
	yaml: "data",
	yml: "data",
	toml: "data",
	xml: "data",
	csv: "data",
	markdown: "data",
	md: "data",
	lock: "data",
	env: "data",
};

export function detectLanguage(filename: string): Language {
	const ext = filename.split(".").pop()?.toLowerCase();
	if (!ext) return "unknown";
	return EXTENSION_MAP[ext] ?? "unknown";
}

function getCommentPatterns(lang: Language): CommentPatterns {
	switch (lang) {
		case "rust":
			return {
				line: "//",
				blockStart: "/*",
				blockEnd: "*/",
				docLine: "///",
				docBlockStart: "/**",
			};
		case "python":
			return {
				line: "#",
				blockStart: '"""',
				blockEnd: '"""',
				docLine: null,
				docBlockStart: '"""',
			};
		case "javascript":
		case "typescript":
		case "go":
		case "c":
		case "cpp":
		case "java":
			return {
				line: "//",
				blockStart: "/*",
				blockEnd: "*/",
				docLine: null,
				docBlockStart: "/**",
			};
		case "ruby":
			return {
				line: "#",
				blockStart: "=begin",
				blockEnd: "=end",
				docLine: null,
				docBlockStart: null,
			};
		case "shell":
			return {
				line: "#",
				blockStart: null,
				blockEnd: null,
				docLine: null,
				docBlockStart: null,
			};
		default:
			return { line: null, blockStart: null, blockEnd: null, docLine: null, docBlockStart: null };
	}
}

// ── Filter Implementations ──

/**
 * Minimal filter: strip comments, preserve docstrings, normalize blank lines.
 */
function minimalFilter(content: string, lang: Language): string {
	const patterns = getCommentPatterns(lang);
	const lines: string[] = [];
	let inBlockComment = false;
	let inDocstring = false;

	for (const line of content.split("\n")) {
		const trimmed = line.trim();

		// Block comments
		if (patterns.blockStart && patterns.blockEnd) {
			if (
				!inDocstring &&
				trimmed.includes(patterns.blockStart) &&
				!trimmed.startsWith(patterns.docBlockStart ?? "###")
			) {
				inBlockComment = true;
			}
			if (inBlockComment) {
				if (trimmed.includes(patterns.blockEnd)) inBlockComment = false;
				continue;
			}
		}

		// Python docstrings (keep them)
		if (lang === "python" && trimmed.startsWith('"""')) {
			inDocstring = !inDocstring;
			lines.push(line);
			continue;
		}

		if (inDocstring) {
			lines.push(line);
			continue;
		}

		// Single-line comments (keep doc comments)
		if (patterns.line && trimmed.startsWith(patterns.line)) {
			if (patterns.docLine && trimmed.startsWith(patterns.docLine)) {
				lines.push(line);
			}
			continue;
		}

		lines.push(line);
	}

	// Normalize multiple blank lines to max 2
	let result = lines.join("\n");
	result = result.replace(/\n{3,}/g, "\n\n");
	return result.trim();
}

/**
 * Aggressive filter: keep only signatures, imports, constants.
 * Replace function bodies with `// ... implementation`.
 */
function aggressiveFilter(content: string, lang: Language): string {
	// Data formats must never be code-filtered
	if (lang === "data") return minimalFilter(content, lang);

	const minimal = minimalFilter(content, lang);
	const lines: string[] = [];
	let braceDepth = 0;
	let inImplBody = false;

	// Language-specific patterns
	const importPatterns: Record<Language, RegExp> = {
		rust: /^(use |extern crate)/,
		python: /^(import |from .+ import)/,
		javascript: /^(import |require\()/,
		typescript: /^(import |require\()/,
		go: /^import /,
		c: /^#include/,
		cpp: /^#include/,
		java: /^import /,
		ruby: /^require /,
		shell: /^source /,
		data: /^$/,
		unknown: /^(import |use |require)/,
	};

	const sigPatterns: Record<Language, RegExp> = {
		rust: /^(pub\s+)?(async\s+)?(fn|struct|enum|trait|impl|type|const|static)\s+\w/,
		python: /^(async\s+)?(def|class)\s+\w/,
		javascript: /^(async\s+)?(function|class|const|let|var)\s+\w/,
		typescript: /^(export\s+)?(async\s+)?(function|class|const|let|var|interface|type|enum)\s+\w/,
		go: /^(func|type|const|var)\s+\w/,
		c: /^\w[\w\s*]+\s+\w+\s*\(/,
		cpp: /^\w[\w\s*&:]+\s+\w+\s*\(/,
		java: /^(public|private|protected|static|final|\s)*\s*\w[\w\s<>[\]]+\s+\w+\s*\(/,
		ruby: /^(def|class|module)\s+\w/,
		shell: /^(\w+\s*\(\)\s*\{|function\s+\w)/,
		data: /^$/,
		unknown: /^(function|def|fn|func|class|struct)\s+\w/,
	};

	const importRe = importPatterns[lang];
	const sigRe = sigPatterns[lang];

	for (const line of minimal.split("\n")) {
		const trimmed = line.trim();

		// Always keep imports
		if (importRe.test(trimmed)) {
			lines.push(line);
			continue;
		}

		// Always keep signatures
		if (sigRe.test(trimmed)) {
			lines.push(line);
			inImplBody = true;
			braceDepth = 0;
			continue;
		}

		// Track brace depth for implementation bodies
		if (inImplBody) {
			const openBraces = (trimmed.match(/{/g) ?? []).length;
			const closeBraces = (trimmed.match(/}/g) ?? []).length;
			braceDepth += openBraces;
			braceDepth -= closeBraces;

			// Keep opening/closing braces
			if (braceDepth <= 1 && (trimmed === "{" || trimmed === "}" || trimmed.endsWith("{"))) {
				lines.push(line);
			}

			if (braceDepth <= 0) {
				inImplBody = false;
				if (!trimmed.includes("}") || trimmed.trim() === "}") {
					lines.push("    // ... implementation");
				}
			}
			continue;
		}

		// Keep type definitions, constants, etc.
		if (
			trimmed.startsWith("const ") ||
			trimmed.startsWith("static ") ||
			trimmed.startsWith("let ") ||
			trimmed.startsWith("pub const ") ||
			trimmed.startsWith("pub static ") ||
			trimmed.startsWith("#[") // Rust attributes
		) {
			lines.push(line);
		}
	}

	return lines.join("\n").trim();
}

// ── Public API ──

/**
 * Filter source code at the given level.
 */
export function filterCode(content: string, lang: Language, level: FilterLevel): string {
	switch (level) {
		case "none":
			return content;
		case "minimal":
			return minimalFilter(content, lang);
		case "aggressive":
			return aggressiveFilter(content, lang);
	}
}

/**
 * Smart truncate: prioritize structurally important lines.
 * No synthetic comment markers that confuse AI agents.
 */
export function smartTruncate(content: string, maxLines: number, lang: Language): string {
	const lines = content.split("\n");
	if (lines.length <= maxLines) return content;

	const kept: string[] = [];
	let keptCount = 0;
	const sigRe =
		lang === "unknown"
			? /^(function|def|fn|func|class|struct|import|use)\s+\w/
			: /^(function|def|fn|func|class|struct|import|use)\s+\w/;

	for (const line of lines) {
		const trimmed = line.trim();
		const isImportant =
			sigRe.test(trimmed) ||
			trimmed.startsWith("pub ") ||
			trimmed.startsWith("export ") ||
			trimmed === "{" ||
			trimmed === "}";

		if (isImportant || keptCount < maxLines / 2) {
			kept.push(line);
			keptCount++;
		}

		if (keptCount >= maxLines - 1) break;
	}

	kept.push(`[${lines.length - keptCount} more lines]`);
	return kept.join("\n");
}

/**
 * Estimate token savings from filtering.
 */
export function estimateFilterSavings(
	original: string,
	filtered: string,
): {
	originalTokens: number;
	filteredTokens: number;
	savedTokens: number;
	savingsPct: number;
} {
	const originalTokens = Math.ceil(original.length / 4);
	const filteredTokens = Math.ceil(filtered.length / 4);
	const savedTokens = originalTokens - filteredTokens;
	const savingsPct = originalTokens > 0 ? (savedTokens / originalTokens) * 100 : 0;
	return { originalTokens, filteredTokens, savedTokens, savingsPct };
}
