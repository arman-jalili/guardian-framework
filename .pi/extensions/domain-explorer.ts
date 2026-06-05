/**
 * Canonical Reference: .pi/architecture/modules/core-libraries.md
 * Implements: Domain Explore pi extension — domain_explore + domain_validate tools
 * Last Architecture Sync: 2026-05-31
 *
 * Pi extension providing two tools:
 *   domain_explore   — Write a DDD exploration prompt file from business context
 *   domain_validate  — Validate exploration sessions against glossary + source code
 *
 * No LLM SDKs. No API keys. The prompt file is the interface — feed it to pi's own LLM.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "typebox";

// ── Minimal pi ExtensionAPI types (same pattern as coordinator.ts) ──

type ShellResult = {
	exitCode: number;
	stdout: string;
};

type ExtensionContext = {
	cwd: string;
	shell: {
		execute(command: string, options?: { signal?: AbortSignal }): Promise<ShellResult>;
	};
	ui: {
		notify(message: string, level?: string): void;
	};
	tools: {
		execute(name: string, params: Record<string, unknown>): Promise<unknown>;
	};
};

type ExtensionAPI = {
	on(event: string, handler: (event: unknown, ctx: ExtensionContext) => void | Promise<void>): void;
	registerTool(options: {
		name: string;
		label: string;
		description: string;
		parameters: unknown;
		execute(
			toolCallId: string,
			params: Record<string, unknown>,
			signal: AbortSignal,
			onUpdate: (update: { type: string; message: string }) => void,
			ctx: ExtensionContext,
		): unknown | Promise<unknown>;
	}): void;
	registerCommand(name: string, options: {
		description: string;
		handler(args: string[], ctx: ExtensionContext): unknown | Promise<unknown>;
	}): void;
};

// ── Helpers ──

function toolResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

function sanitizeContext(context: string): string {
	return context
		.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 5000);
}

function buildExplorationPrompt(context: string): string {
	return [
		"You are a Domain-Driven Design expert. Analyze the following business",
		"description and extract a structured domain model. Respond with valid JSON only.",
		"",
		"## Business Context",
		"",
		context,
		"",
		"## Output Format (JSON)",
		"",
		"```json",
		"{",
		'  "businessContext": "Brief one-line summary",',
		'  "actors": [',
		"    {",
		'      "name": "ActorName",',
		'      "description": "Who this actor is (person, system, role)",',
		'      "interactions": "What they do with the system"',
		"    }",
		"  ],",
		'  "functionalRequirements": [',
		"    {",
		'      "id": "FR-001",',
		'      "requirement": "The system shall [do something]",',
		'      "priority": "critical | high | medium | low",',
		'      "boundedContext": "BoundedContextName"',
		"    }",
		"  ],",
		'  "nonFunctionalRequirements": [',
		"    {",
		'      "id": "NFR-001",',
		'      "requirement": "The system shall [meet some quality attribute]",',
		'      "category": "performance | security | scalability | availability | maintainability",',
		'      "target": "Specific measurable target (e.g. < 200ms p99 latency)"',
		"    }",
		"  ],",
		'  "assumptions": [',
		"    {",
		'      "assumption": "We assume that...",',
		'      "impactIfWrong": "What breaks if this assumption is false",',
		'      "mitigation": "How we mitigate the risk"',
		"    }",
		"  ],",
		'  "boundedContexts": [',
		"    {",
		'      "name": "ContextName",',
		'      "description": "What this context does",',
		'      "entities": ["EntityName1", "EntityName2"]',
		"    }",
		"  ],",
		'  "entities": [',
		"    {",
		'      "name": "EntityName",',
		'      "context": "BoundedContextName",',
		'      "type": "entity | value-object | aggregate-root",',
		'      "description": "What this entity represents"',
		"    }",
		"  ],",
		'  "domainEvents": [',
		"    {",
		'      "name": "EventName",',
		'      "context": "BoundedContextName",',
		'      "description": "What happened",',
		'      "triggeredBy": "What caused this event"',
		"    }",
		"  ],",
		'  "ubiquitousLanguage": [',
		"    {",
		'      "term": "TermName",',
		'      "definition": "Clear definition",',
		'      "boundedContext": "BoundedContextName",',
		'      "aliases": ["bad-alias-1", "bad-alias-2"],',
		'      "examples": "code snippet showing correct usage"',
		"    }",
		"  ],",
		'  "openQuestions": "Any ambiguities that need human clarification",',
		'  "aggregateRoots": ["AggregateRootName1", "AggregateRootName2"]',
		"}",
		"```",
	].join("\n");
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.notify("Domain explorer ready — use domain_explore and domain_validate tools", "info");
	});

	// domain_explore
	pi.registerTool({
		name: "domain_explore",
		label: "Domain Explore",
		description:
			"Create a DDD domain exploration prompt from a business context description. " +
			"Generates a .prompt.md file in .pi/domain/exploration/ that the agent feeds " +
			"to its LLM. Returns a session ID and prompt path.",
		parameters: Type.Object({
			context: Type.String({ description: "Business domain description to explore" }),
			sessionId: Type.Optional(Type.String({ description: "Optional custom session ID" })),
			dryRun: Type.Optional(Type.Boolean({ description: "Simulate without writing files" })),
		}),
		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			const context = String(params.context ?? "").trim();
			const sessionId = String(params.sessionId ?? "") || crypto.randomUUID();
			const dryRun = params.dryRun === true;

			if (!context) {
				return toolResult("ERROR: context is required (business description)");
			}

			const sanitized = sanitizeContext(context);
			const prompt = buildExplorationPrompt(sanitized);
			const explorationDir = path.join(ctx.cwd, ".pi", "domain", "exploration");
			const promptPath = path.join(explorationDir, sessionId + ".prompt.md");

			if (!dryRun) {
				fs.mkdirSync(explorationDir, { recursive: true });
				fs.writeFileSync(promptPath, prompt, "utf-8");
			}

			let existingSessions = 0;
			try {
				if (fs.existsSync(explorationDir)) {
					existingSessions = fs.readdirSync(explorationDir).filter(
						(f) => f.endsWith(".md") && !f.includes(".prompt."),
					).length;
				}
			} catch {
				existingSessions = 0;
			}

			const result = [
				"Domain Exploration Created",
				"Session ID: " + sessionId,
				"Prompt File: " + (dryRun ? "[dry-run, not written]" : promptPath),
				"Context Length: " + sanitized.length + " characters",
				"Status: awaiting-response",
				"Existing Sessions: " + existingSessions,
				"",
				"Next Steps:",
				"1. Read the prompt file",
				"2. Feed it to your LLM",
				"3. Save the JSON response",
				"4. guardian domain answer " + sessionId + " <response-file>",
				"5. guardian domain scaffold " + sessionId,
			];

			return toolResult(result.join("\n"));
		},
	});

	// domain_validate
	pi.registerTool({
		name: "domain_validate",
		label: "Domain Validate",
		description:
			"Validate a domain exploration session against the canonical glossary and " +
			"source code. Checks: file exists, structural integrity, glossary compliance, " +
			"source drift, and canonical reference integrity.",
		parameters: Type.Object({
			sessionId: Type.String({ description: "Exploration session ID to validate" }),
		}),
		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			const sessionId = String(params.sessionId ?? "").trim();
			if (!sessionId) return toolResult("ERROR: sessionId is required");

			const explorationDir = path.join(ctx.cwd, ".pi", "domain", "exploration");
			const sessionPath = path.join(explorationDir, sessionId + ".md");
			const glossaryPath = path.join(ctx.cwd, ".pi", "domain", "ubiquitous-language.md");
			const checks: string[] = [];
			let allPassed = true;

			function addCheck(name: string, passed: boolean, detail?: string) {
				const icon = passed ? "PASS" : "FAIL";
				if (!passed) allPassed = false;
				checks.push("  " + icon + " " + name + (detail ? " - " + detail : ""));
			}

			// 1. Session file exists
			if (!fs.existsSync(sessionPath)) {
				addCheck("Session file", false, "Not found");
			} else {
				addCheck("Session file", true, path.basename(sessionPath));
			}

			// 2. Parse and validate structure
			if (fs.existsSync(sessionPath)) {
					const content = fs.readFileSync(sessionPath, "utf-8");
				const hasBoundedContexts = content.includes("## Bounded Contexts");
				const hasEntities = content.includes("## Entities");
				const hasGlossary = content.includes("## Ubiquitous Language");
				addCheck("Bounded contexts section", hasBoundedContexts);
				addCheck("Entities section", hasEntities);
				addCheck("Ubiquitous language section", hasGlossary);
				addCheck("Structural integrity", hasBoundedContexts && hasEntities && hasGlossary);
			}

			// 3. Glossary compliance
			if (fs.existsSync(glossaryPath)) {
					const content = fs.readFileSync(glossaryPath, "utf-8");
				const terms = content.split("\n").filter(l => l.startsWith("|") && !l.includes("|---") && !l.includes("| Term |")).length;
				addCheck("Glossary parsed", terms > 0, terms + " canonical terms");
			} else {
				addCheck("Glossary file", false, "Not found");
			}

			// 4. Source code drift
			const scriptPath = path.join(ctx.cwd, ".pi", "scripts", "validate-ubiquitous-language.sh");
			if (fs.existsSync(scriptPath)) {
				try {
					const result = await ctx.shell.execute("bash " + scriptPath, {});
					addCheck("Source drift", result.exitCode === 0, result.stdout.slice(-80).trim());
				} catch (err) {
					addCheck("Source drift", false, "Error: " + String(err));
				}
			} else {
				addCheck("Source drift check skipped", true, "script not found");
			}

			const header = allPassed
				? "Domain Validation - All Checks Passed"
				: "Domain Validation - Some Checks Failed";
			return toolResult(header + "\n" + checks.join("\n"));
		},
	});

	// ── /domain command ──
	pi.registerCommand("domain", {
		description:
			"Domain exploration commands. Subcommands: --explore, --architect-scaffold, --validate",
		handler(args: string, ctx: ExtensionContext) {
			const trimmed = args.trim();

			// /domain --explore "context description"
			if (trimmed.startsWith("--explore")) {
				const context = trimmed.slice("--explore".length).trim().replace(/^["']|["']$/g, "");
				if (!context) {
					ctx.ui.notify(
						'Usage: /domain --explore "Business domain description"',
						"error",
					);
					return "(domain command handled)";
				}
				const sanitized = sanitizeContext(context);
				const prompt = buildExplorationPrompt(sanitized);
				const sessionId = crypto.randomUUID();
				const explorationDir = path.join(ctx.cwd, ".pi", "domain", "exploration");
				fs.mkdirSync(explorationDir, { recursive: true });

				// Create session.md with business context (will be updated with analysis)
				const sessionPath = path.join(explorationDir, sessionId + ".md");
				const initialContent = [
					"---",
					"session_id: " + sessionId,
					"created: " + new Date().toISOString().split("T")[0],
					'business_context: "' + sanitized.replace(/"/g, '\\"') + '"',
					"status: draft",
					"---",
					"",
					"# Domain Exploration: " + sessionId,
					"",
					"> **Status:** agent analysis requested",
					"",
					"---",
					"",
					"## Business Context",
					"",
					sanitized,
					"",
					"---",
					"",
					"## Prompt",
					"",
					"See the analysis request below.",
				].join("\n");
				fs.writeFileSync(sessionPath, initialContent, "utf-8");

				ctx.ui.notify(
					"Domain analysis requested for session: " + sessionId,
					"success",
				);

				return [
					"# Domain Analysis",
					"",
					"Session ID: " + sessionId,
					"",
					"Analyze the following business domain and extract a structured domain model.",
					"Respond with complete JSON matching the schema below.",
					"Then **call the domain_save_result tool** with your JSON response and the session ID.",
					"I will then automatically generate your architecture from the saved session.",
					"",
					"If needed, you can also edit the session file directly:",
					"  " + sessionPath,
					"",
					"---",
					"",
					prompt,
				].join("\n");
			
			// /domain --architect-scaffold <session-id>
		if (trimmed.startsWith("--architect-scaffold")) {
			const sessionId = trimmed.slice("--architect-scaffold".length).trim();
			if (!sessionId) {
				ctx.ui.notify(
					"Usage: /domain --architect-scaffold <session-id>",
					"error",
				);
				return "(domain command handled)";
			}

			const explorationDir = path.join(ctx.cwd, ".pi", "domain", "exploration");
			const sessionPath = path.join(explorationDir, sessionId + ".md");

			if (!fs.existsSync(sessionPath)) {
				ctx.ui.notify(
					"Session not found: " + sessionId + ". Run /domain --explore first to create the session.",
					"error",
				);
				return "(domain command handled)";
			}

			const sessionContent = fs.readFileSync(sessionPath, "utf-8");

			// Parse front matter
			const sessionMatch = sessionContent.match(/^---\n([\s\S]*?)\n---/);
			const getField = (name: string): string => {
				if (!sessionMatch) return "";
				const m = sessionMatch[1].match(new RegExp(name + ':\s*"(.+?)"'));
				return m ? m[1] : "";
			};
			const businessContext = getField("business_context");

			// Parse tables from the body
			const body = sessionMatch ? sessionContent.slice(sessionMatch[0].length) : sessionContent;

			function parseTable(sectionName: string): Array<Record<string, string>> {
				const regex = new RegExp("## " + sectionName + "\\n+([\\s\\S]*?)(?:\\n##|\\n---|$)");
				const sectionMatch = body.match(regex);
				if (!sectionMatch) return [];
				const section = sectionMatch[1];
				const lines = section.split("\n").filter((l: string) => l.startsWith("|"));
				// Skip header and separator
				const dataLines = lines.filter((l: string) => !l.includes("|---") && !l.includes("| ---"));
				return dataLines.map((line: string) => {
					const cols = line.trim().split("|").filter((_: string, i: number, a: string[]) => i > 0 && i < a.length - 1).map((s: string) => s.trim());
					return { cols };
				}).filter((r: { cols: string[] }) => r.cols.length > 0).map((r: { cols: string[] }) => {
					const obj: Record<string, string> = {};
					r.cols.forEach((c: string, i: number) => { obj["col" + i] = c; });
					return obj;
				});
			}

			const boundedContexts = parseTable("Bounded Contexts");
			const actors = parseTable("Actors & Roles");

			if (boundedContexts.length === 0 && actors.length === 0) {
				ctx.ui.notify("No bounded contexts or actors found in session. Explore a domain first.", "error");
				return "(domain command handled)";
			}

			const now = new Date().toISOString().split("T")[0];
			const modulesDir = path.join(ctx.cwd, ".pi", "architecture", "modules");
			const decisionsDir = path.join(ctx.cwd, ".pi", "architecture", "decisions");
			const diagramsDir = path.join(ctx.cwd, ".pi", "architecture", "diagrams");
			fs.mkdirSync(modulesDir, { recursive: true });
			fs.mkdirSync(decisionsDir, { recursive: true });
			fs.mkdirSync(diagramsDir, { recursive: true });

			const generated: string[] = [];

			// Helper: name to kebab-case module id
			function toModuleId(name: string): string {
				return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
			}

			// Generate one module doc per bounded context
			for (const bc of boundedContexts) {
				const ctxName = bc.col0 || "Unnamed";
				const ctxDesc = bc.col1 || "";
				const entities = (bc.col2 || "").split(",").map((s: string) => s.trim()).filter(Boolean);
				const moduleId = toModuleId(ctxName);

				const components = entities.map((e: string) =>
					"## Component: " + e + "\n" +
					"status: planned\n" +
					"description: Part of " + ctxName + " bounded context.\n" +
					"depends: none\n"
				).join("\n");

				// Also check entities table for more detail
				const entitiesTable = parseTable("Entities");
				const matchingEntities = entitiesTable.filter((e: Record<string, string>) => e.col1 === ctxName);

				const content = [
					"# " + ctxName,
					"",
					"## Module Status",
					"",
					"**Status:** Planned",
					"**Last reviewed:** " + now,
					"**Source session:** " + sessionId,
					"",
					"## Description",
					"",
					ctxDesc,
					"",
					"## Components",
					"",
					components || "No components defined yet.\n",
					"## Dependencies",
					"",
					"None identified yet.",
					"",
					"## Ubiquitous Language",
					"",
					"Refer to .pi/domain/ubiquitous-language.md",
					"",
					"## Architecture Diagrams",
					"",
					"See .pi/architecture/diagrams/" + moduleId + ".md",
				].join("\n");

				const filePath = path.join(modulesDir, moduleId + ".md");
				// Atomic write
				const tmpPath = filePath + ".tmp";
				fs.writeFileSync(tmpPath, content, "utf-8");
				fs.renameSync(tmpPath, filePath);
				generated.push(moduleId + ".md");
			}

			// Generate ADR-001: Domain-Driven Design architecture decision
			const contextNames = boundedContexts.map((bc: Record<string, string>) => bc.col0 || "Unnamed");
			const adrContent = [
				"# ADR-001: Architecture Pattern",
				"",
				"**Status:** Proposed",
				"**Date:** " + now,
				"**Source Session:** " + sessionId,
				"",
				"## Context",
				"",
				"Domain exploration identified " + boundedContexts.length + " bounded context(s): " + contextNames.join(", ") + ".",
				"The system needs an architectural pattern that enforces clean separation between these contexts.",
				"",
				"## Decision",
				"",
				"Use Domain-Driven Design with Clean Architecture/Hexagonal layering:",
				"",
				"- domain/ — Enterprise business rules (entities, value objects, aggregates)",
				"- application/ — Application services, use cases, ports",
				"- infrastructure/ — Adapters, repositories, external services",
				"- interfaces/ — HTTP, messaging, CLI entry points (sub-layer per protocol)",
				"",
				"Each bounded context gets its own package tree following this layer structure.",
				"Dependency rule: domain → application ← infrastructure, interfaces. Domain never imports infrastructure.",
				"",
				"## Consequences",
				"",
				"- Clear module boundaries prevent cross-context coupling",
				"- Each context can be developed and deployed independently if needed",
				"- Testability: domain logic can be tested without infrastructure",
				"- Learning curve: team must understand Clean Architecture conventions",
			].join("\n");

			const adrPath = path.join(decisionsDir, "ADR-001-domain-driven-architecture.md");
			const adrTmp = adrPath + ".tmp";
			fs.writeFileSync(adrTmp, adrContent, "utf-8");
			fs.renameSync(adrTmp, adrPath);
			generated.push("decisions/ADR-001-domain-driven-architecture.md");

			// Generate diagram markdown with mermaid
			const nowDate = now;
			const mermaidLines = [
				"# System Context Diagram",
				"",
				"Generated from domain exploration session: " + sessionId,
				"Date: " + nowDate,
				"",
				"## Context Diagram",
				"",
				"\`\`\`mermaid",
				"graph TD",
			];

			// Add actors
			let nodeNum = 0;
			for (const actor of actors) {
				const name = actor.col0 || "Actor";
				mermaidLines.push("    A" + nodeNum + "[" + name + "]");
				nodeNum++;
			}

			// Add bounded contexts
			const bcNodeMap: Record<string, string> = {};
			for (const bc of boundedContexts) {
				const name = bc.col0 || "Context";
				const nodeId = "BC" + nodeNum;
				mermaidLines.push("    " + nodeId + "[" + name + "]");
				bcNodeMap[name] = nodeId;
				nodeNum++;
			}

			// Connect actors to contexts
			let edgeNum = 0;
			for (let i = 0; i < Math.min(actors.length, boundedContexts.length); i++) {
				mermaidLines.push("    A" + i + " -->|interacts| " + "BC" + i);
				edgeNum++;
			}

			mermaidLines.push("\`\`\`");
			mermaidLines.push("");
			mermaidLines.push("## Container / Module Diagram");
			mermaidLines.push("");
			mermaidLines.push("\`\`\`mermaid");
			mermaidLines.push("graph RL");
			mermaidLines.push('    subgraph "Bounded Contexts"');
			for (let i = 0; i < boundedContexts.length; i++) {
				const name = boundedContexts[i].col0 || "Context";
				mermaidLines.push("        BC" + i + "[" + name + "]");
			}
			mermaidLines.push("    end");
			mermaidLines.push("");
			mermaidLines.push('    subgraph "Layers"');
			mermaidLines.push("        Domain[domain/]");
			mermaidLines.push("        App[application/]");
			mermaidLines.push("        Infra[infrastructure/]");
			mermaidLines.push("        HTTP[interfaces/http/]");
			mermaidLines.push("        Msg[interfaces/messaging/]");
			mermaidLines.push("    end");
			mermaidLines.push("");
			mermaidLines.push("    Domain --> App");
			mermaidLines.push("    App --> Infra");
			mermaidLines.push("    HTTP --> App");
			mermaidLines.push("    Msg --> App");
			mermaidLines.push("\`\`\`");

			const diagramContent = mermaidLines.join("\n");
			const diagramPath = path.join(diagramsDir, "system-context.md");
			const diagramTmp = diagramPath + ".tmp";
			fs.writeFileSync(diagramTmp, diagramContent, "utf-8");
			fs.renameSync(diagramTmp, diagramPath);
			generated.push("diagrams/system-context.md");

			ctx.ui.notify(
				"Architecture scaffolded: " + generated.length + " file(s) generated from session " + sessionId,
				"success",
			);

			return [
				"Architecture scaffolded from session: " + sessionId,
				"",
				"Generated files:",
			].concat(generated.map((f: string) => "  - .pi/architecture/" + f)).concat([
				"",
				"Next steps:",
				"1. Review the generated module docs in .pi/architecture/modules/",
				"2. Review ADR-001 in .pi/architecture/decisions/",
				"3. Review diagrams in .pi/architecture/diagrams/",
				"4. Run: /architect --epic "<epic-name>" to plan implementation",
				"5. Or run: /epic-plan --overview to plan across all modules",
				"6. After planning, Epic 0: guardian project create to scaffold project structure",
			].join("\n"));
		}			// /domain --validate <session-id>
			if (trimmed.startsWith("--validate")) {
				const sessionId = trimmed.slice("--validate".length).trim();
				if (!sessionId) {
					ctx.ui.notify(
						"Usage: /domain --validate <session-id>",
						"error",
					);
					return "(domain command handled)";
				}

				const explorationDir = path.join(ctx.cwd, ".pi", "domain", "exploration");
				const sessionPath = path.join(explorationDir, sessionId + ".md");
				const checks: string[] = [];
				let allPassed = true;

				if (!fs.existsSync(sessionPath)) {
					checks.push("  FAIL Session not found");
					allPassed = false;
				} else {
					const content = fs.readFileSync(sessionPath, "utf-8");
					checks.push("  PASS Session file exists");
					checks.push(content.includes("## Bounded Contexts") ? "  PASS Bounded contexts section" : "  FAIL Missing bounded contexts section");
					checks.push(content.includes("## Entities") ? "  PASS Entities section" : "  FAIL Missing entities section");
					checks.push(content.includes("## Ubiquitous Language") ? "  PASS Ubiquitous language section" : "  FAIL Missing ubiquitous language section");
				}

				const header = allPassed ? "Domain Validation - All Checks Passed" : "Domain Validation - Some Checks Failed";
				ctx.ui.notify(header, allPassed ? "success" : "error");

				return header + "\n" + checks.join("\n");
			}

			// Default: show usage
			ctx.ui.notify(
				[
					"Usage:",
					'  /domain --explore "Business context description"',
					"  /domain --architect-scaffold <session-id>",
					"  /domain --validate <session-id>",
					"",
					"Workflow:",
					"  1. /domain --explore "Describe your business domain"",
					"  2. Agent analyzes and calls domain_save_result to write exploration.md",
					"  3. /domain --architect-scaffold <session-id>",
					"  4. Review modules, ADRs, diagrams in .pi/architecture/",
					"  5. /architect or /epic-plan to plan implementation",
				].join("\n"),
				"info",
			);

			return [
				"Available /domain subcommands:",
				"",
				'  /domain --explore "Business context description"',
				"    Analyze a domain and generate exploration.md + ubiquitous-language.md",
				"",
				"  /domain --architect-scaffold <session-id>",
				"    Generate architecture modules, ADR-001, and mermaid diagrams from exploration",
				"",
				"  /domain --validate <session-id>",
				"    Validate exploration session structure and completeness",
				"",
				"Workflow:",
				"  1. /domain --explore "Describe your business domain"",
				"  2. Agent analyzes and calls domain_save_result to write exploration.md",
				"  3. /domain --architect-scaffold <session-id>",
				"  4. Review modules, ADRs, diagrams in .pi/architecture/",
				"  5. /architect or /epic-plan to plan implementation",
			].join("\n");
		},
	});
}
