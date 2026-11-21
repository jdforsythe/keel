import { originDirectiveProblem } from "./originDirectiveProblem.ts";
import { originEntryProblem } from "./originEntryProblem.ts";

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * `E1590 <deployable>: <message>` (k.origins) for the first problem the runtime value of `deployable`'s `origins`
 * shows, else undefined: not an object, a key outside the five directives, a directive that is not an object or holds
 * more than 16 origins, an origin that is not exact or a reason out of form. `topology()` throws it; a duplicate key
 * does not survive to here.
 */
export function originsProblem(deployable: string, origins: unknown): string | undefined {
  const found = firstProblem(origins);
  return found === undefined ? undefined : `E1590 ${deployable}: ${found}`;
}

function firstProblem(origins: unknown): string | undefined {
  if (origins === undefined) return undefined;
  if (!isRecord(origins)) return "origins is not an object";
  for (const [key, entries] of Object.entries(origins)) {
    const bad = originDirectiveProblem(key);
    if (bad !== undefined) return bad;
    if (!isRecord(entries)) return `origins.${key} is not an object`;
    const list = Object.entries(entries);
    if (list.length > 16) return `origins.${key} holds more than 16 origins`;
    for (const [origin, reason] of list) {
      const problem = originEntryProblem(key, origin, reason);
      if (problem !== undefined) return problem;
    }
  }
  return undefined;
}
