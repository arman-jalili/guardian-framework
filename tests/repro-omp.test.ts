import { runInit } from "../src/commands/init";

// Direct call to scaffoldFramework with omp tool
runInit("/tmp/test-omp-scaffold", {
  tools: ["pi", "claude", "omp"],
  language: "typescript",
  repoTool: "gh",
  validators: ["ci", "tests", "architecture", "security"],
  workflows: ["feature-development", "bug-fix"],
  projectName: "test-project",
  projectVersion: "0.1.0",
  projectType: "Library",
  repository: "owner/repo",
}).then(() => console.log("DONE")).catch(e => console.error("ERROR:", e.message));
