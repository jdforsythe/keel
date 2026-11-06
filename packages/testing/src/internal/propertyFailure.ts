import { clip } from "./clip.ts";
import { fail } from "./fail.ts";
import { firstLine } from "./firstLine.ts";

/**
 * The E1704 error for a failed property (k.testing Failure output): line one names the failure with the seed,
 * the failing run, and `shrunk`; line two is the shrunk case as JSON under `label` (`payload` or `props`).
 */
export function propertyFailure(
  subject: string,
  failure: unknown,
  seed: number,
  run: number,
  label: "payload" | "props",
  shrunk: string,
): Error {
  const reason = clip(firstLine(failure), 70);
  return fail("E1704", `${subject}: ${reason} (seed ${seed}, run ${run}, shrunk)\n  ${label}: ${clip(shrunk, 300)}`, {
    seed,
    run,
    [label]: shrunk,
  });
}
