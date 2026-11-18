import type { Infer } from "@keel/schema";
import { callerDays } from "@keel/compiler/hosting/callerDays";
import type { PiiReport } from "../evidence/PiiReport.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { PII_SINKS } from "./PII_SINKS.ts";
import { isRecord } from "./isRecord.ts";
import { keelModule } from "./keelModule.ts";
import { projectFileModule } from "./projectFileModule.ts";

type Report = Infer<typeof PiiReport>;
type Rung = Report["sinks"][number]["rung"];

const SCHEMA_FILE = /\.schema\.ts$/;
const TEST_DIR = /(?:^|\/)(?:test|conformance|node_modules)\//;
/** Rungs that count a (path, sink) pair as covered. */
const COVERED: ReadonlySet<string> = new Set(["probabilistic", "exhaustive", "proven"]);

const isSchema = (v: unknown): boolean => isRecord(v) && isRecord(v.node) && typeof v.node.kind === "string";

/**
 * Binary only: `pii.json` (k.evidence, k.privacy Personal data). Each `*.schema.ts` file of `files` (tests aside) is
 * imported once in Node; every schema export is read with `piiPaths` of the project's `@keel/schema`, giving one entry
 * per marked leaf `{ file, export, path, class }`. Each sink carries its clause's rung from `rungOf`; `coverage` is
 * the share of (path, sink) pairs whose clause is `probabilistic` or higher (1 with no path). A file that fails to
 * import is named in `unread`, never skipped silently. `caller` is the longest `caller: { days }` a `node` deployable of
 * `topology.ts` sets (`callerDays`), classed `network` (k.user Caller lifetime), else `{ days: null, class: null }`.
 */
export async function piiReport(
  cwd: string,
  files: readonly SourceFile[],
  rungOf: (clause: string) => Rung,
): Promise<Report> {
  const schema = await keelModule(cwd, "@keel/schema");
  const piiPaths = schema?.piiPaths;
  const paths: Report["paths"] = [];
  const unread: string[] = [];
  for (const f of files.filter((x) => SCHEMA_FILE.test(x.path) && !TEST_DIR.test(x.path))) {
    const ns = typeof piiPaths === "function" ? await projectFileModule(cwd, f.path) : undefined;
    if (ns === undefined) {
      unread.push(f.path);
      continue;
    }
    for (const name of Object.keys(ns).sort()) {
      const value = ns[name];
      if (!isSchema(value) || typeof piiPaths !== "function") continue;
      const listed: unknown = piiPaths(value);
      for (const p of Array.isArray(listed) ? listed : [])
        if (isRecord(p) && typeof p.path === "string" && typeof p.class === "string")
          paths.push({ file: f.path, export: name, path: p.path, class: p.class });
    }
  }
  const sinks = PII_SINKS.map((s) => ({ ...s, rung: rungOf(s.clause) }));
  const covered = sinks.filter((s) => COVERED.has(s.rung)).length;
  const coverage = paths.length === 0 ? 1 : covered / sinks.length;
  const top = files.find((f) => f.path === "topology.ts")?.source;
  const days = (top === undefined ? [] : callerDays(top))
    .filter(([, adapter, d]) => adapter === "node" && Number.isInteger(d) && d >= 1 && d <= 400)
    .reduce((most, [, , d]) => Math.max(most, d), 0);
  const caller: Report["caller"] = days === 0 ? { days: null, class: null } : { days, class: "network" };
  return { v: 1, paths, sinks, coverage, unread, caller };
}
