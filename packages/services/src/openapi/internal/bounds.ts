import type { Gen } from "./Gen.ts";
import type { Path } from "./Path.ts";

/** `{ min, max }` source from two numeric keywords of `node`; empty when neither is a number; min > max is an issue. */
export function bounds(g: Gen, node: Readonly<Record<string, unknown>>, at: Path, lo: string, hi: string): string {
  const min = typeof node[lo] === "number" && Number.isFinite(node[lo]) ? node[lo] : undefined;
  const max = typeof node[hi] === "number" && Number.isFinite(node[hi]) ? node[hi] : undefined;
  if (min !== undefined && max !== undefined && min > max) {
    g.issues.push({ path: [...at, lo], rule: "max" });
    return "";
  }
  const parts = [...(min === undefined ? [] : [`min: ${min}`]), ...(max === undefined ? [] : [`max: ${max}`])];
  return parts.length === 0 ? "" : `{ ${parts.join(", ")} }`;
}
