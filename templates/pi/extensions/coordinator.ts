/**
 * Coordinator Extension for pi
 *
 * Master orchestrator for GuardianCLI workflows.
 * Uses guardian_scope, guardian_validate, and ask_user_question tools.
 */

type ExtensionContext = {
	ui: { notify(message: string, level?: string): void };
	tools: { execute(name: string, params: Record<string, unknown>): Promise<unknown> };
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
	registerCommand(
		name: string,
		options: {
			description: string;
			handler(args: string[], ctx: ExtensionContext): unknown | Promise<unknown>;
		},
	): void;
};

const Type = {
	Array: (items: unknown, options: Record<string, unknown> = {}) => ({
		...options,
		items,
		type: "array",
	}),
	Object: (properties: Record<string, unknown>) => ({ properties, type: "object" }),
	Optional: (schema: unknown) => schema,
	String: (options: Record<string, unknown> = {}) => ({ ...options, type: "string" }),
};

const VALIDATORS = {
	architecture: ".pi/scripts/validate-architecture.sh",
	canonical: ".pi/scripts/validate-canonical.sh",
	ci: ".pi/scripts/validate-ci.sh",
	integration: ".pi/scripts/validate-integration.sh",
	operations: ".pi/scripts/validate-operations.sh",
	security: ".pi/scripts/validate-security.sh",
	tests: ".pi/scripts/validate-tests.sh",
} as const;

type ValidatorName = keyof typeof VALIDATORS;

function isValidatorName(value: string): value is ValidatorName {
	return Object.hasOwn(VALIDATORS, value);
}

function classifyScope(fileCount: number, lineChanges: number): string {
	if (fileCount > 15 || lineChanges > 500) return "critical";
	if (fileCount > 5 || lineChanges > 200) return "complex";
	if (fileCount > 2 || lineChanges > 50) return "moderate";
	return "simple";
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.notify("GuardianCLI coordinator ready", "info");
	});

	// Register coordinator tool
	pi.registerTool({
		name: "guardian_coordinate",
		label: "Guardian Coordinate",
		description: "Orchestrate a GuardianCLI workflow with scope classification and validation",
		parameters: Type.Object({
			task: Type.String({ description: "Task description" }),
			scope: Type.Optional(Type.String({ description: "Override scope classification" })),
			validators: Type.Optional(Type.Array(Type.String())),
		}),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			// 1. Classify scope (or use override)
			let scope = typeof params.scope === "string" ? params.scope : undefined;
			if (!scope) {
				const scopeResult = (await ctx.tools.execute("guardian_scope", {})) as {
					result?: { scope?: string };
				};
				scope = scopeResult.result?.scope || "moderate";
			}

			onUpdate({ type: "progress", message: `Scope: ${scope}` });

			// 2. Determine validators based on scope
			const validatorMap: Record<string, string[]> = {
				simple: ["ci", "canonical"],
				moderate: ["ci", "architecture", "canonical"],
				complex: ["ci", "architecture", "security", "tests", "integration", "canonical"],
				critical: [
					"ci",
					"architecture",
					"security",
					"operations",
					"tests",
					"integration",
					"canonical",
				],
			};

			const validators = Array.isArray(params.validators)
				? params.validators.filter(
						(validator): validator is string => typeof validator === "string",
					)
				: validatorMap[scope] || validatorMap.moderate;

			onUpdate({ type: "progress", message: `Validators: ${validators.join(", ")}` });

			// 3. Run validators
			const validationResults = await ctx.tools.execute("guardian_validate", {
				validators,
				scope,
			});

			// 4. Return coordination result
			return {
				type: "success",
				result: {
					task: params.task,
					scope,
					validators,
					validationResults,
					nextSteps:
						scope === "critical" ? ["Request human approval"] : ["Proceed with implementation"],
				},
			};
		},
	});

	// Register scope tool
	pi.registerTool({
		name: "guardian_scope",
		label: "Guardian Scope",
		description: "Classify current git diff scope using Guardian thresholds",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
			if (signal.aborted) {
				return { type: "error", error: "Scope classification aborted" };
			}

			const diff = await ctx.shell.execute("git diff --numstat HEAD", { signal });
			const rows = diff.stdout.split("\n").filter((line) => line.trim());
			const fileCount = rows.length;
			const lineChanges = rows.reduce((sum, row) => {
				const [added, removed] = row.split(/\s+/);
				const addedCount = Number.parseInt(added, 10);
				const removedCount = Number.parseInt(removed, 10);
				return (
					sum +
					(Number.isFinite(addedCount) ? addedCount : 0) +
					(Number.isFinite(removedCount) ? removedCount : 0)
				);
			}, 0);

			return {
				type: "success",
				result: {
					scope: classifyScope(fileCount, lineChanges),
					fileCount,
					lineChanges,
				},
			};
		},
	});

	// Register validation tool
	pi.registerTool({
		name: "guardian_validate",
		label: "Guardian Validate",
		description: "Run GuardianCLI validation scripts for a specific category",
		parameters: Type.Object({
			validators: Type.Array(Type.String(), {
				description:
					"Validation categories: ci, tests, operations, security, integration, architecture, canonical",
			}),
			scope: Type.Optional(
				Type.String({ description: "Scope classification: simple, moderate, complex, critical" }),
			),
		}),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const results: Record<string, { passed: boolean; output: string }> = {};
			const validators = Array.isArray(params.validators)
				? params.validators.filter(
						(validator): validator is string => typeof validator === "string",
					)
				: [];

			for (const validator of validators) {
				if (signal.aborted) break;

				if (!isValidatorName(validator)) {
					results[validator] = {
						passed: false,
						output: `Unsupported validator: ${validator}`,
					};
					continue;
				}

				onUpdate({ type: "progress", message: `Running ${validator} validation...` });

				const scriptPath = VALIDATORS[validator];
				try {
					const result = await ctx.shell.execute(`bash ${scriptPath}`, { signal });
					results[validator] = {
						passed: result.exitCode === 0,
						output: result.stdout,
					};
				} catch (error) {
					results[validator] = {
						passed: false,
						output: `Error: ${error}`,
					};
				}
			}

			const allPassed = Object.values(results).every((r) => r.passed);

			return {
				type: "success",
				result: {
					summary: allPassed ? "All validations passed" : "Some validations failed",
					results,
					scope: typeof params.scope === "string" ? params.scope : "moderate",
				},
			};
		},
	});
}
