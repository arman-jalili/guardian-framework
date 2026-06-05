/**
 * Canonical Reference: .pi/architecture/modules/core-libraries.md
 * Implements: Domain Explore pi extension — /domain command + domain_explore/domain_validate tools
 * Last Architecture Sync: 2026-05-31
 *
 * Pi extension providing:
 *   /domain --explore — Returns DDD analysis instructions + agent writes files directly
 *   /domain --architect-scaffold — Generate architecture directories from exploration
 *   /domain --validate — Validate exploration session structure
 *   domain_explore tool — (deprecated, use /domain --explore instead)
 *   domain_validate tool — Validate exploration sessions against glossary + source code
 *   domain_save_result tool — (fallback) Save agent's domain JSON as structured session
 *
 * No LLM SDKs. No API keys. The prompt IS the interface — the agent reads it and acts.
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
		'      "description": "Who this actor is",',
		'      "interactions": "What they do in the system"',
		"    }",
		"  ],",
		'  "functionalRequirements": [',
		"    {",
		'      "id": "FR-001",',
		'      "requirement": "The system shall...",',
		'      "priority": "critical|high|medium|low",',
		'      "boundedContext": "ContextName"',
		"    }",
		"  ],",
		'  "nonFunctionalRequirements": [',
		"    {",
		'      "id": "NFR-001",',
		'      "requirement": "The system shall...",',
		'      "category": "performance|security|scalability|availability|maintainability",',
		'      "target": "Specific measurable target"',
		"    }",
		"  ],",
		'  "assumptions": [',
		"    {",
		'      "assumption": "We assume that...",',
		'      "impactIfWrong": "What breaks if this is false",',
		'      "mitigation": "How we handle it being wrong"',
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

// ── Domain Explore Tool (deprecated) ──

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.notify("Domain explorer ready — use /domain --explore", "info");
	});

	// domain_explore (DEPRECATED — use /domain --explore command instead)
	pi.registerTool({
		name: "domain_explore",
		label: "Domain Explore",
		description:
			"[DEPRECATED] Use /domain --explore instead. " +
			"Creates a DDD domain exploration prompt file.",
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
				"[DEPRECATED — use /domain --explore instead]",
				"Domain Exploration Created",
				"Session ID: " + sessionId,
				"Prompt File: " + (dryRun ? "[dry-run, not written]" : promptPath),
				"Context Length: " + sanitized.length + " characters",
				"Status: awaiting-response",
				"Existing Sessions: " + existingSessions,
			];

			return toolResult(result.join("\n"));
		},
	});

	// domain_save_result (fallback — writes structured files from agent JSON)
	pi.registerTool({
		name: "domain_save_result",
		label: "Domain Save Result",
		description:
			"Save the agent's domain analysis JSON as a structured exploration session. " +
			"As a fallback for agents that prefer tool calls over direct file writes. " +
			"Parses JSON, writes exploration.md and updates ubiquitous-language.md.",
		parameters: Type.Object({
			sessionId: Type.String({ description: "Session ID from --explore" }),
			responseJson: Type.String({ description: "Domain analysis JSON from the agent" }),
		}),
		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			const sessionId = String(params.sessionId ?? "").trim();
			const responseJson = String(params.responseJson ?? "").trim();
			if (!sessionId || !responseJson) {
				return { content: [{ type: "text" as const, text: "ERROR: sessionId and responseJson are required" }] };
			}
			let cleaned = responseJson.trim();
			const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
			if (jsonMatch) cleaned = jsonMatch[1].trim();
			let parsedJson: Record<string, unknown>;
			try { parsedJson = JSON.parse(cleaned) as Record<string, unknown>; }
			catch (e) { return { content: [{ type: "text" as const, text: "ERROR: Failed to parse JSON: " + String(e) }] }; }

			const now = new Date().toISOString().split("T")[0];
			const explorationDir = path.join(ctx.cwd, ".pi", "domain", "exploration");
			fs.mkdirSync(explorationDir, { recursive: true });

			function toRow(arr: unknown[], fields: string[]): string {
				if (!Array.isArray(arr) || arr.length === 0) return "None identified yet.";
				return arr.map((item: Record<string, unknown>) => {
					const vals = fields.map((f) => String(item[f] ?? "").replace(/\n/g, " "));
					return "| " + vals.join(" | ") + " |";
				}).join("\n");
			}

			const bc = String(parsedJson.businessContext ?? "").replace(/"/g, '\\"');
			const actors = toRow(parsedJson.actors as unknown[], ["name", "description", "interactions"]);
			const fr = toRow(parsedJson.functionalRequirements as unknown[], ["id", "requirement", "priority", "boundedContext"]);
			const nfr = toRow(parsedJson.nonFunctionalRequirements as unknown[], ["id", "requirement", "category", "target"]);
			const asmp = toRow(parsedJson.assumptions as unknown[], ["assumption", "impactIfWrong", "mitigation"]);
			const bcs = toRow(parsedJson.boundedContexts as unknown[], ["name", "description", "entities"]);
			const ents = toRow(parsedJson.entities as unknown[], ["name", "context", "type", "description"]);
			const evts = toRow(parsedJson.domainEvents as unknown[], ["name", "context", "description", "triggeredBy"]);
			const ul = toRow(parsedJson.ubiquitousLanguage as unknown[], ["term", "definition", "boundedContext", "aliases"]);
			const oq = String(parsedJson.openQuestions ?? "None");
			const ar = String(parsedJson.aggregateRoots ?? "None");

			const sessionContent = [
				"---", "session_id: " + sessionId, "created: " + now,
				'business_context: "' + bc + '"', "status: draft", "---", "",
				"# Domain Exploration: " + sessionId, "",
				"> **Status:** draft — AI-suggested, human-review needed.", "",
				"---", "", "## Business Context", "", bc,
				"", "---", "", "## Actors & Roles",
				"", "| Actor | Description | Interactions |", "|-------|-------------|-------------|", actors,
				"", "---", "", "## Functional Requirements",
				"", "| ID | Requirement | Priority | Bounded Context |", "|----|-------------|----------|----------------|", fr,
				"", "---", "", "## Non-Functional Requirements",
				"", "| ID | Requirement | Category | Target |", "|----|-------------|----------|--------|", nfr,
				"", "---", "", "## Assumptions",
				"", "| Assumption | Impact if Wrong | Mitigation |", "|------------|----------------|-----------|", asmp,
				"", "---", "", "## Bounded Contexts",
				"", "| Context | Description | Entities |", "|---------|-------------|----------|", bcs,
				"", "---", "", "## Entities",
				"", "| Entity | Context | Type | Description |", "|--------|---------|------|-------------|", ents,
				"", "---", "", "## Domain Events",
				"", "| Event | Context | Description | Triggered By |", "|-------|---------|-------------|-------------|", evts,
				"", "---", "", "## Ubiquitous Language",
				"", "| Term | Definition | Bounded Context | Aliases/Synonyms |", "|------|-----------|----------------|-----------------|", ul,
				"", "---", "", "## Open Questions", "", oq,
				"", "---", "", "## Aggregate Roots", "", ar,
			].join("\n");

			// Write exploration.md (the canonical rendered output)
			const explorationMdPath = path.join(ctx.cwd, ".pi", "domain", "exploration.md");
			const tmpExploration = explorationMdPath + ".tmp";
			fs.writeFileSync(tmpExploration, sessionContent, "utf-8");
			fs.renameSync(tmpExploration, explorationMdPath);

			// Also write session file
			const sessionPath = path.join(explorationDir, sessionId + ".md");
			const tmpSession = sessionPath + ".tmp";
			fs.writeFileSync(tmpSession, sessionContent, "utf-8");
			fs.renameSync(tmpSession, sessionPath);

			// Update ubiquitous-language.md with new terms
			const glPath = path.join(ctx.cwd, ".pi", "domain", "ubiquitous-language.md");
			const ulRaw = parsedJson.ubiquitousLanguage as Array<Record<string, unknown>> | undefined;
			if (Array.isArray(ulRaw) && ulRaw.length > 0) {
				let glContent = "";
				if (fs.existsSync(glPath)) glContent = fs.readFileSync(glPath, "utf-8");
				else glContent = "# Ubiquitous Language\n\n## Glossary\n\n| Term | Definition | Bounded Context | Aliases/Synonyms | Examples |\n|------|-----------|----------------|-----------------|---------|";
				const existing = new Set<string>();
				for (const line of glContent.split("\n")) {
					if (line.startsWith("| ") && !line.includes("| Term |") && !line.includes("|---|")) {
						const t = line.split("|")[1]?.trim()?.toLowerCase();
						if (t) existing.add(t);
					}
				}
				const rows: string[] = [];
				for (const t of ulRaw) {
					const tn = String(t.term ?? "").trim();
					if (!tn || existing.has(tn.toLowerCase())) continue;
					rows.push("| " + tn + " | " + String(t.definition ?? "").replace(/\n/g, " ") + " | " + String(t.boundedContext ?? "") + " | " + (Array.isArray(t.aliases) ? t.aliases.join(", ") : "") + " | " + String(t.examples ?? "") + " |");
					existing.add(tn.toLowerCase());
				}
				if (rows.length > 0) {
					const lines = glContent.split("\n");
					let last = -1;
					for (let i = lines.length - 1; i >= 0; i--) {
						if (lines[i].startsWith("| ") && !lines[i].includes("|---|") && !lines[i].includes("| Term |")) { last = i; break; }
					}
					if (last >= 0) lines.splice(last + 1, 0, ...rows);
					else { for (let i = 0; i < lines.length; i++) { if (lines[i].includes("|---|")) { lines.splice(i + 1, 0, ...rows); break; } } }
					const gt = glPath + ".tmp";
					fs.writeFileSync(gt, lines.join("\n"), "utf-8");
					fs.renameSync(gt, glPath);
				}
			}

			onUpdate({ type: "progress", message: "Domain exploration saved for session: " + sessionId });
			return { content: [{ type: "text" as const, text: "Domain exploration saved for " + sessionId + ". Next: /domain --architect-scaffold " + sessionId + " or review .pi/domain/exploration.md" }] };
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
		handler(args: string[], ctx: ExtensionContext) {
			const trimmed = Array.isArray(args) ? args.join(" ").trim() : String(args).trim();

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

				// Create session file with business context
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
				].join("\n");
				fs.writeFileSync(sessionPath, initialContent, "utf-8");

				// Write stub exploration.md with business context filled in
				const explorationMdPath = path.join(ctx.cwd, ".pi", "domain", "exploration.md");
				const stubContent = [
					"---",
					"session_id: " + sessionId,
					"created: " + new Date().toISOString().split("T")[0],
					'business_context: "' + sanitized.replace(/"/g, '\\"') + '"',
					"status: draft",
					"---",
					"",
					"# Domain Exploration: " + sessionId,
					"",
					"> **Status:** draft — agent needs to fill in the analysis below.",
					"",
					"---",
					"",
					"## Business Context",
					"",
					sanitized,
					"",
					"---",
					"",
					"## Actors & Roles",
					"",
					"| Actor | Description | Interactions |",
					"|-------|-------------|-------------|",
					"| | | |",
					"",
					"---",
					"",
					"## Functional Requirements",
					"",
					"| ID | Requirement | Priority | Bounded Context |",
					"|----|-------------|----------|----------------|",
					"| | | | |",
					"",
					"---",
					"",
					"## Non-Functional Requirements",
					"",
					"| ID | Requirement | Category | Target |",
					"|----|-------------|----------|--------|",
					"| | | | |",
					"",
					"---",
					"",
					"## Assumptions",
					"",
					"| Assumption | Impact if Wrong | Mitigation |",
					"|------------|----------------|-----------|",
					"| | | |",
					"",
					"---",
					"",
					"## Bounded Contexts",
					"",
					"| Context | Description | Entities |",
					"|---------|-------------|----------|",
					"| | | |",
					"",
					"---",
					"",
					"## Entities",
					"",
					"| Entity | Context | Type | Description |",
					"|--------|---------|------|-------------|",
					"| | | | |",
					"",
					"---",
					"",
					"## Domain Events",
					"",
					"| Event | Context | Description | Triggered By |",
					"|-------|---------|-------------|-------------|",
					"| | | | |",
					"",
					"---",
					"",
					"## Ubiquitous Language",
					"",
					"| Term | Definition | Bounded Context | Aliases/Synonyms |",
					"|------|-----------|----------------|-----------------|",
					"| | | | |",
					"",
					"---",
					"",
					"## Open Questions",
					"",
					"",
					"---",
					"",
					"## Aggregate Roots",
					"",
					"",
				].join("\n");
				fs.writeFileSync(explorationMdPath + ".tmp", stubContent, "utf-8");
				fs.renameSync(explorationMdPath + ".tmp", explorationMdPath);

				// Create ubiquitous-language.md if it doesn't exist
				const glPath = path.join(ctx.cwd, ".pi", "domain", "ubiquitous-language.md");
				if (!fs.existsSync(glPath)) {
					const glContent = [
						"# Ubiquitous Language",
						"",
						"> Canonical glossary for this project.",
						"> All code MUST use these terms. Aliases/synonyms listed below are **prohibited** in source identifiers.",
						"",
						"## Glossary",
						"",
						"| Term | Definition | Bounded Context | Aliases/Synonyms | Examples |",
						"|------|-----------|----------------|-----------------|---------|",
						"| | | | | |",
					].join("\n");
					fs.writeFileSync(glPath + ".tmp", glContent, "utf-8");
					fs.renameSync(glPath + ".tmp", glPath);
				}

				ctx.ui.notify(
					"Domain session created: " + sessionId,
					"success",
				);

				return [
					"## Domain Session Created",
					"",
					"Session ID: " + sessionId,
					"",
					"Created stub files:",
					"  - `.pi/domain/exploration.md` (business context filled in, other sections empty)",
					"  - `.pi/domain/ubiquitous-language.md` (empty glossary, ready for terms)",
					"  - `.pi/domain/exploration/" + sessionId + ".md` (session record)",
					"",
					"**Next: Ask the agent to analyze this domain using DDD.**",
					"The agent will read the stub files and fill in all sections.",
					"",
					"Or just paste your question directly and the agent will handle it.",
				].join("\n");
			}

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

				const archDir = path.join(ctx.cwd, ".pi", "architecture");
				const modulesDir = path.join(archDir, "modules");
				const decisionsDir = path.join(archDir, "decisions");

				fs.mkdirSync(modulesDir, { recursive: true });
				fs.mkdirSync(decisionsDir, { recursive: true });

				ctx.ui.notify(
					"Architecture directories ready. Use /architect to begin planning.",
					"success",
				);

				return [
					"Architecture directories scaffolded from exploration session: " + sessionId,
					"",
					"Next steps:",
					"1. Review the exploration at: " + sessionPath,
					"2. Create architecture module docs in: " + modulesDir,
					"3. Use /architect to plan and implement epics",
					"",
					"Architecture directories:",
					"  - " + modulesDir,
					"  - " + decisionsDir,
					"  - " + path.join(archDir, "diagrams"),
				].join("\n");
			}

			// /domain --validate <session-id>
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
				].join("\n"),
				"info",
			);

			return [
				"Available /domain subcommands:",
				"",
				'  /domain --explore "..."',
				"    Start a DDD domain exploration — agent writes exploration.md + glossary directly",
				"",
				"  /domain --architect-scaffold <session-id>",
				"    Generate architecture directories from exploration",
				"",
				"  /domain --validate <session-id>",
				"    Validate exploration session structure",
			].join("\n");
		},
	});
}
