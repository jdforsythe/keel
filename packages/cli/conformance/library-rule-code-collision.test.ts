// k.library the E1753 clause on two libraries registering one rule code, quoted whole
// Spec: k.library, clause "`@acme/evil` and `@acme/charts`, each `./tools` registering `E2991`, in `deps` in either order: one E1753 naming both, no E1159."
// Also the "In an app" paragraph of k.library (not a Conformance bullet, so no clause): "k.module (Std config), k.topology and k.contract read a library's entry, `./tools`, `./module`, `./routes`, `./contract` and `std` config as a stdlib package's (k.parity By kind). `keel check` and `keel build` import only its `./tools`; its rule codes are held to E1753: a code two packages register is E1753 `rule code <code> is registered by <a> and <b>`, `<b>` the later, at its `deps` entry, not E1159."
// Seed: 1337 (no generated input). Binary runs: `keel check` on two projects (`deps` `['@acme/evil', '@acme/charts']` and its reverse), each shared by its cases.
// ASSUMPTIONS (spec silent): `@acme/evil` is a library of id `evil` holding the same files as `@acme/charts` (library-support.ts `library`), its `exports` gaining `"./tools": "./tools.js"` as `@acme/charts`'s does, each `tools.js` registering `E2991`;
// "the later" is the later in the app's `deps` list; "names both" is a message `rule code E2991 is registered by <a> and <b>`, `<a>` the earlier entry, `<b>` the later; "at its `deps` entry" is a position on the later entry's line from its opening quote to its closing one.
import { afterAll, describe, expect, test } from "vitest";
import type { Rec } from "./compat-support.ts";
import {
  NAME,
  SLOW,
  type Tree,
  cleanup,
  diags,
  keel,
  library,
  materialize,
  project,
  toolsRule,
} from "./library-support.ts";

const EVIL = "@acme/evil";
const tools = { "./tools": "./tools.js" };
const tree = (deps: string[]): Tree =>
  project({
    deps,
    libraries: [
      library({ exports: tools, files: { "tools.js": toolsRule("E2991") } }),
      library({ name: EVIL, id: "evil", exports: tools, files: { "tools.js": toolsRule("E2991") } }),
    ],
  });

const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
const cache = new Map<string, { run: ReturnType<typeof keel>; files: Tree }>();
function checked(deps: string[]) {
  const key = deps.join(",");
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const files = tree(deps);
  const dir = materialize(files);
  made.push(dir);
  const out = { run: keel(dir, ["check"]), files };
  cache.set(key, out);
  return out;
}

/** Whether `r` lies on the `'entry'` of the file `files` holds at `r.path`, from its opening quote to its closing one. */
function atEntry(files: Tree, r: Rec, entry: string): boolean {
  const src = typeof r.path === "string" ? (files[r.path] ?? "") : "";
  const idx = src.indexOf(`'${entry}'`);
  if (idx < 0 || typeof r.line !== "number" || typeof r.col !== "number") return false;
  const before = src.slice(0, idx);
  const quoteCol = idx - before.lastIndexOf("\n");
  return r.line === before.split("\n").length && r.col >= quoteCol && r.col <= quoteCol + entry.length + 1;
}

const ORDERS: ReadonlyArray<readonly [string, string[]]> = [
  ["`@acme/evil` then `@acme/charts`", [EVIL, NAME]],
  ["`@acme/charts` then `@acme/evil`", [NAME, EVIL]],
];

describe("two libraries' `./tools` each registering `E2991`, in `deps` in either order", () => {
  for (const [what, deps] of ORDERS) {
    const [first, later] = deps;
    test(
      `${what}: one E1753 naming both`,
      () => {
        const { run } = checked(deps);
        const hits = diags(run, "E1753");
        expect(hits.length, JSON.stringify(run.records).slice(0, 700)).toBe(1);
        expect(hits[0]?.message).toBe(`rule code E2991 is registered by ${first} and ${later}`);
      },
      SLOW,
    );

    test(
      `${what}: the E1753 is at the later one's \`deps\` entry`,
      () => {
        const { run, files } = checked(deps);
        const hit = diags(run, "E1753")[0];
        expect(hit?.path).toBe("modules/shop/module.ts");
        expect(atEntry(files, hit ?? { kind: "diag" }, later ?? "")).toBe(true);
      },
      SLOW,
    );

    test(
      `${what}: no E1159`,
      () => {
        expect(diags(checked(deps).run, "E1159")).toEqual([]);
      },
      SLOW,
    );
  }
});
