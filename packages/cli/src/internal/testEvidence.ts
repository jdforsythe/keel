import { posix } from "node:path";
import type { Evidence } from "@keel/testing";
import type { SourceFile } from "../types/SourceFile.ts";
import type { FileFacts } from "./FileFacts.ts";
import type { NumRef } from "./NumRef.ts";
import { TEST_FILE } from "./TEST_FILE.ts";
import type { TestRef } from "./TestRef.ts";
import type { Use } from "./Use.ts";
import { testFacts } from "./testFacts.ts";

const EXTS = ["", ".ts", ".tsx", ".mts", ".js", "/index.ts"];

/**
 * Evidence from the test files of one area (a package's `test/` and `conformance/`, an app's tests): one `TestRef`
 * per non-skipped `it`/`test` body in a `*.test.*` file. A body reaches the names it references (`testFacts`); a
 * name bound by a relative import reaches only the export of the file it resolves to among `known` (by name when it
 * resolves to none)
 * plus, transitively, those of the helpers it calls: top-level functions of its own file, or of a relative import
 * among `files` (fixtures). Its evidence is the strongest property run it or its helpers perform, with `numRuns`
 * and `seed` resolved through constants (imported ones too); unresolved values are omitted, so an unseeded or
 * unknown-run property stays `example` (k.ledger). A body that asserts types (`expectTypeOf`, `assertType`) or
 * runs a closed-form `explore` is `proven`; one running another `explore` is `exhaustive`, with its literal `depth`.
 * One whose own statements await or return a `prove` call (`@keel/testing/prove`; `testFacts`), so a failing proof
 * fails it, is `proven` with `z3`, the installed Z3 version, when `z3` is given (no Z3, no passing `prove`). Bodies with none of these and no property run are `example`.
 */
export function testEvidence(
  files: readonly SourceFile[],
  known: ReadonlySet<string> = new Set(),
  z3?: string,
): TestRef[] {
  const facts = new Map<string, FileFacts>(files.map((f) => [f.path, testFacts(f.path, f.source)]));
  const resolveIn = (from: string, spec: string, has: (p: string) => boolean): string | undefined => {
    if (!spec.startsWith(".")) return undefined;
    const base = posix.normalize(posix.join(posix.dirname(from), spec));
    return [...EXTS, ".tsx"].map((e) => base.replace(/\.js$/, "") + e).find(has) ?? EXTS.map((e) => base + e).find(has);
  };
  const target = (from: string, spec: string): string | undefined => resolveIn(from, spec, (p) => facts.has(p));
  const resolve = (path: string, v: NumRef, depth = 0): number | undefined => {
    if (typeof v !== "object") return v;
    const imp = facts.get(path)?.imports.get(v.ref);
    const to = imp === undefined ? undefined : target(path, imp.from);
    if (imp === undefined || to === undefined || depth > 4) return undefined;
    if (v.key === undefined) return resolve(to, facts.get(to)?.consts.get(imp.name), depth + 1);
    const obj = facts.get(to)?.objects.get(imp.name);
    if (obj === undefined) return undefined;
    return obj.has(v.key) ? resolve(to, obj.get(v.key), depth + 1) : v.fallback;
  };
  const out: TestRef[] = [];
  for (const [path, f] of facts) {
    if (!TEST_FILE.test(path)) continue;
    for (const test of f.tests) {
      const names = new Set<string>();
      const pinned = new Set<string>();
      const runs: { runs: number | undefined; seed: number | undefined }[] = [];
      const depths: (number | undefined)[] = [];
      let proven = false;
      let proved = false;
      const seen = new Set<string>();
      const reach = (at: string, use: Use): void => {
        for (const n of use.names) names.add(n);
        for (const pin of use.pins) {
          const [spec = "", name = ""] = pin.split("\n");
          const file = resolveIn(at, spec, (p) => known.has(p) || facts.has(p));
          if (file === undefined) names.add(name);
          else pinned.add(`${file}#${name}`);
        }
        for (const p of use.props) runs.push({ runs: resolve(at, p.runs), seed: resolve(at, p.seed) });
        for (const x of use.explores) {
          if (x.closed) proven = true;
          depths.push(resolve(at, x.depth));
        }
        if (use.typed) proven = true;
        if (use.proves && z3 !== undefined) proved = true;
        const here = facts.get(at);
        for (const c of use.calls) {
          const imp = here?.imports.get(c);
          const to = imp === undefined ? at : target(at, imp.from);
          const name = imp === undefined ? c : imp.name;
          const helper = to === undefined ? undefined : facts.get(to)?.helpers.get(name);
          if (to === undefined || helper === undefined || seen.has(`${to}#${name}`)) continue;
          seen.add(`${to}#${name}`);
          reach(to, helper);
        }
      };
      reach(path, test);
      const score = (r: { runs: number | undefined; seed: number | undefined }): number =>
        (r.seed === undefined ? 0 : 1e9) + (r.runs ?? 0);
      const best = runs.reduce<(typeof runs)[number] | undefined>(
        (a, r) => (a === undefined || score(r) > score(a) ? r : a),
        undefined,
      );
      const depth = depths.find((d) => d !== undefined);
      const ev: Evidence = proved
        ? { kind: "proven", passed: true, z3: z3 ?? "" }
        : proven
          ? { kind: "proven", passed: true }
          : depths.length > 0
            ? { kind: "exhaustive", passed: true, ...(depth === undefined ? {} : { depth }) }
            : best === undefined
              ? { kind: "example", passed: true }
              : {
                  kind: "property",
                  passed: true,
                  ...(best.runs === undefined ? {} : { runs: best.runs }),
                  ...(best.seed === undefined ? {} : { seed: best.seed }),
                };
      out.push({ path, names, pinned, ev, from: test.from, to: test.to });
    }
  }
  return out;
}
