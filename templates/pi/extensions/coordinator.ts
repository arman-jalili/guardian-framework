/**
 * Coordinator Extension for pi
 *
 * Master orchestrator for GuardianCLI workflows.
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

	// Register workflow command
	pi.registerCommand("workflow", {
		description: "Start a GuardianCLI workflow",
		handler: async (args, ctx) => {
			const taskType = args[0] || "feature";
			const taskDescription = args.slice(1).join(" ") || "No description provided";

			ctx.ui.notify(`Starting ${taskType} workflow: ${taskDescription}`, "info");

			return await ctx.tools.execute("guardian_coordinate", {
				task: `${taskType}: ${taskDescription}`,
			});
		},
	});
}
