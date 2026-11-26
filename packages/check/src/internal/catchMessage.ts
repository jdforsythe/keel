/**
 * E1452's message by what it found (k.errors Rules): a `try`/`catch`, a catching callee (`catch`, `then`,
 * `allSettled`, `any`), a control exit from a `finally`, or a catching callee used other than as a call (`value:<name>`).
 */
export function catchMessage(kind: string): string {
  if (kind === "finally") return "control leaves finally and drops its throw";
  if (kind === "catch") return ".catch() in app code; use attempt(fn)";
  if (kind === "then") return ".then() given a second argument in app code; use attempt(fn)";
  if (kind === "allSettled" || kind === "any") return `Promise.${kind} in app code; use attempt(fn)`;
  if (kind.startsWith("value:"))
    return `${kind.slice("value:".length)} used other than as a call; check cannot follow it`;
  return "try/catch in app code; use attempt(fn)";
}
