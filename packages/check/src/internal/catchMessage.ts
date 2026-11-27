/** The tail of E1452's message for a catching callee (k.errors Rules). */
const AWAIT_IT = " in app code: await it; an expected failure is attempt(fn, expect)";

/**
 * E1452's message by what it found (k.errors Rules, k.attempt Rules): a `try`/`catch`, a catching callee (`catch`,
 * `then`, `allSettled`, `any`), a control exit from a `finally`, a `defect` call in one (`defect-finally`), an
 * `attempt` with one argument (`attempt`), an `expect` that tests nothing (`expect`), a listener for uncaught throws (`listener`), or a catching callee used other
 * than as a call (`value:<name>`).
 */
export function catchMessage(kind: string): string {
  if (kind === "finally") return "control leaves finally and drops its throw";
  if (kind === "defect-finally") return "defect in finally drops the throw in flight";
  if (kind === "attempt") return "attempt needs expect: (x) => x instanceof T ? E.make(data) : undefined";
  if (kind === "listener") return "listener for uncaught throws in app code: the Boundary and the server own them";
  if (kind === "expect") return "expect claims every throw: test the thrown value";
  if (kind === "catch") return `.catch()${AWAIT_IT}`;
  if (kind === "then") return `.then(f, g)${AWAIT_IT}`;
  if (kind === "allSettled" || kind === "any") return `Promise.${kind}${AWAIT_IT}`;
  if (kind.startsWith("value:"))
    return `${kind.slice("value:".length)} used other than as a call; check cannot follow it`;
  return "catch in app code: cleanup is try/finally, an expected failure is attempt(fn, expect)";
}
