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
 * per non-skipped `it`/`test` body in a `*.test.*` file. A body reaches the names it references (`testFacts`)
 * plus, transitively, those of the helpers it calls: top-level functions of its own file, or of a relative import
 * among `files` (fixtures). Its evidence is the strongest property run it or its helpers perform, with `numRuns`
 * and `seed` resolved through constants (imported ones too); unresolved values are omitted, so an unseeded or
 * unknown-run property stays `example` (k.testing Ledger). Bodies without a property run are `example`.
 */
export function testEvidence(files: readonly SourceFile[]): TestRef[] {
  const facts = new Map<string, FileFacts>(files.map((f) => [f.path, testFacts(f.path, f.source)]));
  const target = (from: string, spec: string): string | undefined => {
    if (!spec.startsWith(".")) return undefined;
    const base = posix.normalize(posix.join(posix.dirname(from), spec));
    return EXTS.map((e) => base + e).find((p) => facts.has(p));
  };
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
      const runs: { runs: number | undefined; seed: number | undefined }[] = [];
      const seen = new Set<string>();
      const reach = (at: string, use: Use): void => {
        for (const n of use.names) names.add(n);
        for (const p of use.props) runs.push({ runs: resolve(at, p.runs), seed: resolve(at, p.seed) });
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
      const ev: Evidence =
        best === undefined
          ? { kind: "example", passed: true }
          : {
              kind: "property",
              passed: true,
              ...(best.runs === undefined ? {} : { runs: best.runs }),
              ...(best.seed === undefined ? {} : { seed: best.seed }),
            };
      out.push({ path, names, ev });
    }
  }
  return out;
}
