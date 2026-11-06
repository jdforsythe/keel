import { tick } from "./tick.ts";

/** Upper bound on macrotask turns `settle` waits; work still changing after this is reported as unsettled. */
const MAX_TURNS = 100;

/**
 * Wait until triggered work is quiescent: macrotask turns (each drains microtasks, so promise chains from
 * effects, resources, and actions complete) until `signature()` (DOM and store state) stops changing.
 */
export async function settle(signature: () => string): Promise<boolean> {
  let last = signature();
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    await tick();
    const now = signature();
    if (now === last) return true;
    last = now;
  }
  return false;
}
