import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { applyUninstallPlan, createUninstallPlan } from "../src/commands/uninstall";
import { addFileRecord, createManifest, writeManifest } from "../src/lib/manifest";

describe("uninstall", () => {
	test("plans only manifest-managed files under Guardian roots", () => {
		const dir = makeFixture();
		writeManagedFile(dir, ".pi/agent/AGENTS.md", "agent");
		writeManagedFile(dir, ".claude/README.md", "generated");
		writeManagedFile(dir, "src/app.ts", "user");

		const manifest = createManifest({
			language: "typescript",
			repoTool: "gh",
			tools: ["pi", "claude"],
			validators: ["ci"],
			workflows: [],
		});
		addFileRecord(manifest, ".pi/agent/AGENTS.md", "framework", "agent");
		addFileRecord(manifest, ".claude/README.md", "generated", "generated");
		addFileRecord(manifest, "src/app.ts", "user", "user");
		writeManifest(dir, manifest);

		const plan = createUninstallPlan(dir);

		expect(plan.filesToRemove).toContain(".pi/agent/AGENTS.md");
		expect(plan.filesToRemove).toContain(".claude/README.md");
		expect(plan.filesToRemove).toContain("guardian-manifest.json");
		expect(plan.filesToRemove).not.toContain("src/app.ts");
	});

	test("detects modified managed files before removal", () => {
		const dir = makeFixture();
		writeManagedFile(dir, ".pi/context/project.md", "original");

		const manifest = createManifest({
			language: "typescript",
			repoTool: "gh",
			tools: ["pi"],
			validators: ["ci"],
			workflows: [],
		});
		addFileRecord(manifest, ".pi/context/project.md", "user", "original");
		writeManifest(dir, manifest);

		writeManagedFile(dir, ".pi/context/project.md", "changed");

		const plan = createUninstallPlan(dir);

		expect(plan.blockedFiles).toEqual([".pi/context/project.md"]);
	});

	test("applies uninstall plan without removing unrelated files", () => {
		const dir = makeFixture();
		writeManagedFile(dir, ".pi/README.md", "pi");
		writeManagedFile(dir, ".claude/README.md", "claude");
		writeManagedFile(dir, "src/app.ts", "keep");

		const manifest = createManifest({
			language: "typescript",
			repoTool: "gh",
			tools: ["pi", "claude"],
			validators: ["ci"],
			workflows: [],
		});
		addFileRecord(manifest, ".pi/README.md", "framework", "pi");
		addFileRecord(manifest, ".claude/README.md", "generated", "claude");
		writeManifest(dir, manifest);

		applyUninstallPlan(dir, createUninstallPlan(dir));

		expect(fs.existsSync(path.join(dir, ".pi/README.md"))).toBe(false);
		expect(fs.existsSync(path.join(dir, ".claude/README.md"))).toBe(false);
		expect(fs.existsSync(path.join(dir, "guardian-manifest.json"))).toBe(false);
		expect(fs.existsSync(path.join(dir, "src/app.ts"))).toBe(true);
	});
});

function makeFixture(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "guardian-uninstall-"));
}

function writeManagedFile(root: string, relativePath: string, content: string): void {
	const fullPath = path.join(root, relativePath);
	fs.mkdirSync(path.dirname(fullPath), { recursive: true });
	fs.writeFileSync(fullPath, content, "utf-8");
}
