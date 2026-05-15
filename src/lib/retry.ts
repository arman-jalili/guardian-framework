/**
 * Retry utility with exponential backoff for Guardian
 *
 * Based on Symphony's retry specification (Section 8.4):
 * - Normal continuation: fixed 1s delay
 * - Failure-driven: delay = min(10000 * 2^(attempt-1), maxBackoffMs)
 * - Power capped by configured max retry backoff (default 300000 / 5m)
 */

export interface RetryOptions {
	maxAttempts: number;
	maxBackoffMs: number;
	baseDelayMs: number;
	onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
	maxAttempts: 3,
	maxBackoffMs: 300000,
	baseDelayMs: 10000,
};

export type RetryResult<T> =
	| {
			ok: true;
			value: T;
			attempts: number;
	  }
	| {
			ok: false;
			error: Error;
			attempts: number;
	  };

/**
 * Execute a function with exponential backoff retry.
 */
export async function retry<T>(
	fn: () => Promise<T>,
	options: Partial<RetryOptions> = {},
): Promise<RetryResult<T>> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
		try {
			const value = await fn();
			return { ok: true, value, attempts: attempt };
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));

			if (attempt < opts.maxAttempts) {
				const delayMs = calculateBackoff(attempt, opts.baseDelayMs, opts.maxBackoffMs);
				opts.onRetry?.(attempt, lastError, delayMs);
				await sleep(delayMs);
			}
		}
	}

	return { ok: false, error: lastError ?? new Error("unknown error"), attempts: opts.maxAttempts };
}

/**
 * Calculate exponential backoff delay.
 * delay = min(baseDelayMs * 2^(attempt-1), maxBackoffMs)
 */
export function calculateBackoff(
	attempt: number,
	baseDelayMs: number,
	maxBackoffMs: number,
): number {
	const delay = baseDelayMs * 2 ** (attempt - 1);
	return Math.min(delay, maxBackoffMs);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
