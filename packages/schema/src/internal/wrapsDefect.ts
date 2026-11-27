import { isDefect } from "../isDefect.ts";

/** The most `cause` and `errors` steps `attempt` follows to find a defect under a thrown value (k.errors). */
const STEPS = 8;

/**
 * The values directly under `x`: its `cause`, and each of its `errors` when that is an array (an `AggregateError`);
 * `undefined` when a getter or a `Proxy` throws while they are read, which ends the search (k.attempt).
 */
function under(x: unknown): unknown[] | undefined {
  if (typeof x !== "object" || x === null) return [];
  const out: unknown[] = [];
  try {
    if ("cause" in x) out.push(x.cause);
    if ("errors" in x && Array.isArray(x.errors)) out.push(...x.errors);
  } catch {
    return undefined;
  }
  return out;
}

/** Whether `x` is a defect, or one is reachable from it through `cause` and `errors` in at most 8 steps. */
export function wrapsDefect(x: unknown): boolean {
  let level: unknown[] = [x];
  const seen = new Set<unknown>();
  let ended = false;
  for (let step = 0; step <= STEPS && level.length > 0; step++) {
    const next: unknown[] = [];
    for (const v of level) {
      if (seen.has(v)) continue;
      seen.add(v);
      if (isDefect(v)) return true;
      if (step === STEPS || ended) continue;
      const found = under(v);
      if (found === undefined) ended = true;
      else next.push(...found);
    }
    level = ended ? [] : next;
  }
  return false;
}
