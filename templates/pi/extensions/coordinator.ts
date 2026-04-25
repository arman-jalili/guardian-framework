# Coordinator Extension

Master orchestrator for GuardianCLI workflows.

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

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
      let scope = params.scope;
      if (!scope) {
        const scopeResult = await ctx.tools.execute("guardian_scope", {});
        scope = scopeResult.result?.scope || "moderate";
      }

      onUpdate({ type: "progress", message: `Scope: ${scope}` });

      // 2. Determine validators based on scope
      const validatorMap: Record<string, string[]> = {
        simple: ["ci"],
        moderate: ["ci", "architecture"],
        complex: ["ci", "architecture", "security"],
        critical: ["ci", "architecture", "security", "operations", "tests"],
      };

      const validators = params.validators || validatorMap[scope] || validatorMap.moderate;

      onUpdate({ type: "progress", message: `Validators: ${validators.join(", ")}` });

      // 3. Run validators
      const validationResults = await ctx.tools.execute("guardian_validate", {
        validators: validators.filter(v => v !== "architecture"), // architecture is manual
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
          nextSteps: scope === "critical" ? ["Request human approval"] : ["Proceed with implementation"],
        }
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
```