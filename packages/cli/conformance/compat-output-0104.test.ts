// k.compat, Surface "`.keel/surface.json` is a derived file (k.derived): for each contract (k.contract) its `module`, the modules that import it (`callers`), and each API entry's id, method, `path`, `params`, `query`, `body`, `output` and `errors`; for each store a `stores` factory creates, its `id`, state schema and each transaction's payload schema (the evaluation runs each factory once on a sim ctx). Schemas are JSON Schema, as in `routes.json`; the file holds `version: 3`."
// Spec: k.compat, clause "Removing an `output` field a base entry requires is one E1562 with no fix; adding a field to an open output object is none; removing a base entry is one E1562 with no fix."
// k.compat, Rules "E1562 an entry change that a base entry with a caller in another deployable refuses, at the current entry's member, its message starting with the id; fix when the change is one added required object field: make it optional; an entry gone from its method and path has no fix"
// Seed: 1337. Real binary over a temp project (see compat-support.ts).
// Layout: k.compat Surface (v3). `data.contracts[<module>].entries[<id>].output` holds the entry's `output` as JSON Schema; the checks look for the schema's own marks (`integer` and the field name) and not for an exact tree.
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import {
  SEED,
  baseSurface,
  buildAndCheck,
  cleanup,
  diags,
  keel,
  materialize,
  project,
  readText,
  write,
} from "./compat-support.ts";
import type { Tree } from "./compat-support.ts";

const SLOW = 180_000;
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const fresh = (files: Tree): string => {
  const dir = materialize(files);
  dirs.push(dir);
  return dir;
};

const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);
const entryOf = (dir: string, id: string): unknown => {
  const file: unknown = JSON.parse(readText(dir, ".keel/surface.json"));
  return field(field(field(field(field(file, "data"), "contracts"), "y"), "entries"), id);
};

test(
  "`keel build` records an API entry's `output` as its JSON Schema in `.keel/surface.json`, with the entry's method and path and the module `a` that imports the contract.",
  () => {
    fc.assert(
      fc.property(fc.constantFrom("n", "count", "total"), (name) => {
        const out = `s.object({ ${name}: s.int() })`;
        const dir = fresh(project({ output: out, outputValue: `{ ${name}: 1 }` }));
        expect(keel(dir, ["build"]).status).toBe(0);
        const load = entryOf(dir, "y.load");
        const answer = JSON.stringify(field(load, "output"));
        expect(answer).toContain(`"${name}"`);
        expect(answer).toContain("integer");
        expect(field(load, "method")).toBe("GET");
        expect(field(load, "path")).toBe("/y/save");
        const file: unknown = JSON.parse(readText(dir, ".keel/surface.json"));
        expect(field(field(file, "data"), "version")).toBe(3);
        expect(field(field(field(field(file, "data"), "contracts"), "y"), "callers")).toEqual(["a"]);
        expect(JSON.stringify(field(entryOf(dir, "y.add"), "output"))).toContain("null");
      }),
      { seed: SEED, numRuns: 3 },
    );
  },
  SLOW,
);

test(
  "With a base whose entry `output` was `{ n }` and a current `output` without `n`, and the caller in another deployable, is one E1562; in one deployable none.",
  () => {
    const before = "s.object({ n: s.int() })";
    const after = "s.object({ m: s.int() })";
    const { dir, base } = baseSurface(project({ output: before, outputValue: "{ n: 1 }" }));
    dirs.push(dir);
    write(dir, project({ output: after, outputValue: "{ m: 1 }" }));
    const found = diags(buildAndCheck(dir, base), "E1562");
    expect(found).toHaveLength(1);
    expect(String(found[0]?.message)).toContain("y.load");
    expect(found[0]?.fix ?? null).toBeNull();

    const same = baseSurface(project({ output: before, outputValue: "{ n: 1 }", split: false }));
    dirs.push(same.dir);
    write(same.dir, project({ output: after, outputValue: "{ m: 1 }", split: false }));
    expect(diags(buildAndCheck(same.dir, same.base), "E1562")).toEqual([]);
  },
  SLOW,
);

test(
  "Removing a base entry is one E1562 with no fix, naming its id.",
  () => {
    const { dir, base } = baseSurface(project());
    dirs.push(dir);
    const current = project();
    write(dir, {
      "modules/y/y.contract.ts": (current["modules/y/y.contract.ts"] ?? "").replace(/ {2}'y\.load':[^\n]*\n/, ""),
      "modules/y/load.server.ts": "export {};\n",
      "modules/y/routes.ts":
        "import { manifest } from '@keel/router'\nimport { y } from './y.contract.ts'\nimport { add } from './add.server.ts'\nexport const routes = manifest(y, { 'y.add': { action: add } })\n",
    });
    const found = diags(buildAndCheck(dir, base), "E1562");
    expect(found).toHaveLength(1);
    expect(String(found[0]?.message)).toContain("y.load");
    expect(found[0]?.fix).toBeUndefined();
  },
  SLOW,
);
