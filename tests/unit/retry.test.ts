/**
 * Unit tests for retry.ts
 *
 * Covers:
 *  - calculateBackoff with various inputs
 *  - retry success on first attempt
 *  - retry success after retries
 *  - retry failure after exhausting attempts
 *  - onRetry callback
 *  - custom options
 */

import { describe, expect, test } from "bun:test";
import { calculateBackoff, retry } from "../../src/lib/retry";

// RetryOptions type isn't exported, so we test defaults via behavior
const DEFAULT_MAX_ATTEMPTS = 3;

describe("calculateBackoff", () => {
	test("increases delay exponentially", () => {
		// attempt 1: min(10000 * 2^0, 300000) = 10000
		expect(calculateBackoff(1, 10000, 300000)).toBe(10000);
		// attempt 2: min(10000 * 2^1, 300000) = 20000
		expect(calculateBackoff(2, 10000, 300000)).toBe(20000);
		// attempt 3: min(10000 * 2^2, 300000) = 40000
		expect(calculateBackoff(3, 10000, 300000)).toBe(40000);
	});

	test("caps at maxBackoffMs", () => {
		// attempt 6: min(10000 * 2^5, 100000) = min(320000, 100000) = 100000
		expect(calculateBackoff(6, 10000, 100000)).toBe(100000);
		// attempt 10: cap stays at maxBackoffMs
		expect(calculateBackoff(10, 10000, 100000)).toBe(100000);
	});

	test("works with custom baseDelayMs", () => {
		// attempt 1: min(5000 * 2^0, 60000) = 5000
		expect(calculateBackoff(1, 5000, 60000)).toBe(5000);
		// attempt 4: min(5000 * 2^3, 60000) = min(40000, 60000) = 40000
		expect(calculateBackoff(4, 5000, 60000)).toBe(40000);
	});

	test("low maxBackoffMs is respected", () => {
		// attempt 3: min(10000 * 2^2, 5000) = min(40000, 5000) = 5000
		expect(calculateBackoff(3, 10000, 5000)).toBe(5000);
	});
});

describe("retry", () => {
	test("returns success on first attempt", async () => {
		const result = await retry(async () => "success", {
			maxAttempts: 3,
			baseDelayMs: 1,
			maxBackoffMs: 10,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe("success");
			expect(result.attempts).toBe(1);
		}
	});

	test("retries on failure and succeeds", async () => {
		let attempts = 0;
		const result = await retry(
			async () => {
				attempts++;
				if (attempts < 3) throw new Error(`attempt ${attempts} failed`);
				return "recovered";
			},
			{ maxAttempts: 3, baseDelayMs: 1, maxBackoffMs: 10 },
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe("recovered");
			expect(result.attempts).toBe(3);
		}
	});

	test("fails after exhausting all attempts", async () => {
		let attempts = 0;
		const result = await retry(
			async () => {
				attempts++;
				throw new Error("persistent failure");
			},
			{ maxAttempts: 3, baseDelayMs: 1, maxBackoffMs: 10 },
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toBe("persistent failure");
			expect(result.attempts).toBe(3);
		}
		expect(attempts).toBe(3);
	});

	test("calls onRetry callback on each retry", async () => {
		let attempts = 0;
		const retryEvents: { attempt: number; error: string; delayMs: number }[] = [];

		const result = await retry(
			async () => {
				attempts++;
				throw new Error(`fail #${attempts}`);
			},
			{
				maxAttempts: 3,
				baseDelayMs: 1,
				maxBackoffMs: 10,
				onRetry: (attempt, error, delayMs) => {
					retryEvents.push({ attempt, error: error.message, delayMs });
				},
			},
		);

		expect(result.ok).toBe(false);
		expect(retryEvents).toHaveLength(2); // 2 retries for 3 attempts
		expect(retryEvents[0].attempt).toBe(1);
		expect(retryEvents[0].error).toBe("fail #1");
		expect(retryEvents[1].attempt).toBe(2);
		expect(retryEvents[1].error).toBe("fail #2");
	});

	test("handles non-Error thrown values", async () => {
		const result = await retry(
			async () => {
				throw "string error";
			},
			{ maxAttempts: 1 },
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.message).toBe("string error");
		}
	});

	test("uses maxAttempts=3 with successful retry", async () => {
		let attempts = 0;
		const result = await retry(
			async () => {
				attempts++;
				if (attempts < 3) throw new Error("fail");
				return "recovered";
			},
			{ maxAttempts: 3, baseDelayMs: 1, maxBackoffMs: 10 },
		);

		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe("recovered");
		expect(attempts).toBe(3);
	});
});
