/** Whether a Playwright error is a document going away under an `evaluate` (a navigation), which the wait retries. */
export function lostContext(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /Execution context was destroyed|Cannot find context|navigation|frame was detached|Target closed/i.test(m);
}
