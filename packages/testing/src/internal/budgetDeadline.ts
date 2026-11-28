import { currentTestBound } from "./currentTestBound.ts";
import { fail } from "./fail.ts";

/** The budget when neither `budget` nor a test's timeout gives one, in ms from the `simulate` call (k.drive Stalls). */
const DEFAULT_BUDGET_MS = 300_000;
/** The least a test's timeout leaves out of the budget, in ms. */
const LEAST_MARGIN_MS = 50;

/**
 * The `performance.now()` time at which the run's real-time budget is spent (k.drive Stalls): `budget` ms from the
 * call, else the enclosing vitest test's timeout less a tenth of it (at least 50 ms) counted from the instant the
 * runner started the test, else 300,000 ms from the call. `called` is the `performance.now()` time of the call and `epoch` the same instant as an epoch time. A `budget` that is not a positive integer is `schema.invalid`.
 */
export function budgetDeadline(
  budget: number | undefined,
  called: number = performance.now(),
  epoch: number = performance.timeOrigin + called,
): number {
  if (budget !== undefined) {
    if (!Number.isInteger(budget) || budget < 1)
      throw fail(
        "schema.invalid",
        `simulate: budget is a positive integer of milliseconds, got ${String(budget)}`,
        null,
      );
    return called + budget;
  }
  const test = currentTestBound();
  if (test === undefined) return called + DEFAULT_BUDGET_MS;
  const started = called - (epoch - test.startedAt);
  return started + Math.max(0, test.timeout - Math.max(LEAST_MARGIN_MS, test.timeout / 10));
}
