/**
 * Canonical Reference: .pi/architecture/modules/core-libraries.md
 * Implements: Domain Explore CLI — exploration output + LLM integration + glossary updater
 * Issue: #1, #2
 * Last Architecture Sync: 2026-05-31

 * Domain exploration utilities for Guardian.
 *
 * Provides:
 *  - LLM provider abstraction for DDD extraction
 *  - Prompt building and response parsing
 *  - Template rendering for exploration session output
 *  - Ubiquitous language glossary merge/update
 *  - Atomic writes with dry-run support
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Result } from "./result.js";

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * A single term in the ubiquitous language glossary.
 */
export interface UbiquitousTerm {
	/** Canonical term name (e.g., "Result") */
	term: string;
	/** Human-readable definition */
	definition: string;
	/** Bounded context this term belongs to */
	boundedContext: string;
	/** Prohibited aliases/synonyms */
	aliases: string[];
	/** Code examples showing correct usage */
	examples: string;
}

/**
 * A single bounded context discovered during exploration.
 */
export interface BoundedContextInfo {
	name: string;
	description: string;
	entities: string[];
}

/**
 * A single domain entity or value object.
 */
export interface EntityInfo {
	name: string;
	context: string;
	type: "entity" | "value-object" | "aggregate-root";
	description: string;
}

/**
 * A single domain event.
 */
export interface DomainEventInfo {
	name: string;
	context: string;
	description: string;
	triggeredBy: string;
}

/**
 * Full result of a domain exploration session.
 */
export interface ExplorationResult {
	sessionId: string;
	businessContext: string;
	status: "draft" | "validated";
	boundedContexts: BoundedContextInfo[];
	entities: EntityInfo[];
	domainEvents: DomainEventInfo[];
	ubiquitousLanguage: UbiquitousTerm[];
	openQuestions: string;
	aggregateRoots: string;
}

// ── Input Sanitization ──────────────────────────────────────────────────────

/**
 * Maximum length for business context input.
 */
export const MAX_BUSINESS_CONTEXT_LENGTH = 5000;

/**
 * Sanitize a business context string for safe LLM consumption.
 *
 * - Truncates to MAX_BUSINESS_CONTEXT_LENGTH characters
 * - Strips control characters (except newlines and tabs)
 * - Normalizes whitespace
 */
export function sanitizeBusinessContext(context: string): string {
	if (!context) return "";

	// Strip control characters except \n, \r, \t
	let sanitized = context.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

	// Normalize \r\n to \n
	sanitized = sanitized.replace(/\r\n/g, "\n");

	// Truncate
	if (sanitized.length > MAX_BUSINESS_CONTEXT_LENGTH) {
		sanitized = sanitized.slice(0, MAX_BUSINESS_CONTEXT_LENGTH);
		// Try to break at a sentence boundary
		const lastPeriod = sanitized.lastIndexOf(".");
		if (lastPeriod > MAX_BUSINESS_CONTEXT_LENGTH * 0.8) {
			sanitized = sanitized.slice(0, lastPeriod + 1);
		}
	}

	return sanitized.trim();
}

// ── Prompt Building ─────────────────────────────────────────────────────────

/**
 * Build a structured DDD extraction prompt from a business context description.
 */
export function buildExplorationPrompt(context: string): string {
	const sanitized = sanitizeBusinessContext(context);

	return `You are a Domain-Driven Design expert. Analyze the following business description and extract a structured domain model.

Business Context:
${sanitized}

Respond with ONLY valid JSON matching this exact structure. Do not include markdown formatting, code fences, or explanatory text:

{
  "sessionId": "auto-generated-uuid",
  "businessContext": "original description",
  "status": "draft",
  "boundedContexts": [
    {
      "name": "ContextName",
      "description": "Brief description of this bounded context",
      "entities": ["EntityName1", "EntityName2"]
    }
  ],
  "entities": [
    {
      "name": "EntityName",
      "context": "ContextName",
      "type": "entity|value-object|aggregate-root",
      "description": "What this entity represents"
    }
  ],
  "domainEvents": [
    {
      "name": "EventName",
      "context": "ContextName",
      "description": "What happened",
      "triggeredBy": "What caused this event"
    }
  ],
  "ubiquitousLanguage": [
    {
      "term": "CanonicalTerm",
      "definition": "Clear definition",
      "boundedContext": "ContextName",
      "aliases": ["AlternativeName1"],
      "examples": "Usage example"
    }
  ],
  "openQuestions": "Any open questions about the domain",
  "aggregateRoots": "Which entities are aggregate roots and why"
}`;
}

// ── Response Parsing ────────────────────────────────────────────────────────

/**
 * Parse an LLM response string into an ExplorationResult.
 * Handles JSON wrapped in markdown code fences and other common formats.
 */
export function parseExplorationResponse(
	rawResponse: string,
	sessionId?: string,
): Result<ExplorationResult, string> {
	try {
		// Strip markdown code fences if present
		let cleaned = rawResponse.trim();
		const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (jsonMatch) {
			cleaned = jsonMatch[1].trim();
		}

		// Parse JSON
		const parsed = JSON.parse(cleaned) as Record<string, unknown>;

		// Validate required fields with type coercion
		const result: ExplorationResult = {
			sessionId: sessionId ?? (parsed.sessionId as string) ?? crypto.randomUUID(),
			businessContext: coerceString(parsed.businessContext, ""),
			status: "draft",
			boundedContexts: Array.isArray(parsed.boundedContexts)
				? parsed.boundedContexts.map((bc: Record<string, unknown>) => ({
						name: coerceString(bc.name, "Unknown"),
						description: coerceString(bc.description, ""),
						entities: Array.isArray(bc.entities) ? bc.entities.map(String) : [],
					}))
				: [],
			entities: Array.isArray(parsed.entities)
				? parsed.entities.map((e: Record<string, unknown>) => ({
						name: coerceString(e.name, "Unknown"),
						context: coerceString(e.context, ""),
						type: coerceEntityType(e.type),
						description: coerceString(e.description, ""),
					}))
				: [],
			domainEvents: Array.isArray(parsed.domainEvents)
				? parsed.domainEvents.map((ev: Record<string, unknown>) => ({
						name: coerceString(ev.name, "Unknown"),
						context: coerceString(ev.context, ""),
						description: coerceString(ev.description, ""),
						triggeredBy: coerceString(ev.triggeredBy, ""),
					}))
				: [],
			ubiquitousLanguage: Array.isArray(parsed.ubiquitousLanguage)
				? parsed.ubiquitousLanguage.map((t: Record<string, unknown>) => ({
						term: coerceString(t.term, "Unknown"),
						definition: coerceString(t.definition, ""),
						boundedContext: coerceString(t.boundedContext, ""),
						aliases: Array.isArray(t.aliases) ? t.aliases.map(String) : [],
						examples: coerceString(t.examples, ""),
					}))
				: [],
			openQuestions: coerceString(parsed.openQuestions, ""),
			aggregateRoots: coerceString(parsed.aggregateRoots, ""),
		};

		return { ok: true, value: result };
	} catch (err) {
		return {
			ok: false,
			error: `Invalid exploration response: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}

/**
 * Coerce an unknown value to string.
 */
function coerceString(val: unknown, fallback: string): string {
	if (typeof val === "string") return val;
	if (val === null || val === undefined) return fallback;
	return String(val);
}

/**
 * Coerce an unknown value to a valid EntityInfo type.
 */
function coerceEntityType(val: unknown): EntityInfo["type"] {
	if (val === "value-object") return "value-object";
	if (val === "aggregate-root") return "aggregate-root";
	return "entity";
}

// ── Output Validation ───────────────────────────────────────────────────────

/**
 * Validate an ExplorationResult structure.
 * Returns an array of validation warnings (empty = valid).
 */
export function validateDomainExploration(result: ExplorationResult): string[] {
	const warnings: string[] = [];

	if (!result.businessContext) {
		warnings.push("Business context is empty");
	}

	if (result.boundedContexts.length === 0) {
		warnings.push("No bounded contexts identified");
	}

	if (result.entities.length === 0) {
		warnings.push("No entities identified");
	}

	if (result.ubiquitousLanguage.length === 0) {
		warnings.push("No ubiquitous language terms identified");
	}

	// Check for orphaned entities (entity.context doesn't match any bounded context)
	const contextNames = new Set(result.boundedContexts.map((bc) => bc.name));
	const orphanedEntities = result.entities.filter((e) => e.context && !contextNames.has(e.context));
	if (orphanedEntities.length > 0) {
		warnings.push(
			`${orphanedEntities.length} entity(ies) reference non-existent bounded context(s): ${orphanedEntities.map((e) => `"${e.name}" → "${e.context}"`).join(", ")}`,
		);
	}

	// Check for orphaned ubiquitous language terms
	const orphanedTerms = result.ubiquitousLanguage.filter(
		(t) => t.boundedContext && !contextNames.has(t.boundedContext),
	);
	if (orphanedTerms.length > 0) {
		warnings.push(
			`${orphanedTerms.length} term(s) reference non-existent bounded context(s): ${orphanedTerms.map((t) => `"${t.term}" → "${t.boundedContext}"`).join(", ")}`,
		);
	}

	// Check for duplicate entity names across contexts
	const entityNames = new Map<string, string[]>();
	for (const e of result.entities) {
		const existing = entityNames.get(e.name) ?? [];
		existing.push(e.context);
		entityNames.set(e.name, existing);
	}
	for (const [name, contexts] of entityNames) {
		if (contexts.length > 1) {
			warnings.push(`Entity "${name}" appears in multiple contexts: ${contexts.join(", ")}`);
		}
	}

	return warnings;
}

/**
 * Perform a full domain exploration:
 * 1. Sanitize input
 * 2. Build prompt
 * 3. Call LLM (or fallback)
 * 4. Parse response
 * 5. Validate output
 * 6. Update glossary
 * 7. Write exploration session
 */
export async function exploreDomain(
	context: string,
	options?: {
		projectDir?: string;
		sessionId?: string;
		dryRun?: boolean;
	},
): Promise<{
	sessionId: string;
	promptPath?: string;
	warnings: string[];
}> {
	const projectDir = options?.projectDir ?? process.cwd();
	const dryRun = options?.dryRun ?? false;
	const sessionId = options?.sessionId ?? crypto.randomUUID();
	const explorationDir = path.join(projectDir, ".pi", "domain", "exploration");
	if (!fs.existsSync(explorationDir)) {
		fs.mkdirSync(explorationDir, { recursive: true });
	}

	// 1. Sanitize
	const sanitized = sanitizeBusinessContext(context);

	// 2. Build prompt
	const prompt = buildExplorationPrompt(sanitized);

	// 3. Write prompt file
	const promptContent = [
		"# Domain Exploration Prompt",
		"",
		`**Session:** ${sessionId}`,
		`**Created:** ${new Date().toISOString()}`,
		"**Status:** awaiting-response",
		"",
		"---",
		"",
		prompt,
	].join("\n");

	const promptPath = path.join(explorationDir, `${sessionId}.prompt.md`);
	if (!dryRun) {
		fs.writeFileSync(promptPath, promptContent, "utf-8");
		console.error("[domain-explore] Prompt written to: ${promptPath}");
	}

	const warnings: string[] = [];
	return { sessionId, promptPath: dryRun ? undefined : promptPath, warnings };
}

/**
 * Process an LLM response to a domain exploration prompt and convert it into
 * an exploration session with glossary updates.
 *
 * Usage:
 *   1. `guardian domain explore --context "..."` writes a .prompt.md file
 *   2. Feed that prompt to your LLM (or use pi's domain_explore extension)
 *   3. `guardian domain answer <session-id> <response.json>` calls this
 *
 * @param sessionId    The exploration session ID (from prompt filename)
 * @param responseJson Raw JSON response from the LLM
 * @param options      projectDir, dryRun
 */
export function answerExploration(
	sessionId: string,
	responseJson: string,
	options?: {
		projectDir?: string;
		dryRun?: boolean;
	},
): {
	sessionId: string;
	explorationPath?: string;
	glossaryResult?: GlossaryUpdateResult;
	warnings: string[];
} {
	const projectDir = options?.projectDir ?? process.cwd();
	const dryRun = options?.dryRun ?? false;
	const warnings: string[] = [];

	// 1. Parse the LLM response
	const parsed = parseExplorationResponse(responseJson, sessionId);
	if (!parsed.ok) {
		throw new Error("Failed to parse LLM response: ${parsed.error}");
	}

	const result = parsed.value;

	// 2. Validate
	const validationWarnings = validateDomainExploration(result);
	warnings.push(...validationWarnings);

	// 3. Write exploration session
	const explorationPath = writeExplorationSession(result, projectDir, dryRun);

	// 4. Update glossary
	const glossaryResult = updateUbiquitousLanguage(result.ubiquitousLanguage, {
		projectDir,
		dryRun,
	});

	return {
		sessionId,
		explorationPath: dryRun ? undefined : explorationPath,
		glossaryResult,
		warnings,
	};
}
// ── Domain Scaffold ─────────────────────────────────────────────────────────

/**
 * Result of a scaffold operation.
 */
export interface ScaffoldResult {
	/** Number of module documents generated */
	modulesGenerated: number;
	/** Paths of generated module documents */
	modules: string[];
	/** Warnings from the scaffold process */
	warnings: string[];
}

/**
 * Options for scaffolding architecture modules from an exploration session.
 */
export interface ScaffoldOptions {
	projectDir?: string;
	dryRun?: boolean;
}

/**
 * Read an exploration session file and parse it back into an ExplorationResult.
 */
export function readExplorationSession(
	sessionId: string,
	projectDir?: string,
): ExplorationResult | null {
	const root = projectDir ?? process.cwd();
	const filePath = path.join(root, ".pi", "domain", "exploration", `${sessionId}.md`);

	if (!fs.existsSync(filePath)) {
		return null;
	}

	const content = fs.readFileSync(filePath, "utf-8");

	// Extract front-matter
	const frontMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontMatch) return null;

	const frontRaw = frontMatch[1];
	const getField = (name: string): string => {
		const m = frontRaw.match(new RegExp(`${name}:\\s*\"(.+?)\"`));
		return m ? m[1] : "";
	};

	// Extract tables from body
	const body = content.slice(frontMatch[0].length);

	// Parse bounded contexts table
	const bcTable = extractTable(body, "Bounded Contexts");
	const boundedContexts = bcTable
		.filter((row) => row.length >= 3 && row[0] !== "Context")
		.map((row) => ({
			name: row[0].trim(),
			description: row[1].trim(),
			entities: row[2].split(",").map((s: string) => s.trim()),
		}));

	// Parse entities table
	const entityTable = extractTable(body, "Entities");
	const entities = entityTable
		.filter((row) => row.length >= 4 && row[0] !== "Entity")
		.map((row) => ({
			name: row[0].trim(),
			context: row[1].trim(),
			type: coerceEntityType(row[2].trim()),
			description: row[3].trim(),
		}));

	// Parse domain events table
	const eventTable = extractTable(body, "Domain Events");
	const domainEvents = eventTable
		.filter((row) => row.length >= 4 && row[0] !== "Event")
		.map((row) => ({
			name: row[0].trim(),
			context: row[1].trim(),
			description: row[2].trim(),
			triggeredBy: row[3].trim(),
		}));

	// Parse ubiquitous language table
	const ulTable = extractTable(body, "Ubiquitous Language");
	const ubiquitousLanguage = ulTable
		.filter((row) => row.length >= 4 && row[0] !== "Term")
		.map((row) => ({
			term: row[0].trim(),
			definition: row[1].trim(),
			boundedContext: row[2].trim(),
			aliases: row[3]
				.split(",")
				.map((s: string) => s.trim())
				.filter(Boolean),
			examples: "",
		}));

	// Extract open questions section
	const oqMatch = body.match(/Open Questions\n+([\s\S]*?)(?:\n##|$)/);
	const openQuestions = oqMatch ? oqMatch[1].trim() : "";

	// Extract aggregate roots section
	const arMatch = body.match(/Aggregate Roots\n+([\s\S]*?)(?:\n##|$)/);
	const aggregateRoots = arMatch ? arMatch[1].trim() : "";

	return {
		sessionId: getField("session_id") || sessionId,
		businessContext: getField("business_context") || "",
		status: (getField("status") as "draft" | "validated") || "draft",
		boundedContexts,
		entities,
		domainEvents,
		ubiquitousLanguage,
		openQuestions,
		aggregateRoots,
	};
}

/**
 * Extract a markdown table from a section in the body text.
 */
function extractTable(body: string, sectionName: string): string[][] {
	// Find the section
	const sectionRegex = new RegExp(`## ${sectionName}\\n+([\\s\\S]*?)(?:\\n##|$)`);
	const sectionMatch = body.match(sectionRegex);
	if (!sectionMatch) return [];

	const section = sectionMatch[1];
	const lines = section.split("\n").filter((l) => l.startsWith("|"));

	// Skip header row and separator
	const dataLines = lines.filter((l) => !l.includes("|---") && !l.includes("| ---"));

	return dataLines.map((line) => {
		const trimmed = line.trim();
		const content = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
		const withoutTrailing = content.endsWith("|") ? content.slice(0, -1) : content;
		return withoutTrailing.split("|").map((s) => s.trim());
	});
}

/**
 * Scaffold architecture module documents from an exploration session.
 *
 * Reads the exploration file and generates .pi/architecture/modules/<context>.md
 * for each bounded context found.
 */
export function scaffoldFromExploration(
	sessionId: string,
	options?: ScaffoldOptions,
): ScaffoldResult {
	const projectDir = options?.projectDir ?? process.cwd();
	const dryRun = options?.dryRun ?? false;

	const result = readExplorationSession(sessionId, projectDir);
	if (!result) {
		throw new Error(`Exploration session not found: ${sessionId}`);
	}

	const modulesDir = path.join(projectDir, ".pi", "architecture", "modules");
	const modules: string[] = [];
	const warnings: string[] = [];

	const timestamp = new Date().toISOString().split("T")[0];

	for (const bc of result.boundedContexts) {
		const moduleName = bc.name
			.replace(/([a-z])([A-Z])/g, "$1-$2")
			.replace(/[\s_]+/g, "-")
			.toLowerCase();

		const fileName = `${moduleName}.md`;
		const filePath = path.join(modulesDir, fileName);

		// Find entities for this context
		const contextEntities = result.entities.filter((e) => e.context === bc.name);
		const contextEvents = result.domainEvents.filter((ev) => ev.context === bc.name);
		const contextTerms = result.ubiquitousLanguage.filter((t) => t.boundedContext === bc.name);

		// Check for duplicate module name
		if (!dryRun && fs.existsSync(filePath)) {
			warnings.push(`Module already exists, will be overwritten: ${fileName}`);
		}

		// Build module doc
		let content = `# ${bc.name}

## Status
**Status:** Planned
**Last reviewed:** ${timestamp}
**Source session:** ${sessionId}

## Description

${bc.description}

## Components

`;

		if (contextEntities.length === 0) {
			content += "No entities defined yet.\n\n";
		} else {
			for (const entity of contextEntities) {
				const typeLabel =
					entity.type === "aggregate-root"
						? "Aggregate Root"
						: entity.type === "value-object"
							? "Value Object"
							: "Entity";
				content += `### ${entity.name}\n\n`;
				content += `**Type:** ${typeLabel}\n`;
				content += `**Description:** ${entity.description}\n\n`;
			}
		}

		content += "## Domain Events\n\n";
		if (contextEvents.length === 0) {
			content += "No domain events defined yet.\n\n";
		} else {
			for (const ev of contextEvents) {
				content += `- **${ev.name}** — ${ev.description} (triggered by: ${ev.triggeredBy})\n`;
			}
			content += "\n";
		}

		content += "## Ubiquitous Language\n\n";
		if (contextTerms.length === 0) {
			content += "No terms defined yet.\n\n";
		} else {
			content += "| Term | Definition | Aliases |\n";
			content += "|------|-----------|---------|\n";
			for (const t of contextTerms) {
				content += `| ${t.term} | ${t.definition} | ${t.aliases.join(", ")} |\n`;
			}
			content += "\n";
		}

		content += "## Dependencies\n\n";
		content += "None identified yet.\n";

		if (!dryRun) {
			fs.mkdirSync(modulesDir, { recursive: true });
			const tempPath = `${filePath}.tmp`;
			fs.writeFileSync(tempPath, content, "utf-8");
			fs.renameSync(tempPath, filePath);
		}

		modules.push(fileName);
	}

	if (modules.length === 0) {
		warnings.push("No bounded contexts found in exploration session");
	}

	return {
		modulesGenerated: modules.length,
		modules,
		warnings,
	};
}

/**
 * List exploration sessions available in the project.
 */
export function listExplorationSessions(projectDir?: string): string[] {
	const root = projectDir ?? process.cwd();
	const explorationDir = path.join(root, ".pi", "domain", "exploration");

	if (!fs.existsSync(explorationDir)) {
		return [];
	}

	return fs
		.readdirSync(explorationDir)
		.filter((f) => f.endsWith(".md") && !f.endsWith(".raw.json"))
		.map((f) => f.replace(/\.md$/, ""))
		.sort()
		.reverse();
}

/**
 * Options for updating the ubiquitous language glossary.
 */
export interface GlossaryUpdateOptions {
	/** Path to the glossary markdown file (default: .pi/domain/ubiquitous-language.md) */
	glossaryPath?: string;
	/** If true, show diff without writing */
	dryRun?: boolean;
	/** Project root directory (default: process.cwd()) */
	projectDir?: string;
}

/**
 * Result of a glossary update operation.
 */
export interface GlossaryUpdateResult {
	/** Number of terms added */
	added: number;
	/** Number of terms skipped (duplicates) */
	skipped: number;
	/** Full diff output for dry-run mode */
	diff: string;
	/** Whether the file was actually written */
	written: boolean;
}

// ── Template Rendering ──────────────────────────────────────────────────────

/**
 * Load the exploration template from the package templates directory.
 */
function loadExplorationTemplate(): string {
	const possiblePaths = [
		// From dist/ -> project root
		path.join(__dirname, "..", "..", "templates", "pi", "domain", "exploration.md"),
		// From src/lib/ -> project root (dev mode)
		path.join(__dirname, "..", "..", "..", "templates", "pi", "domain", "exploration.md"),
		// From linked bin
		path.resolve(
			path.dirname(fs.realpathSync(__filename)),
			"..",
			"..",
			"..",
			"templates",
			"pi",
			"domain",
			"exploration.md",
		),
	];

	for (const p of possiblePaths) {
		if (fs.existsSync(p)) {
			return fs.readFileSync(p, "utf-8");
		}
	}

	throw new Error("Exploration template not found in templates/pi/domain/exploration.md");
}

/**
 * Render an exploration result into the output template.
 *
 * Substitutes all {{PLACEHOLDER}} tokens with structured table data.
 */
export function renderExplorationTemplate(result: ExplorationResult): string {
	const template = loadExplorationTemplate();

	// Build tables
	const boundedContextsTable = result.boundedContexts
		.map((bc) => `| ${bc.name} | ${bc.description} | ${bc.entities.join(", ")} |`)
		.join("\n");

	const entitiesTable = result.entities
		.map((e) => `| ${e.name} | ${e.context} | ${e.type} | ${e.description} |`)
		.join("\n");

	const domainEventsTable = result.domainEvents
		.map((ev) => `| ${ev.name} | ${ev.context} | ${ev.description} | ${ev.triggeredBy} |`)
		.join("\n");

	const ubiquitousLanguageTable = result.ubiquitousLanguage
		.map((t) => `| ${t.term} | ${t.definition} | ${t.boundedContext} | ${t.aliases.join(", ")} |`)
		.join("\n");

	const aggregateRoots = result.aggregateRoots ? result.aggregateRoots : "None identified yet.";

	const openQuestions = result.openQuestions ? result.openQuestions : "No open questions.";

	// Substitute placeholders
	return template
		.replaceAll("{{SESSION_ID}}", result.sessionId)
		.replaceAll("{{CREATED_DATE}}", new Date().toISOString().split("T")[0])
		.replaceAll("{{BUSINESS_CONTEXT}}", escapePlaceholder(result.businessContext))
		.replaceAll("{{STATUS}}", result.status)
		.replaceAll("{{BOUNDED_CONTEXTS_TABLE}}", boundedContextsTable || "None identified yet.")
		.replaceAll("{{ENTITIES_TABLE}}", entitiesTable || "None identified yet.")
		.replaceAll("{{DOMAIN_EVENTS_TABLE}}", domainEventsTable || "None identified yet.")
		.replaceAll("{{UBIQUITOUS_LANGUAGE_TABLE}}", ubiquitousLanguageTable || "None identified yet.")
		.replaceAll("{{OPEN_QUESTIONS}}", openQuestions)
		.replaceAll("{{AGGREGATE_ROOTS}}", aggregateRoots);
}

/**
 * Escape a string for safe placeholder substitution.
 */
function escapePlaceholder(value: string): string {
	return value.replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// ── Glossary Parsing ────────────────────────────────────────────────────────

/**
 * Parse the ubiquitous language glossary markdown and return the existing terms.
 */
export function parseUbiquitousLanguageGlossary(filePath: string): UbiquitousTerm[] {
	if (!fs.existsSync(filePath)) {
		return [];
	}

	const content = fs.readFileSync(filePath, "utf-8");
	const terms: UbiquitousTerm[] = [];
	const lines = content.split("\n");
	let inTable = false;

	for (const line of lines) {
		// Detect table rows (lines starting with "|")
		if (!line.startsWith("|") || !line.includes("|")) {
			if (inTable && line.trim() === "") {
				inTable = false; // blank line after table ends it
			}
			continue;
		}

		// Skip header row and separator row by checking for non-term first column
		const firstCol = line.split("|")[1]?.trim() ?? "";
		if (
			firstCol === "Term" ||
			firstCol === "------" ||
			firstCol.match(/^-+$/) ||
			line.includes("|------|-----------|----------------")
		) {
			inTable = true;
			continue;
		}

		if (!inTable) continue;

		// Parse row: | Term | Definition | Bounded Context | Aliases/Synonyms | Examples |
		const columns = parseTableRow(line);
		if (columns.length >= 5) {
			const term = columns[0].trim();
			const definition = columns[1].trim();
			const boundedContext = columns[2].trim();
			const aliasesStr = columns[3].trim();
			const examples = columns[4].trim();

			if (term) {
				const aliases = aliasesStr
					? aliasesStr
							.split(",")
							.map((a) => a.trim())
							.filter(Boolean)
					: [];

				terms.push({ term, definition, boundedContext, aliases, examples });
			}
		}
	}

	return terms;
}

/**
 * Parse a pipe-delimited markdown table row into column values.
 */
function parseTableRow(row: string): string[] {
	// Strip leading/trailing pipes and split
	const trimmed = row.trim();
	const content = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
	const withoutTrailing = content.endsWith("|") ? content.slice(0, -1) : content;

	// Split by pipe, preserving inline code backticks
	const columns: string[] = [];
	let current = "";
	let inBacktick = false;

	for (const char of withoutTrailing) {
		if (char === "`") {
			inBacktick = !inBacktick;
			current += char;
		} else if (char === "|" && !inBacktick) {
			columns.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}
	columns.push(current.trim());

	return columns;
}

const GLOSSARY_TABLE_HEADER =
	"| Term | Definition | Bounded Context | Aliases/Synonyms | Examples |\n|------|-----------|----------------|-----------------|---------|";

// ── Glossary Update ─────────────────────────────────────────────────────────

/**
 * Build the glossary markdown content from a list of UbiquitousTerm objects.
 * Always includes the proper header row and separator.
 */
export function renderGlossaryTable(terms: UbiquitousTerm[]): string {
	// Sort alphabetically by term
	const sorted = [...terms].sort((a, b) => a.term.localeCompare(b.term));

	const rows = sorted.map((t) => {
		const aliasesStr = t.aliases.length > 0 ? t.aliases.join(", ") : "";
		return `| ${t.term} | ${t.definition} | ${t.boundedContext} | ${aliasesStr} | ${t.examples} |`;
	});

	return rows.join("\n");
}

/**
 * Update the ubiquitous language glossary with new terms.
 *
 * Reads the existing glossary, merges new terms (skipping duplicates),
 * sorts alphabetically, and writes back using atomic write.
 * Supports dry-run mode that returns diff without writing.
 */
export function updateUbiquitousLanguage(
	newTerms: UbiquitousTerm[],
	options: GlossaryUpdateOptions = {},
): GlossaryUpdateResult {
	const projectDir = options.projectDir ?? process.cwd();
	const glossaryPath =
		options.glossaryPath ?? path.join(projectDir, ".pi", "domain", "ubiquitous-language.md");
	const dryRun = options.dryRun ?? false;

	// Read existing glossary
	const existingTerms = parseUbiquitousLanguageGlossary(glossaryPath);

	// Build a set of existing term names for dedup
	const existingNames = new Set(existingTerms.map((t) => t.term.toLowerCase()));

	// Filter out duplicates
	const uniqueNewTerms = newTerms.filter((t) => !existingNames.has(t.term.toLowerCase()));
	const skipped = newTerms.length - uniqueNewTerms.length;

	// Merge and sort
	const mergedTerms = [...existingTerms, ...uniqueNewTerms];
	mergedTerms.sort((a, b) => a.term.localeCompare(b.term));

	// Build diff
	const addedLines = uniqueNewTerms.map((t) => `  + ${t.term}`);
	const diff =
		addedLines.length > 0
			? `Would add ${addedLines.length} term(s):\n${addedLines.join("\n")}`
			: "No new terms to add.";

	if (dryRun) {
		return {
			added: uniqueNewTerms.length,
			skipped,
			diff,
			written: false,
		};
	}

	// Read original file to extract preamble (everything before the glossary table data)
	let preamble = "";
	if (fs.existsSync(glossaryPath)) {
		const originalContent = fs.readFileSync(glossaryPath, "utf-8");
		const glossaryIndex = originalContent.indexOf("## Glossary");
		if (glossaryIndex !== -1) {
			// Take everything up to but not including "## Glossary"
			preamble = originalContent.slice(0, glossaryIndex);
		} else {
			preamble = originalContent;
		}
	} else {
		preamble = `# Ubiquitous Language

> Canonical glossary for Guardian Framework.

---`;
	}

	// Rebuild full content
	const glossaryTable = renderGlossaryTable(mergedTerms);
	let fullContent = `${preamble.replace(/\n*$/, "\n")}\n\n## Glossary\n\n${GLOSSARY_TABLE_HEADER}\n${glossaryTable}\n`;

	// Append the "Adding New Terms" section from the original file if it existed
	if (fs.existsSync(glossaryPath)) {
		const originalForAppend = fs.readFileSync(glossaryPath, "utf-8");
		const addingSectionIndex = originalForAppend.indexOf("## Adding New Terms");
		if (addingSectionIndex !== -1) {
			fullContent += `\n${originalForAppend.slice(addingSectionIndex)}`;
		}
	}

	// Atomic write
	const tempPath = `${glossaryPath}.tmp`;
	fs.mkdirSync(path.dirname(glossaryPath), { recursive: true });
	fs.writeFileSync(tempPath, fullContent, "utf-8");
	fs.renameSync(tempPath, glossaryPath);

	return {
		added: uniqueNewTerms.length,
		skipped,
		diff,
		written: true,
	};
}

/**
 * Write an exploration session output file.
 * Creates .pi/domain/exploration/<session-id>.md
 */
export function writeExplorationSession(
	result: ExplorationResult,
	projectDir?: string,
	dryRun?: boolean,
): string {
	const root = projectDir ?? process.cwd();
	const explorationDir = path.join(root, ".pi", "domain", "exploration");
	const outputPath = path.join(explorationDir, `${result.sessionId}.md`);

	const content = renderExplorationTemplate(result);

	if (dryRun) {
		return `[dry-run] Would write to ${outputPath}\n\n${content}`;
	}

	fs.mkdirSync(explorationDir, { recursive: true });

	// Atomic write
	const tempPath = `${outputPath}.tmp`;
	fs.writeFileSync(tempPath, content, "utf-8");
	fs.renameSync(tempPath, outputPath);

	return outputPath;
}
