/**
 * Shared export mappings for Guardian
 *
 * Single source of truth for how .pi/ files map to tool-specific exports.
 * Used by both the init and generate commands.
 */

import type { Tool } from "./templates.js";

/**
 * Directory structure for a given export tool.
 */
export function getExportStructure(tool: Tool): string[] {
	switch (tool) {
		case "claude":
			return [
				"context",
				"agents/orchestrators",
				"agents/validators",
				"agents/implementers",
				"workflows",
				"scripts",
				"architecture/modules",
				"architecture/diagrams",
				"architecture/decisions",
			];
		case "opencode":
			return ["context", "prompts", "workflows", "scripts"];
		case "agents":
			return ["agents", "context", "workflows", "scripts"];
		case "github":
			return ["instructions", "agents", "copilot"];
		case "omp":
			return ["agents", "extensions"];

		case "pi":
			return ["skills"];
		default:
			return [];
	}
}

/**
 * Export mapping from a .pi/ source file to a tool-specific destination.
 */
export interface ExportMapping {
	source: string;
	dest: string;
	transform?: (content: string) => string;
}

/**
 * Get export file mappings for a given tool.
 */
export function getExportMappings(tool: Tool): ExportMapping[] {
	switch (tool) {
		case "claude":
			return [
				// Main project instructions
				{ source: "agent/AGENTS.md", dest: "CLAUDE.md" },
				// Context files
				{ source: "context/patterns.md", dest: "context/patterns.md" },
				{ source: "context/checklists.md", dest: "context/checklists.md" },
				{ source: "context/output-formats.md", dest: "context/output-formats.md" },
				{ source: "context/project.md", dest: "context/project.md" },
				// Architecture files
				{ source: "architecture/CHANGELOG.md", dest: "architecture/CHANGELOG.md" },
				// Agent definitions
				{
					source: "skills/agents/architecture-coordinator.md",
					dest: "agents/orchestrators/architecture-coordinator.md",
				},
				{
					source: "skills/agents/architecture-validator.md",
					dest: "agents/validators/architecture-validator.md",
				},
				{
					source: "skills/agents/security-validator.md",
					dest: "agents/validators/security-validator.md",
				},
				{
					source: "skills/agents/operations-validator.md",
					dest: "agents/validators/operations-validator.md",
				},
				{ source: "skills/agents/test-validator.md", dest: "agents/validators/test-validator.md" },
				{
					source: "skills/agents/integration-validator.md",
					dest: "agents/validators/integration-validator.md",
				},
				{
					source: "skills/agents/ci-mr-validator.md",
					dest: "agents/validators/ci-mr-validator.md",
				},
				{
					source: "skills/agents/code-developer.md",
					dest: "agents/implementers/code-developer.md",
				},
				{ source: "skills/agents/issue-creator.md", dest: "agents/implementers/issue-creator.md" },
				{
					source: "skills/agents/documentation-maintainer.md",
					dest: "agents/implementers/documentation-maintainer.md",
				},
				// Workflow prompts
				{ source: "prompts/feature-development.md", dest: "workflows/feature-development.md" },
				{ source: "prompts/bug-fix.md", dest: "workflows/bug-fix.md" },
				{ source: "prompts/hotfix.md", dest: "workflows/hotfix.md" },
				{ source: "prompts/refactoring.md", dest: "workflows/refactoring.md" },
				{ source: "prompts/epic-plan.md", dest: "workflows/epic-plan.md" },
				{ source: "prompts/issue-draft.md", dest: "workflows/issue-draft.md" },
				{ source: "prompts/git-issues.md", dest: "workflows/git-issues.md" },
				{ source: "prompts/issue-closeout.md", dest: "workflows/issue-closeout.md" },
				{ source: "prompts/issue-merge.md", dest: "workflows/issue-merge.md" },
				{ source: "prompts/plan-to-issues.md", dest: "workflows/plan-to-issues.md" },
				{ source: "prompts/blueprint-validate.md", dest: "workflows/blueprint-validate.md" },
				{ source: "prompts/sync-check.md", dest: "workflows/sync-check.md" },
				{ source: "prompts/context-refresh.md", dest: "workflows/context-refresh.md" },
				{ source: "prompts/scope-analyzer.md", dest: "workflows/scope-analyzer.md" },
				{ source: "prompts/pattern-extract.md", dest: "workflows/pattern-extract.md" },
				{ source: "prompts/blueprint-update.md", dest: "workflows/blueprint-update.md" },
				// Reference
				{ source: "INDEX.md", dest: "context/INDEX.md" },
			];
		case "opencode":
			return [
				{ source: "agent/AGENTS.md", dest: "context.md" },
				{ source: "context/patterns.md", dest: "context/patterns.md" },
				{ source: "context/checklists.md", dest: "context/checklists.md" },
				{ source: "context/output-formats.md", dest: "context/output-formats.md" },
				{ source: "INDEX.md", dest: "INDEX.md" },
				// Agents as .txt prompts
				{
					source: "skills/agents/architecture-coordinator.md",
					dest: "prompts/architecture-coordinator.txt",
					transform: (c) => c.replace(/^---\n.*?\n---\n/, "").trim(),
				},
				{
					source: "skills/agents/code-developer.md",
					dest: "prompts/code-developer.txt",
					transform: (c) => c.replace(/^---\n.*?\n---\n/, "").trim(),
				},
			];
		case "agents":
			return [
				{ source: "agent/AGENTS.md", dest: "context/project.md" },
				{ source: "context/patterns.md", dest: "context/patterns.md" },
				{ source: "context/checklists.md", dest: "context/checklists.md" },
				{ source: "context/output-formats.md", dest: "context/output-formats.md" },
				// Flat agent structure
				{
					source: "skills/agents/architecture-coordinator.md",
					dest: "agents/architecture-coordinator.md",
				},
				{
					source: "skills/agents/architecture-validator.md",
					dest: "agents/architecture-validator.md",
				},
				{ source: "skills/agents/security-validator.md", dest: "agents/security-validator.md" },
				{ source: "skills/agents/operations-validator.md", dest: "agents/operations-validator.md" },
				{ source: "skills/agents/test-validator.md", dest: "agents/test-validator.md" },
				{
					source: "skills/agents/integration-validator.md",
					dest: "agents/integration-validator.md",
				},
				{ source: "skills/agents/ci-mr-validator.md", dest: "agents/ci-mr-validator.md" },
				{ source: "skills/agents/code-developer.md", dest: "agents/code-developer.md" },
				{ source: "skills/agents/issue-creator.md", dest: "agents/issue-creator.md" },
				{
					source: "skills/agents/documentation-maintainer.md",
					dest: "agents/documentation-maintainer.md",
				},
				{ source: "INDEX.md", dest: "INDEX.md" },
			];
		case "github":
			return [
				// Main instructions
				{ source: "agent/AGENTS.md", dest: "copilot-instructions.md" },
				// Custom instructions
				{
					source: "github/instructions/architecture.instructions.md",
					dest: "instructions/architecture.instructions.md",
				},
				{
					source: "github/instructions/validation.instructions.md",
					dest: "instructions/validation.instructions.md",
				},
				// Agent definitions
				{
					source: "github/agents/architecture-coordinator.agent.md",
					dest: "agents/architecture-coordinator.agent.md",
				},
				{ source: "github/agents/epic-planner.agent.md", dest: "agents/epic-planner.agent.md" },
				// Settings
				{ source: "github/copilot/settings.json", dest: "copilot/settings.json" },
			];
		case "pi":
			return [
				// Transform .pi/skills/agents/*.md → .agents/skills/<name>/SKILL.md
				// Pi's skill system expects each skill in its own directory with a SKILL.md
				{
					source: "skills/agents/architecture-coordinator.md",
					dest: "skills/architecture-coordinator/SKILL.md",
				},
				{
					source: "skills/agents/architecture-validator.md",
					dest: "skills/architecture-validator/SKILL.md",
				},
				{
					source: "skills/agents/security-validator.md",
					dest: "skills/security-validator/SKILL.md",
				},
				{
					source: "skills/agents/operations-validator.md",
					dest: "skills/operations-validator/SKILL.md",
				},
				{
					source: "skills/agents/test-validator.md",
					dest: "skills/test-validator/SKILL.md",
				},
				{
					source: "skills/agents/integration-validator.md",
					dest: "skills/integration-validator/SKILL.md",
				},
				{
					source: "skills/agents/ci-mr-validator.md",
					dest: "skills/ci-mr-validator/SKILL.md",
				},
				{
					source: "skills/agents/code-developer.md",
					dest: "skills/code-developer/SKILL.md",
				},
				{
					source: "skills/agents/issue-creator.md",
					dest: "skills/issue-creator/SKILL.md",
				},
				{
					source: "skills/agents/documentation-maintainer.md",
					dest: "skills/documentation-maintainer/SKILL.md",
				},
			];
		case "omp":
			return [
				// Main project instructions — oh-my-pi discovers AGENTS.md automatically
				{ source: "agent/AGENTS.md", dest: "AGENTS.md" },
				// Agent definitions — oh-my-pi discovers from .omp/agents/*.md
				{
					source: "skills/agents/architecture-coordinator.md",
					dest: "agents/architecture-coordinator.md",
				},
				{
					source: "skills/agents/architecture-validator.md",
					dest: "agents/architecture-validator.md",
				},
				{
					source: "skills/agents/security-validator.md",
					dest: "agents/security-validator.md",
				},
				{
					source: "skills/agents/operations-validator.md",
					dest: "agents/operations-validator.md",
				},
				{
					source: "skills/agents/test-validator.md",
					dest: "agents/test-validator.md",
				},
				{
					source: "skills/agents/integration-validator.md",
					dest: "agents/integration-validator.md",
				},
				{
					source: "skills/agents/ci-mr-validator.md",
					dest: "agents/ci-mr-validator.md",
				},
				{
					source: "skills/agents/code-developer.md",
					dest: "agents/code-developer.md",
				},
				{
					source: "skills/agents/issue-creator.md",
					dest: "agents/issue-creator.md",
				},
				{
					source: "skills/agents/documentation-maintainer.md",
					dest: "agents/documentation-maintainer.md",
				},
			];
		default:
			return [];
	}
}

/**
 * Generate README for export directory.
 */
export function generateExportReadme(tool: Tool): string {
	return `# Guardian Framework (${tool})

Generated from .pi/ source.

## Quick Reference

See INDEX.md for framework structure.

## Commands

- \`npx guardian-framework generate --tool ${tool}\` — Regenerate from .pi/
- \`npx guardian-framework update\` — Update .pi/ source

---

Generated by Guardian
`;
}
