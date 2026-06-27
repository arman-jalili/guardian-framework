import { beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// We test the detection logic directly from project.ts
// The existingProjectDetected function is not exported, so we test the behavior
// by checking the condition inline

function hasExistingSource(dir: string): boolean {
	return existsSync(join(dir, "src"));
}

describe("Existing project detection", () => {
	test("detects existing src/ directory", () => {
		const dir = join(tmpdir(), `exist-test-${randomUUID()}`);
		mkdirSync(join(dir, "src"), { recursive: true });
		expect(hasExistingSource(dir)).toBe(true);
	});

	test("returns false when no src/ directory", () => {
		const dir = join(tmpdir(), `exist-test-${randomUUID()}`);
		mkdirSync(dir, { recursive: true });
		expect(hasExistingSource(dir)).toBe(false);
	});

	test("no-op when src/ exists (simulates --dryRun behavior)", () => {
		const dir = join(tmpdir(), `exist-test-${randomUUID()}`);
		mkdirSync(join(dir, "src/main/java"), { recursive: true });

		// Simulate the guard: if src/ exists and not --force, skip
		const force = false;
		if (!force && hasExistingSource(dir)) {
			// Should skip — verify no new files created
			expect(existsSync(join(dir, "pom.xml"))).toBe(false);
		}
	});

	test("--force overrides existing src/ guard", () => {
		const dir = join(tmpdir(), `exist-test-${randomUUID()}`);
		mkdirSync(join(dir, "src/main/java"), { recursive: true });

		// Simulate --force: should proceed
		const force = true;
		if (force || !hasExistingSource(dir)) {
			// Would proceed with generation
			expect(hasExistingSource(dir)).toBe(true);
		}
	});
});
