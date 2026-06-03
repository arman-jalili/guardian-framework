import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { runProjectGenerator } from "../../src/lib/project-generator";
import { generateBuildConfig } from "../../src/lib/build-config";
import { generateCiPipeline } from "../../src/lib/ci-generator";

function tempDir(): string {
	const dir = join(tmpdir(), `proj-e2e-${randomUUID()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

describe("E2E: Java Maven project create", () => {
	test("full lifecycle creates all expected directories and files", () => {
		const dir = tempDir();
		const archDir = join(dir, ".pi/architecture");
		mkdirSync(join(archDir, "modules"), { recursive: true });
		writeFileSync(join(archDir, "modules/billing.md"), "# Billing\n\nBilling module", "utf-8");
		writeFileSync(join(archDir, "modules/shared.md"), "# Shared\n\nShared module", "utf-8");

		const defaults = { layers: ["domain", "application", "infrastructure", "interfaces/http", "interfaces/messaging"] };

		// Run all generators
		const structure = runProjectGenerator(dir, archDir, {
			language: "java", groupId: "com.myapp", dryRun: false, defaults,
		});

		generateBuildConfig(dir, {
			language: "java", buildTool: "maven", groupId: "com.myapp",
			projectName: "myapp", version: "0.1.0", layers: structure.layers,
		});

		generateCiPipeline(dir, {
			language: "java", buildTool: "maven", repoTool: "gh",
			validators: ["ci", "tests", "security"],
		});

		// Verify directory structure
		expect(existsSync(join(dir, "src/main/java/com/myapp/billing/domain/.gitkeep"))).toBe(true);
		expect(existsSync(join(dir, "src/main/java/com/myapp/billing/interfaces/http/.gitkeep"))).toBe(true);
		expect(existsSync(join(dir, "src/main/java/com/myapp/billing/interfaces/messaging/.gitkeep"))).toBe(true);
		expect(existsSync(join(dir, "src/main/java/com/myapp/Shared/domain/.gitkeep"))).toBe(true);
		expect(existsSync(join(dir, "src/main/java/com/myapp/Shared/interfaces/http/.gitkeep"))).toBe(true);

		// Verify build config
		const pomContent = readFileSync(join(dir, "pom.xml"), "utf-8");
		expect(pomContent).toContain("com.myapp");
		expect(pomContent).toContain("myapp");
		expect(pomContent).toContain("spring-boot-starter-web");
		expect(pomContent).toContain("spring-boot-starter-amqp");

		// Verify CI pipeline
		const ciContent = readFileSync(join(dir, ".github/workflows/ci.yml"), "utf-8");
		expect(ciContent).toContain("run_hardening_stages.sh");

		// Verify placeholder file has canonical reference
		const placeholder = readFileSync(
			join(dir, "src/main/java/com/myapp/billing/domain/Billing_domain.java"), "utf-8"
		);
		expect(placeholder).toContain("Canonical Reference");
	});
});
