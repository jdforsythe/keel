import type { Observed } from "./Observed.ts";
import type { ObservedKind } from "./ObservedKind.ts";

const KINDS: readonly ObservedKind[] = ["exists", "stat", "lstat", "realpath", "list", "process", "call"];
type Kind = ObservedKind;
const isKind = (x: unknown): x is Kind => KINDS.some((k) => k === x);
const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v) => typeof v === "string") : []);

/**
 * The `__keelObserved` record of an evaluation bundle (`OBSERVE_BANNER`) as `Observed`, each list in first-seen
 * order without repeats; anything out of shape is left out.
 */
export function observedOf(v: unknown): Observed {
  const o = isRecord(v) ? v : {};
  const probes: [Kind, string][] = [];
  const seen = new Set<string>();
  for (const p of Array.isArray(o.probes) ? o.probes : []) {
    const kind: unknown = Array.isArray(p) ? p[0] : undefined;
    const path: unknown = Array.isArray(p) ? p[1] : undefined;
    if (!isKind(kind) || typeof path !== "string" || seen.has(`${kind}\0${path}`)) continue;
    seen.add(`${kind}\0${path}`);
    probes.push([kind, path]);
  }
  const env: [string, string | null][] = [];
  for (const e of Array.isArray(o.env) ? o.env : []) {
    const name: unknown = Array.isArray(e) ? e[0] : undefined;
    const value: unknown = Array.isArray(e) ? e[1] : undefined;
    if (typeof name === "string" && (value === null || typeof value === "string")) env.push([name, value]);
  }
  return { reads: [...new Set(strings(o.reads))], probes, env, envListed: o.envListed === true };
}
