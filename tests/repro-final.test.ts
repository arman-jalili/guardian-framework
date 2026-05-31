import { runInit } from "../src/commands/init";

// Create a clean test directory
import fs from "fs";
import path from "path";

const dir = "/tmp/guardian-repro-final";
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

// Mock the prompt function to return specific values
// We need to go through runInit which calls runInitPrompts
// Let's directly create the .pi and call generate


// Actually scaffoldFramework is not exported. Let me just test generateExport directly
// with ALL the user's selected validators
import { generateExport } from "../src/commands/generate";
import { createManifest } from "../src/lib/manifest";

const piDir = path.join(dir, ".pi");

// Full .pi structure as scaffoldFramework creates it
const scaffoldDirs = ["agent", "context", "skills/agents", "skills/validators", "prompts", "scripts", "extensions", "workspaces"];
for (const d of scaffoldDirs) {
  fs.mkdirSync(path.join(piDir, d), { recursive: true });
}

// Create all the stub files that the templates would create
fs.writeFileSync(path.join(piDir, "agent", "AGENTS.md"), "---\nagent:\n  max_turns: 20\n---\n\n# Test Project\n");
fs.writeFileSync(path.join(piDir, "INDEX.md"), "# Index\n");

// Agent files
const agentNames = [
  "architecture-coordinator", "architecture-validator", "security-validator",
  "operations-validator", "test-validator", "integration-validator", "ci-mr-validator",
  "code-developer", "issue-creator", "documentation-maintainer", "subagent-registry",
  "commit", "push", "pull", "land", "debug", "goal-loop", "hooks", "kanban",
  "pipeline", "plan-mode", "session-persistence", "slash-commands", "snippets",
  "curator", "architecture-generator",
];
for (const name of agentNames) {
  fs.writeFileSync(path.join(piDir, "skills/agents", `${name}.md`), `# ${name}\n`);
}

// All validators
const validators = ["ci", "tests", "architecture", "canonical", "security", "operations", "integration"];
for (const v of validators) {
  fs.writeFileSync(path.join(piDir, "scripts", `validate-${v}.sh`), `echo ${v}\n`);
}
fs.writeFileSync(path.join(piDir, "scripts", "validation-cache.sh"), "echo cache\n");

// Workflow prompts
const workflows = ["feature-development", "bug-fix", "hotfix", "refactoring",
  "epic-plan", "issue-draft", "git-issues", "issue-closeout", "issue-merge",
  "plan-to-issues", "blueprint-validate", "sync-check", "context-refresh",
  "scope-analyzer", "pattern-extract", "blueprint-update", "issue-implementation-series"];
for (const w of workflows) {
  fs.writeFileSync(path.join(piDir, "prompts", `${w}.md`), `# ${w}\n`);
}

// Create manifest
const manifest = createManifest({
  tools: ["claude", "omp"],
  language: "typescript",
  repoTool: "gh",
  validators: validators,
  workflows: workflows,
});

const generatedFiles: Record<string, any> = {};

console.log("Testing claude export...");
generateExport(path.join(dir, ".claude"), "claude" as any, piDir, manifest as any, generatedFiles);
console.log("Claude OK");

console.log("Testing omp export...");
generateExport(path.join(dir, ".omp"), "omp" as any, piDir, manifest as any, generatedFiles);
console.log("OMP OK");

// Check results
console.log("\n.omp contents:");
for (const f of fs.readdirSync(path.join(dir, ".omp"))) {
  const stat = fs.statSync(path.join(dir, ".omp", f));
  if (stat.isDirectory()) {
    console.log(`  ${f}/`);
    for (const sf of fs.readdirSync(path.join(dir, ".omp", f))) {
      console.log(`    ${sf}`);
    }
  } else {
    console.log(`  ${f}`);
  }
}
