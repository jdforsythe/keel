// Seed 1337 (no generated input: fixed fixtures). k.module E1170: an app's folder (one holding a `modules/<id>/module.ts`
// or `topology.ts`) whose `package.json` says `"keel": "library"` is no library's own folder: `keel check` reports E1170
// at the key and checks the folder as the app it is, and `keel pack` stops with that E1170 alone.
import { afterAll, expect, test } from "vitest";
import { type Rec, type Tree, cleanup, keel, materialize } from "../conformance/compat-support.ts";
import { library, project } from "../conformance/library-support.ts";

const SLOW = 120_000;
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
const PKG = JSON.stringify({ name: "@acme/app", private: true, type: "module", version: "1.0.0", keel: "library" });

/** The app of k.library's first Conformance bullet with a stray export E1165 does not judge but `modules/` holds. */
function app(extra: Tree = {}): string {
  const tree = project({ libraries: [library()] });
  const dir = materialize({
    ...tree,
    "modules/shop/Stray.ts": "export const Stray = (n: unknown) => n as string\n",
    ...extra,
  });
  made.push(dir);
  return dir;
}
const codes = (records: readonly Rec[]): string[] =>
  records.filter((r) => r.kind === "diag").map((r) => `${String(r.code)} ${String(r.path)}`);

test(
  "keel check in an app's folder marked a library is E1170 at the key and checks the app as an app",
  () => {
    const plain = keel(app(), ["check"]);
    const marked = keel(app({ "package.json": PKG }), ["check"]);
    expect(codes(plain.records)).toContain("E1757 modules/shop/Stray.ts");
    expect(codes(marked.records).sort()).toEqual([...codes(plain.records), "E1170 package.json"].sort());
    const e1170 = marked.records.find((r) => r.code === "E1170");
    expect(e1170?.line).toBe(1);
    expect(e1170?.message).toBe(`an app's folder is no library's own folder; drop "keel": "library"`);
    expect(marked.status).toBe(1);
  },
  SLOW,
);

test(
  "a topology.ts alone makes the folder an app's",
  () => {
    const dir = materialize({
      "package.json": PKG,
      "topology.ts": "export default {}\n",
      "module.ts": "export default {}\n",
    });
    made.push(dir);
    expect(codes(keel(dir, ["check"]).records)).toContain("E1170 package.json");
  },
  SLOW,
);

test(
  "keel pack in an app's folder marked a library stops with E1170 alone",
  () => {
    const run = keel(app({ "package.json": PKG }), ["pack"]);
    expect(codes(run.records)).toEqual(["E1170 package.json"]);
    expect(run.status).toBe(1);
  },
  SLOW,
);

test(
  "a library's own folder holding a modules/ folder with no manifest stays the library's",
  () => {
    const dir = materialize({
      "package.json": JSON.stringify({ name: "@acme/units", version: "1.0.0", type: "module", keel: "library" }),
      "module.ts":
        "import { module } from '@keel/compiler'\nexport default module({ id: 'units', deps: [], capabilities: [], public: { exports: [] } })\n",
      "modules/shop/x.ts": "export const x = 1\n",
    });
    made.push(dir);
    expect(codes(keel(dir, ["check"]).records)).not.toContain("E1170 package.json");
  },
  SLOW,
);
