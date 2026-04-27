/**
 * Validation Runner Extension for pi
 *
 * Runs validation scripts as pi tools and commands.
 */

type ShellResult = {
	exitCode: number;
	stdout: string;
	stderr?: string;
};

type ExtensionContext = {
	ui: { notify(message: string, level?: string): void };
	shell: { execute(command: string, options?: { signal?: AbortSignal }): Promise<ShellResult> };
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
	// Session initialization
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.notify("GuardianCLI validation runner initialized", "info");
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
				Type.String({
					description: "Scope classification: simple, moderate, complex, critical",
				}),
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

	// Register validate command
	pi.registerCommand("validate", {
		description: "Run all or specific validators",
		handler: async (args, ctx) => {
			const validators =
				args.length > 0 ? args : ["ci", "tests", "operations", "security", "canonical"];
			ctx.ui.notify(`Running validators: ${validators.join(", ")}`, "info");

			// Execute validation tool
			const result = await ctx.tools.execute("guardian_validate", {
				validators,
				scope: "moderate",
			});

			return result;
		},
	});

	// Register scope command
	pi.registerCommand("scope", {
		description: "Get scope classification for current changes",
		handler: async (_args, ctx) => {
			const diff = await ctx.shell.execute("git diff --numstat HEAD");
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
			const scope = classifyScope(fileCount, lineChanges);

			ctx.ui.notify(`Scope: ${scope} (${fileCount} files, ~${lineChanges} lines)`, "info");
			return { scope, fileCount, lineChanges };
		},
	});

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
}
