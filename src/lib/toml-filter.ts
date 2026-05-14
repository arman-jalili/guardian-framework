/**
 * TOML-Based Declarative Validation Filter Pipeline
 *
 * Inspired by RTK's toml_filter.rs — provides a declarative pipeline of
 * validation rules configurable via TOML files.
 *
 * Lookup priority (first match wins):
 *   1. `.pi/validators/<name>.toml`    — project-local, committable
 *   2. `~/.config/guardian/filters.toml` — user-global
 *   3. Built-in TOML                    — from templates
 *
 * Pipeline stages (applied in order):
 *   1. strip_ansi           — remove ANSI escape codes
 *   2. replace              — regex substitutions, line-by-line, chainable
 *   3. match_output         — short-circuit: if blob matches pattern, return message
 *   4. strip/keep_lines     — filter lines by regex
 *   5. truncate_lines_at    — truncate each line to N chars
 *   6. head/tail_lines      — keep first/last N lines
 *   7. max_lines            — absolute line cap
 *   8. on_empty             — message if result is empty
 */

// ── Types ──

export interface ReplaceRule {
	pattern: string;
	replacement: string;
}

export interface MatchOutputRule {
	pattern: string;
	message: string;
	unless?: string;
}

export interface ValidatorTestDef {
	name: string;
	input: string;
	expected: string;
}

export interface TomlFilterDef {
	name: string;
	description?: string;
	command: string;
	strip_ansi?: boolean;
	replace?: ReplaceRule[];
	match_output?: MatchOutputRule[];
	strip_lines_matching?: string[];
	keep_lines_matching?: string[];
	truncate_lines_at?: number;
	head_lines?: number;
	tail_lines?: number;
	max_lines?: number;
	on_empty?: string;
	tests?: ValidatorTestDef[];
}

export interface TestOutcome {
	filter_name: string;
	test_name: string;
	passed: boolean;
	actual: string;
	expected: string;
}

export interface VerifyResults {
	outcomes: TestOutcome[];
	filters_without_tests: string[];
}

// ── Minimal TOML Parser (no external deps) ──
// Handles: strings, booleans, numbers, arrays of strings, inline tables

function parseTomlValue(raw: string): unknown {
	const trimmed = raw.trim();
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
	if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		// Array of strings: ["a", "b", "c"]
		const inner = trimmed.slice(1, -1).trim();
		if (!inner) return [];
		return inner.split(",").map((s) => parseTomlValue(s.trim()));
	}
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		// Inline table: { pattern = "x", message = "y" }
		const inner = trimmed.slice(1, -1).trim();
		const obj: Record<string, unknown> = {};
		for (const pair of splitInlineTable(inner)) {
			const eqIdx = pair.indexOf("=");
			if (eqIdx === -1) continue;
			const key = pair.slice(0, eqIdx).trim();
			const val = parseTomlValue(pair.slice(eqIdx + 1).trim());
			obj[key] = val;
		}
		return obj;
	}
	// String (quoted)
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function splitInlineTable(inner: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = "";
	for (const ch of inner) {
		if (ch === "{" || ch === "[") depth++;
		if (ch === "}" || ch === "]") depth--;
		if (ch === "," && depth === 0) {
			parts.push(current.trim());
			current = "";
		} else {
			current += ch;
		}
	}
	if (current.trim()) parts.push(current.trim());
	return parts;
}

function unescapeString(s: string): string {
	return s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"');
}

/**
 * Parse a TOML string into a structured filter definition.
 * This is a minimal parser — handles the subset needed for Guardian validators.
 */
export function parseTomlValidators(content: string): TomlFilterDef[] {
	const filters: TomlFilterDef[] = [];
	const lines = content.split("\n");
	let current: TomlFilterDef | null = null;
	let currentTests: ValidatorTestDef[] = [];
	let inTest = false;
	let testBlock: Partial<ValidatorTestDef> = {};
	let multilineField: string | null = null;
	let multilineLines: string[] = [];

	function flushCurrent() {
		if (current) {
			current.tests = currentTests.length > 0 ? currentTests : undefined;
			filters.push(current);
		}
	}

	function flushMultiline() {
		if (multilineField && current) {
			const raw = multilineLines.join("\n").trim();
			const value = parseTomlValue(raw);
			if (multilineField === "command") current.command = String(value);
			else if (multilineField === "description") current.description = String(value);
			else if (multilineField === "on_empty") current.on_empty = String(value);
			multilineField = null;
			multilineLines = [];
		}
	}

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		// Section header: [filters.<name>] or [[tests.<name>]]
		if (line.startsWith("[[tests.")) {
			flushMultiline();
			inTest = true;
			testBlock = {};
			continue;
		}
		if (line.startsWith("[[tests")) {
			flushMultiline();
			inTest = true;
			testBlock = {};
			continue;
		}
		if (line.startsWith("[filters.")) {
			flushMultiline();
			flushCurrent();
			const name = line.slice("[filters.".length, -1);
			current = { name, command: "", description: undefined };
			currentTests = [];
			inTest = false;
			continue;
		}

		// Inline test field: name = "...", input = "...", expected = "..."
		if (inTest) {
			const eqIdx = line.indexOf("=");
			if (eqIdx === -1) continue;
			const key = line.slice(0, eqIdx).trim();
			const rawVal = line.slice(eqIdx + 1).trim();
			const val = unescapeString(rawVal.replace(/^"/, "").replace(/"$/, ""));
			if (key === "name") testBlock.name = val;
			else if (key === "input") testBlock.input = val;
			else if (key === "expected") testBlock.expected = val;
			if (testBlock.name && testBlock.input && testBlock.expected) {
				currentTests.push(testBlock as ValidatorTestDef);
				testBlock = {};
			}
			continue;
		}

		// Filter field
		const eqIdx = line.indexOf("=");
		if (eqIdx === -1) continue;
		const key = line.slice(0, eqIdx).trim();
		const rawVal = line.slice(eqIdx + 1).trim();

		if (key === "command" || key === "description" || key === "on_empty") {
			if (rawVal.startsWith('"""') || rawVal.startsWith("'''")) {
				multilineField = key;
				const quote = rawVal.startsWith('"""') ? '"""' : "'''";
				const rest = rawVal.slice(quote.length);
				if (rest.endsWith(quote)) {
					// Single-line multiline string
					(current as TomlFilterDef as unknown as Record<string, unknown>)[key] = rest.slice(
						0,
						-quote.length,
					);
					multilineField = null;
				} else {
					multilineLines = [rest];
				}
			} else {
				(current as TomlFilterDef as unknown as Record<string, unknown>)[key] =
					parseTomlValue(rawVal);
			}
			continue;
		}

		(current as TomlFilterDef as unknown as Record<string, unknown>)[key] = parseTomlValue(rawVal);
	}

	flushMultiline();
	flushCurrent();
	return filters;
}

// ── Pipeline Engine ──

function stripAnsi(input: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape code pattern
	return input.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

function truncateUnicode(s: string, maxChars: number): string {
	if (s.length <= maxChars) return s;
	const take = Math.max(0, maxChars - 3);
	return `${[...s].slice(0, take).join("")}...`;
}

/**
 * Apply a compiled filter pipeline to raw output.
 * Pure String → String transformation.
 */
export function applyFilter(filter: TomlFilterDef, stdout: string): string {
	let lines: string[] = stdout.split("\n");

	// Stage 1: strip_ansi
	if (filter.strip_ansi) {
		lines = lines.map(stripAnsi);
	}

	// Stage 2: replace — regex substitutions, line-by-line, chainable
	if (filter.replace?.length) {
		for (const rule of filter.replace) {
			let re: RegExp;
			try {
				re = new RegExp(rule.pattern, "g");
			} catch {
				continue; // Invalid regex — skip
			}
			lines = lines.map((l) => l.replace(re, rule.replacement));
		}
	}

	// Stage 3: match_output — short-circuit on full blob match
	if (filter.match_output?.length) {
		const blob = lines.join("\n");
		for (const rule of filter.match_output) {
			let re: RegExp;
			try {
				re = new RegExp(rule.pattern);
			} catch {
				continue;
			}
			if (re.test(blob)) {
				// Check unless clause
				if (rule.unless) {
					let unlessRe: RegExp;
					try {
						unlessRe = new RegExp(rule.unless);
					} catch {
						continue;
					}
					if (unlessRe.test(blob)) continue; // Errors present — skip
				}
				return rule.message;
			}
		}
	}

	// Stage 4: strip OR keep lines (mutually exclusive)
	if (filter.strip_lines_matching?.length) {
		const patterns = filter.strip_lines_matching.map((p) => {
			try {
				return new RegExp(p);
			} catch {
				return null;
			}
		});
		lines = lines.filter((l) => !patterns.some((p) => p?.test(l)));
	} else if (filter.keep_lines_matching?.length) {
		const patterns = filter.keep_lines_matching.map((p) => {
			try {
				return new RegExp(p);
			} catch {
				return null;
			}
		});
		lines = lines.filter((l) => patterns.some((p) => p?.test(l)));
	}

	// Stage 5: truncate_lines_at
	if (filter.truncate_lines_at) {
		lines = lines.map((l) => truncateUnicode(l, filter.truncate_lines_at as number));
	}

	// Stage 6: head + tail lines
	const total = lines.length;
	if (filter.head_lines && filter.tail_lines) {
		const head = filter.head_lines;
		const tail = filter.tail_lines;
		if (total > head + tail) {
			const result = [...lines.slice(0, head)];
			result.push(`... (${total - head - tail} lines omitted)`);
			result.push(...lines.slice(total - tail));
			lines = result;
		}
	} else if (filter.head_lines) {
		if (total > filter.head_lines) {
			lines = lines.slice(0, filter.head_lines);
			lines.push(`... (${total - filter.head_lines} lines omitted)`);
		}
	} else if (filter.tail_lines) {
		if (total > filter.tail_lines) {
			const omitted = total - filter.tail_lines;
			lines = lines.slice(omitted);
			lines.unshift(`... (${omitted} lines omitted)`);
		}
	}

	// Stage 7: max_lines — absolute cap
	if (filter.max_lines && lines.length > filter.max_lines) {
		const truncated = lines.length - filter.max_lines;
		lines = lines.slice(0, filter.max_lines);
		lines.push(`... (${truncated} lines truncated)`);
	}

	// Stage 8: on_empty
	const result = lines.join("\n");
	if (result.trim() === "" && filter.on_empty) {
		return filter.on_empty;
	}

	return result;
}

// ── Inline Test Runner ──

/**
 * Run inline tests from validator definitions.
 * Returns aggregated pass/fail results.
 */
export function runValidatorTests(filters: TomlFilterDef[]): VerifyResults {
	const outcomes: TestOutcome[] = [];
	const allNames: string[] = [];
	const testedNames = new Set<string>();

	for (const filter of filters) {
		allNames.push(filter.name);
		if (filter.tests?.length === 0) continue;

		testedNames.add(filter.name);
		for (const test of filter.tests as ValidatorTestDef[]) {
			const actual = applyFilter(filter, test.input).trimEnd();
			const expected = test.expected.trimEnd();
			outcomes.push({
				filter_name: filter.name,
				test_name: test.name,
				passed: actual === expected,
				actual,
				expected,
			});
		}
	}

	const filtersWithoutTests = allNames.filter((n) => !testedNames.has(n));
	return { outcomes, filters_without_tests: filtersWithoutTests };
}

// ── Token Savings Estimation ──

function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

export function calculateSavings(
	filter: TomlFilterDef,
	input: string,
): {
	inputTokens: number;
	outputTokens: number;
	savedTokens: number;
	savingsPct: number;
} {
	const output = applyFilter(filter, input);
	const inputTokens = estimateTokens(input);
	const outputTokens = estimateTokens(output);
	const savedTokens = inputTokens - outputTokens;
	const savingsPct = inputTokens > 0 ? (savedTokens / inputTokens) * 100 : 0;
	return { inputTokens, outputTokens, savedTokens, savingsPct };
}
