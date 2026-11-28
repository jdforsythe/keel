import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isRecord } from "../isRecord.ts";
import type { CacheInput } from "./CacheInput.ts";
import type { CacheProbe } from "./CacheProbe.ts";
import type { Evaluation } from "./Evaluation.ts";
import { cacheHeld } from "./cacheHeld.ts";
import { cacheKey } from "./cacheKey.ts";

const KINDS: readonly CacheProbe["kind"][] = [
  "exists",
  "stat",
  "lstat",
  "realpath",
  "list",
  "process",
  "call",
  "field",
  "env",
  "env-names",
];

/** The recorded inputs of an entry, or undefined when one is out of shape. */
function inputsOf(v: unknown): CacheInput[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: CacheInput[] = [];
  for (const i of v) {
    if (!isRecord(i) || typeof i.path !== "string" || typeof i.file !== "string" || typeof i.sha256 !== "string")
      return undefined;
    out.push({ path: i.path, file: i.file, sha256: i.sha256 });
  }
  return out;
}

/** The recorded probes of an entry, or undefined when one is out of shape. */
function probesOf(v: unknown): CacheProbe[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: CacheProbe[] = [];
  for (const p of v) {
    const kind = isRecord(p) ? KINDS.find((k) => k === p.kind) : undefined;
    if (!isRecord(p) || kind === undefined || typeof p.path !== "string") return undefined;
    if (p.answer !== null && typeof p.answer !== "string") return undefined;
    out.push({ kind, path: p.path, answer: p.answer });
  }
  return out;
}

/**
 * The evaluation the cache folder `dir` holds for the project at real path `root` whose code file paths are `paths`,
 * with the inputs and probes its entry recorded, or undefined (k.derived Derivation cache): an entry is used only when
 * its key is this one and every recorded input and probe gets the same answer again (`cacheHeld`). An entry that
 * cannot be read or lacks the shape is a miss.
 */
export function cacheRead(
  dir: string,
  root: string,
  paths: readonly string[],
): { e: Evaluation; inputs: CacheInput[]; probes: CacheProbe[] } | undefined {
  if (!existsSync(dir)) return undefined;
  const key = cacheKey(root, paths);
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .sort()) {
    let v: unknown;
    try {
      v = JSON.parse(readFileSync(join(dir, name), "utf8"));
    } catch {
      continue;
    }
    if (!isRecord(v) || v.key !== key || !isRecord(v.evaluation)) continue;
    const inputs = inputsOf(v.inputs);
    const probes = probesOf(v.probes);
    const e = v.evaluation;
    if (inputs === undefined || probes === undefined || !isRecord(e.routes) || !isRecord(e.surface)) continue;
    if (!Array.isArray(e.problems) || !cacheHeld(inputs, probes)) continue;
    const problems = e.problems.filter((p) => typeof p === "string");
    const evaluation: Evaluation = {
      routes: e.routes,
      surface: e.surface,
      problems,
      inputs: [],
      reads: [],
      probes: [],
      env: [],
      envListed: false,
    };
    return { e: evaluation, inputs, probes };
  }
  return undefined;
}
