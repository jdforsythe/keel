/** Abort `controller` when the call's own `signal` (the input's `signal`, if any) aborts, now or later. */
export function linkSignal(input: unknown, controller: AbortController): void {
  const signal: unknown = typeof input === "object" && input !== null ? Reflect.get(input, "signal") : undefined;
  if (!(signal instanceof AbortSignal)) return;
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", () => controller.abort(), { once: true });
}
