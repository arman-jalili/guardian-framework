/**
 * Tests for domain-explorer.ts
 *
 * Covers:
 *  - Input sanitization
 *  - Prompt building
 *  - Response parsing (valid, malformed, code fences)
 *  - Output validation
 *  - Glossary parsing and merging
 *  - Template rendering
 *  - Exploration session reading
 *  - Scaffolding
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
	type ExplorationResult,
	MAX_BUSINESS_CONTEXT_LENGTH,
	type UbiquitousTerm,
	listExplorationSessions,
	parseExplorationResponse,
	parseUbiquitousLanguageGlossary,
	readExplorationSession,
	renderExplorationTemplate,
	renderGlossaryTable,
	sanitizeBusinessContext,
	scaffoldFromExploration,
	updateUbiquitousLanguage,
	validateDomainExploration,
	writeExplorationSession,
} from "../src/lib/domain-explorer.js";

// ── Fixtures ────────────────────────────────────────────────────────────────

const SAMPLE_GLOSSARY = `# Ubiquitous Language

> Canonical glossary for Guardian Framework.

---

## Glossary

| Term | Definition | Bounded Context | Aliases/Synonyms | Examples |
|------|-----------|----------------|-----------------|---------|
| Result | Discriminated union type | Core Libraries | Outcome, Response | \`Result<T, Error>\` |
| Logger | Structured JSON logger | Core Libraries | LogWriter | \`logger.info("msg")\` |

---

## Adding New Terms

Instructions...
`;

const SAMPLE_EXPLORATION_RESULT: ExplorationResult = {
	sessionId: "test-001",
	businessContext: "A system for managing orders",
	status: "draft",
	actors: [
		{ name: "Customer", description: "Places orders", interactions: "Browse catalog, place orders" },
	],
	functionalRequirements: [
		{ id: "FR-001", requirement: "System shall process orders", priority: "critical" as const, boundedContext: "Orders" },
	],
	nonFunctionalRequirements: [
		{ id: "NFR-001", requirement: "Orders processed within 5s", category: "performance" as const, target: "<5s p95" },
	],
	assumptions: [
		{ assumption: "Customers have internet access", impactIfWrong: "Cant place orders", mitigation: "Offline fallback" },
	],
	boundedContexts: [
		{ name: "Orders", description: "Order processing", entities: ["Order"] },
		{ name: "Inventory", description: "Stock management", entities: ["Product"] },
	],
	entities: [
		{ name: "Order", context: "Orders", type: "aggregate-root", description: "A customer order" },
		{ name: "Product", context: "Inventory", type: "entity", description: "A sellable item" },
	],
	domainEvents: [
		{
			name: "OrderPlaced",
			context: "Orders",
			description: "Order was placed",
			triggeredBy: "Customer checkout",
		},
	],
	ubiquitousLanguage: [
		{
			term: "Order",
			definition: "A customer purchase",
			boundedContext: "Orders",
			aliases: ["Purchase"],
			examples: "",
		},
		{
			term: "Product",
			definition: "A sellable item",
			boundedContext: "Inventory",
			aliases: ["Item"],
			examples: "",
		},
	],
	openQuestions: "How are refunds handled?",
	aggregateRoots: "Order is the aggregate root in Orders context",
};

const VALID_LLM_RESPONSE = JSON.stringify({
	sessionId: "llm-001",
	businessContext: "A payment processing system",
	actors: [
		{ name: "Customer", description: "Pays for things", interactions: "Make payments" },
	],
	functionalRequirements: [
		{ id: "FR-001", requirement: "Process payments", priority: "critical" as const, boundedContext: "Payments" },
	],
	nonFunctionalRequirements: [
		{ id: "NFR-001", requirement: "Payments under 2s", category: "performance" as const, target: "<2s p95" },
	],
	assumptions: [
		{ assumption: "Payment gateway available", impactIfWrong: "Cannot process", mitigation: "Queue for retry" },
	],
	boundedContexts: [
		{ name: "Payments", description: "Process payments", entities: ["Payment", "Refund"] },
	],
	entities: [
		{
			name: "Payment",
			context: "Payments",
			type: "aggregate-root",
			description: "A payment transaction",
		},
	],
	domainEvents: [
		{
			name: "PaymentCompleted",
			context: "Payments",
			description: "Payment was completed",
			triggeredBy: "Successful charge",
		},
	],
	ubiquitousLanguage: [
		{
			term: "Payment",
			definition: "A monetary transaction",
			boundedContext: "Payments",
			aliases: ["Charge"],
			examples: "`new Payment()`",
		},
	],
	openQuestions: "None",
	aggregateRoots: "Payment",
});

// ── Sanitization ────────────────────────────────────────────────────────────

describe("sanitizeBusinessContext", () => {
	it("strips control characters", () => {
		const result = sanitizeBusinessContext("hello\x00world\x01test");
		expect(result).toBe("helloworldtest");
	});

	it("normalizes CRLF to LF", () => {
		const result = sanitizeBusinessContext("line1\r\nline2\r\nline3");
		expect(result).toBe("line1\nline2\nline3");
	});

	it("truncates beyond max length", () => {
		const long = "a".repeat(MAX_BUSINESS_CONTEXT_LENGTH + 100);
		const result = sanitizeBusinessContext(long);
		expect(result.length).toBeLessThanOrEqual(MAX_BUSINESS_CONTEXT_LENGTH);
	});

	it("returns empty string for empty input", () => {
		expect(sanitizeBusinessContext("")).toBe("");
		expect(sanitizeBusinessContext(undefined as unknown as string)).toBe("");
	});

	it("trims whitespace", () => {
		expect(sanitizeBusinessContext("  hello  ")).toBe("hello");
	});
});

// ── Response Parsing ────────────────────────────────────────────────────────

describe("parseExplorationResponse", () => {
	it("parses valid JSON response", () => {
		const result = parseExplorationResponse(VALID_LLM_RESPONSE);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.businessContext).toBe("A payment processing system");
			expect(result.value.boundedContexts).toHaveLength(1);
			expect(result.value.entities).toHaveLength(1);
			expect(result.value.domainEvents).toHaveLength(1);
			expect(result.value.ubiquitousLanguage).toHaveLength(1);
		}
	});

	it("parses JSON wrapped in markdown code fences", () => {
		const wrapped = `\`\`\`json\n${VALID_LLM_RESPONSE}\n\`\`\``;
		const result = parseExplorationResponse(wrapped);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.businessContext).toBe("A payment processing system");
		}
	});

	it("parses JSON wrapped in plain code fences", () => {
		const wrapped = `\`\`\`\n${VALID_LLM_RESPONSE}\n\`\`\``;
		const result = parseExplorationResponse(wrapped);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.businessContext).toBe("A payment processing system");
		}
	});

	it("returns error for invalid JSON", () => {
		const result = parseExplorationResponse("not valid json at all");
		expect(result.ok).toBe(false);
	});

	it("returns error for empty response", () => {
		const result = parseExplorationResponse("");
		expect(result.ok).toBe(false);
	});

	it("handles missing optional fields with defaults", () => {
		const minimal = JSON.stringify({ businessContext: "test" });
		const result = parseExplorationResponse(minimal);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.boundedContexts).toEqual([]);
			expect(result.value.entities).toEqual([]);
			expect(result.value.domainEvents).toEqual([]);
			expect(result.value.ubiquitousLanguage).toEqual([]);
		}
	});

	it("accepts custom session ID", () => {
		const result = parseExplorationResponse(VALID_LLM_RESPONSE, "custom-001");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.sessionId).toBe("custom-001");
		}
	});

	it("coerces entity types correctly", () => {
		const response = JSON.stringify({
			businessContext: "test",
			entities: [
				{ name: "E1", context: "C1", type: "entity", description: "d1" },
				{ name: "E2", context: "C1", type: "aggregate-root", description: "d2" },
				{ name: "E3", context: "C1", type: "value-object", description: "d3" },
				{ name: "E4", context: "C1", type: "invalid", description: "d4" },
			],
		});
		const result = parseExplorationResponse(response);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.entities[0].type).toBe("entity");
			expect(result.value.entities[1].type).toBe("aggregate-root");
			expect(result.value.entities[2].type).toBe("value-object");
			expect(result.value.entities[3].type).toBe("entity"); // invalid → default
		}
	});
});

// ── Output Validation ───────────────────────────────────────────────────────

describe("validateDomainExploration", () => {
	it("returns no warnings for valid result", () => {
		const warnings = validateDomainExploration(SAMPLE_EXPLORATION_RESULT);
		expect(warnings).toHaveLength(0);
	});

	it("warns about missing bounded contexts", () => {
		const result = { ...SAMPLE_EXPLORATION_RESULT, boundedContexts: [] };
		const warnings = validateDomainExploration(result);
		expect(warnings.some((w) => w.includes("No bounded contexts"))).toBe(true);
	});

	it("warns about missing entities", () => {
		const result = { ...SAMPLE_EXPLORATION_RESULT, entities: [] };
		const warnings = validateDomainExploration(result);
		expect(warnings.some((w) => w.includes("No entities"))).toBe(true);
	});

	it("warns about orphaned entities", () => {
		const result = {
			...SAMPLE_EXPLORATION_RESULT,
			boundedContexts: [{ name: "Orders", description: "", entities: [] }],
			entities: [
				{ name: "Orphan", context: "NonExistent", type: "entity" as const, description: "" },
			],
		};
		const warnings = validateDomainExploration(result);
		expect(warnings.some((w) => w.includes("non-existent"))).toBe(true);
	});

	it("warns about orphaned ubiquitous language terms", () => {
		const result = {
			...SAMPLE_EXPLORATION_RESULT,
			boundedContexts: [{ name: "Orders", description: "", entities: [] }],
			ubiquitousLanguage: [
				{
					term: "OrphanTerm",
					definition: "",
					boundedContext: "NonExistent",
					aliases: [],
					examples: "",
				},
			],
		};
		const warnings = validateDomainExploration(result);
		expect(warnings.some((w) => w.includes("non-existent bounded context"))).toBe(true);
	});

	it("warns about duplicate entity names across contexts", () => {
		const result = {
			...SAMPLE_EXPLORATION_RESULT,
			boundedContexts: [
				{ name: "C1", description: "", entities: [] },
				{ name: "C2", description: "", entities: [] },
			],
			entities: [
				{ name: "Shared", context: "C1", type: "entity" as const, description: "" },
				{ name: "Shared", context: "C2", type: "entity" as const, description: "" },
			],
		};
		const warnings = validateDomainExploration(result);
		expect(warnings.some((w) => w.includes("appears in multiple contexts"))).toBe(true);
	});
});

// ── Glossary Parsing ────────────────────────────────────────────────────────

describe("parseUbiquitousLanguageGlossary", () => {
	it("parses existing glossary file", () => {
		const testPath = path.join(import.meta.dirname, "fixtures", "test-glossary.md");
		try {
			fs.mkdirSync(path.dirname(testPath), { recursive: true });
			fs.writeFileSync(testPath, SAMPLE_GLOSSARY, "utf-8");
			const terms = parseUbiquitousLanguageGlossary(testPath);
			expect(terms.length).toBeGreaterThanOrEqual(2);
			expect(terms[0].term).toBe("Result");
			expect(terms[0].aliases).toEqual(["Outcome", "Response"]);
			expect(terms[1].term).toBe("Logger");
		} finally {
			fs.rmSync(path.dirname(testPath), { recursive: true, force: true });
		}
	});

	it("returns empty array for non-existent file", () => {
		const terms = parseUbiquitousLanguageGlossary("/tmp/nonexistent-glossary.md");
		expect(terms).toEqual([]);
	});
});

// ── Glossary Table Rendering ────────────────────────────────────────────────

describe("renderGlossaryTable", () => {
	it("renders terms sorted alphabetically", () => {
		const terms: UbiquitousTerm[] = [
			{ term: "Zebra", definition: "An animal", boundedContext: "Zoo", aliases: [], examples: "" },
			{ term: "Alpha", definition: "First", boundedContext: "Test", aliases: ["A"], examples: "" },
		];
		const table = renderGlossaryTable(terms);
		const lines = table.split("\n");
		expect(lines[0]).toContain("Alpha");
		expect(lines[1]).toContain("Zebra");
	});

	it("includes aliases when present", () => {
		const terms: UbiquitousTerm[] = [
			{
				term: "Test",
				definition: "A test",
				boundedContext: "Core",
				aliases: ["T1", "T2"],
				examples: "`test()`",
			},
		];
		const table = renderGlossaryTable(terms);
		expect(table).toContain("T1, T2");
	});
});

// ── Glossary Update ─────────────────────────────────────────────────────────

describe("updateUbiquitousLanguage", () => {
	const testDir = path.join(import.meta.dirname, "fixtures", "glossary-test");
	const glossaryPath = path.join(testDir, ".pi", "domain", "ubiquitous-language.md");

	beforeEach(() => {
		fs.mkdirSync(path.dirname(glossaryPath), { recursive: true });
		fs.writeFileSync(glossaryPath, SAMPLE_GLOSSARY, "utf-8");
	});

	afterEach(() => {
		fs.rmSync(path.dirname(path.dirname(path.dirname(glossaryPath))), {
			recursive: true,
			force: true,
		});
	});

	it("adds new terms and skips duplicates", () => {
		const newTerms: UbiquitousTerm[] = [
			{
				term: "Result",
				definition: "Already exists",
				boundedContext: "Core",
				aliases: [],
				examples: "",
			},
			{
				term: "NewTerm",
				definition: "A new term",
				boundedContext: "Core",
				aliases: ["NT"],
				examples: "`new()`",
			},
		];
		const result = updateUbiquitousLanguage(newTerms, { glossaryPath, projectDir: testDir });
		expect(result.added).toBe(1);
		expect(result.skipped).toBe(1);
		expect(result.written).toBe(true);

		// Verify file was updated
		const terms = parseUbiquitousLanguageGlossary(glossaryPath);
		expect(terms).toHaveLength(3);
	});

	it("dry-run does not write", () => {
		const newTerms: UbiquitousTerm[] = [
			{
				term: "DryRunTerm",
				definition: "Should not persist",
				boundedContext: "Test",
				aliases: [],
				examples: "",
			},
		];
		const result = updateUbiquitousLanguage(newTerms, {
			glossaryPath,
			projectDir: testDir,
			dryRun: true,
		});
		expect(result.added).toBe(1);
		expect(result.written).toBe(false);

		const terms = parseUbiquitousLanguageGlossary(glossaryPath);
		expect(terms).toHaveLength(2); // unchanged
	});

	it("creates file if it doesn't exist", () => {
		fs.rmSync(glossaryPath, { force: true });
		const newTerms: UbiquitousTerm[] = [
			{
				term: "FirstTerm",
				definition: "First entry",
				boundedContext: "Core",
				aliases: [],
				examples: "",
			},
		];
		const result = updateUbiquitousLanguage(newTerms, { glossaryPath, projectDir: testDir });
		expect(result.added).toBe(1);
		expect(result.written).toBe(true);
		expect(fs.existsSync(glossaryPath)).toBe(true);
	});
});

// ── Template Rendering ──────────────────────────────────────────────────────

describe("renderExplorationTemplate", () => {
	it("renders all sections from exploration result", () => {
		const output = renderExplorationTemplate(SAMPLE_EXPLORATION_RESULT);
		expect(output).toContain("test-001");
		expect(output).toContain("Orders");
		expect(output).toContain("Inventory");
		expect(output).toContain("Order");
		expect(output).toContain("Product");
		expect(output).toContain("OrderPlaced");
		expect(output).toContain("aggregate-root");
		expect(output).toContain("A system for managing orders");
	});

	it("includes ubiquitous language table", () => {
		const output = renderExplorationTemplate(SAMPLE_EXPLORATION_RESULT);
		expect(output).toContain("Order");
		expect(output).toContain("A customer purchase");
	});

	it("handles empty collections gracefully", () => {
		const empty: ExplorationResult = {
			sessionId: "empty-001",
			businessContext: "Nothing",
			status: "draft",
			actors: [],
			functionalRequirements: [],
			nonFunctionalRequirements: [],
			assumptions: [],
			boundedContexts: [],
			entities: [],
			domainEvents: [],
			ubiquitousLanguage: [],
			openQuestions: "",
			aggregateRoots: "",
		};
		const output = renderExplorationTemplate(empty);
		expect(output).toContain("None identified yet");
	});
});

// ── Write & Read Exploration Session ────────────────────────────────────────

describe("writeExplorationSession / readExplorationSession", () => {
	const testDir = path.join(import.meta.dirname, "fixtures", "session-test");

	afterEach(() => {
		fs.rmSync(testDir, { recursive: true, force: true });
	});

	it("writes and reads back an exploration session", () => {
		const filePath = writeExplorationSession(SAMPLE_EXPLORATION_RESULT, testDir);
		expect(filePath).toContain("test-001.md");
		expect(fs.existsSync(filePath)).toBe(true);

		const readBack = readExplorationSession("test-001", testDir);
		expect(readBack).not.toBeNull();
		if (readBack) {
			expect(readBack.sessionId).toBe("test-001");
			expect(readBack.businessContext).toBe("A system for managing orders");
			expect(readBack.boundedContexts).toHaveLength(2);
			expect(readBack.entities).toHaveLength(2);
		}
	});

	it("dry-run does not write", () => {
		const result = writeExplorationSession(SAMPLE_EXPLORATION_RESULT, testDir, true);
		expect(result).toContain("[dry-run]");
		expect(fs.existsSync(path.join(testDir, ".pi", "domain", "exploration", "test-001.md"))).toBe(
			false,
		);
	});

	it("returns null for missing session", () => {
		const result = readExplorationSession("nonexistent", testDir);
		expect(result).toBeNull();
	});
});

// ── Scaffolding ─────────────────────────────────────────────────────────────

describe("scaffoldFromExploration", () => {
	const testDir = path.join(import.meta.dirname, "fixtures", "scaffold-test");

	beforeEach(() => {
		writeExplorationSession(SAMPLE_EXPLORATION_RESULT, testDir);
	});

	afterEach(() => {
		fs.rmSync(testDir, { recursive: true, force: true });
	});

	it("generates module docs for each bounded context", () => {
		const result = scaffoldFromExploration("test-001", { projectDir: testDir });
		expect(result.modulesGenerated).toBe(2);
		expect(result.modules).toContain("orders.md");
		expect(result.modules).toContain("inventory.md");
	});

	it("generated module docs have correct structure", () => {
		const result = scaffoldFromExploration("test-001", { projectDir: testDir });
		const ordersPath = path.join(testDir, ".pi", "architecture", "modules", "orders.md");
		expect(fs.existsSync(ordersPath)).toBe(true);
		const content = fs.readFileSync(ordersPath, "utf-8");
		expect(content).toContain("# Orders");
		expect(content).toContain("Order processing");
		expect(content).toContain("## Component: Order"); // aggregate root
		expect(content).toContain("depends: none"); // root has no deps
	});

	it("dry-run does not write files", () => {
		const result = scaffoldFromExploration("test-001", { projectDir: testDir, dryRun: true });
		expect(result.modulesGenerated).toBe(2);
		const ordersPath = path.join(testDir, ".pi", "architecture", "modules", "orders.md");
		expect(fs.existsSync(ordersPath)).toBe(false);
	});

	it("throws for non-existent session", () => {
		expect(() => scaffoldFromExploration("nonexistent", { projectDir: testDir })).toThrow();
	});

	it("warns for session with no bounded contexts", () => {
		const emptyResult: ExplorationResult = {
			sessionId: "empty-002",
			businessContext: "Empty",
			status: "draft",
			actors: [],
			functionalRequirements: [],
			nonFunctionalRequirements: [],
			assumptions: [],
			boundedContexts: [],
			entities: [],
			domainEvents: [],
			ubiquitousLanguage: [],
			openQuestions: "",
			aggregateRoots: "",
		};
		writeExplorationSession(emptyResult, testDir);
		const result = scaffoldFromExploration("empty-002", { projectDir: testDir });
		expect(result.warnings.some((w) => w.includes("No bounded contexts"))).toBe(true);
	});
});

// ── List Sessions ───────────────────────────────────────────────────────────

describe("listExplorationSessions", () => {
	const testDir = path.join(import.meta.dirname, "fixtures", "list-test");

	afterEach(() => {
		fs.rmSync(testDir, { recursive: true, force: true });
	});

	it("returns empty array when no sessions exist", () => {
		const sessions = listExplorationSessions(testDir);
		expect(sessions).toEqual([]);
	});

	it("lists available sessions", () => {
		writeExplorationSession(SAMPLE_EXPLORATION_RESULT, testDir);
		const sessions = listExplorationSessions(testDir);
		expect(sessions).toContain("test-001");
	});
});
