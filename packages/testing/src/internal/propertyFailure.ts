import { clip } from "./clip.ts";
import { fail } from "./fail.ts";
import { firstLine } from "./firstLine.ts";

/**
 * The E1704 error for a failed property (k.testing Failure output): line one names the failure with the seed,
 * the failing run, and `shrunk`; then one line per shrunk input as JSON (`payload`, `state`, or `props`).
 */
export function propertyFailure(
  subject: string,
  failure: unknown,
  seed: number,
  run: number,
  shrunk: readonly (readonly [label: string, json: string])[],
): Error {
  const reason = clip(firstLine(failure), 70);
  const lines = shrunk.map(([label, json]) => `\n  ${label}: ${clip(json, 300)}`).join("");
  return fail("E1704", `${subject}: ${reason} (seed ${seed}, run ${run}, shrunk)${lines}`, {
    seed,
    run,
    shrunk: Object.fromEntries(shrunk),
  });
}
