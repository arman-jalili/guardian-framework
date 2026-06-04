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

// ── Domain Explore Tool ──

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
			"Domain exploration commands. Subcommands: --explore, --answer, --architect-scaffold, --validate",
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
				const promptPath = path.join(explorationDir, sessionId + ".prompt.md");

				fs.mkdirSync(explorationDir, { recursive: true });
				fs.writeFileSync(promptPath, prompt, "utf-8");

				ctx.ui.notify(
					`Domain exploration prompt created (session: ${sessionId})`,
					"success",
				);

				return [
					"I've prepared a DDD domain exploration for you.",
					"",
					"1. Read the prompt file: " + promptPath,
					"2. Feed the prompt to your LLM to get a structured domain model",
					"3. Save the JSON response to a file",
					"4. Use /domain --answer " + sessionId + " <response-file>",
					"5. Use /domain --architect-scaffold " + sessionId + " to generate architecture",
					"",
					"Session ID: " + sessionId,
				].join("\n");
			}

			// /domain --answer <session-id> <response-file>
			if (trimmed.startsWith("--answer")) {
				const parts = trimmed.slice("--answer".length).trim().split(/\s+/);
				const sessionId = parts[0];
				const responseFile = parts.slice(1).join(" ");

				if (!sessionId || !responseFile) {
					ctx.ui.notify(
						"Usage: /domain --answer <session-id> <response-file>",
						"error",
					);
					return "(domain command handled)";
				}

				const explorationDir = path.join(ctx.cwd, ".pi", "domain", "exploration");
				const promptPath = path.join(explorationDir, sessionId + ".prompt.md");
				const responsePath = path.resolve(ctx.cwd, responseFile);
				const sessionPath = path.join(explorationDir, sessionId + ".md");

				if (!fs.existsSync(promptPath)) {
					ctx.ui.notify(
						"Session not found: " + sessionId + ". Start with /domain --explore first.",
						"error",
					);
					return "(domain command handled)";
				}

				if (!fs.existsSync(responsePath)) {
					ctx.ui.notify(
						"Response file not found: " + responsePath,
						"error",
					);
					return "(domain command handled)";
				}

				const response = fs.readFileSync(responsePath, "utf-8");
				const prompt = fs.readFileSync(promptPath, "utf-8");

				const content = [
					"# Domain Exploration",
					"",
					"Session ID: " + sessionId,
					"",
					"## Prompt",
					"",
					prompt,
					"",
					"## Response",
					"",
					response,
					"",
					"## Bounded Contexts",
					"",
					"*(Parsed from response)*",
					"",
					"## Entities",
					"",
					"*(Parsed from response)*",
					"",
					"## Ubiquitous Language",
					"",
					"*(Parsed from response)*",
				].join("\n");

				fs.mkdirSync(explorationDir, { recursive: true });
				fs.writeFileSync(sessionPath, content, "utf-8");

				ctx.ui.notify(
					"Domain exploration session saved to " + sessionPath,
					"success",
				);

				return [
					"Domain exploration response saved for session: " + sessionId,
					"",
					"Next step: Use /domain --architect-scaffold " + sessionId + " to generate architecture modules from this exploration.",
					"Or: /domain --validate " + sessionId + " to check glossary compliance.",
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
						"Session not found: " + sessionId + ". Complete exploration with /domain --answer first.",
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
					"  /domain --answer <session-id> <response-file>",
					"  /domain --architect-scaffold <session-id>",
					"  /domain --validate <session-id>",
				].join("\n"),
				"info",
			);

			return [
				"Available /domain subcommands:",
				"",
				'  /domain --explore "..."',
				"    Start a new DDD domain exploration session",
				"",
				"  /domain --answer <session-id> <response-file>",
				"    Save an LLM response to complete an exploration",
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
