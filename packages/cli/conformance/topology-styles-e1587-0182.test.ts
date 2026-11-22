// Spec: k.topology, Conformance "`styles` entries `'./x.css'`, `'@keel/ui'` and a variable are each one E1587 in `keel check` and `keel build`."
// Spec: k.topology, Rules "E1587 a `styles` entry that is not a string literal or whose export is not a `.css` file (`keel check`, `keel build`)"
// Seed: 1337 (no generated input: one fixture per entry, spawned). Pending: `styles` is not read yet.
// ASSUMPTION: a failing `keel build` exits 1; `'./x.css'` names a file that exists in the project (a relative path is still not a package export).
import { afterAll, beforeAll, expect, test } from "vitest";
import { cleanup, diags, keel, materialize } from "./compat-support.ts";
import { tree } from "./origins-support.ts";
import { SLOW } from "./static-support.ts";

const project = (entry: string, prelude = ""): Record<string, string> => ({
  ...tree("{ web: { modules: ['a', 'c'], adapter: 'client', styles: [" + entry + "] } }"),
  "x.css": "body { margin: 0 }\n",
  "topology.ts": `import { topology } from '@keel/server'\n${prelude}export default topology({ web: { modules: ['a', 'c'], adapter: 'client', styles: [${entry}] } })\n`,
});
const CASES: readonly (readonly [string, string, string])[] = [
  ["a relative path", "'./x.css'", ""],
  ["a package export that is a script", "'@keel/ui'", ""],
  ["a variable", "fonts", "const fonts = '@keel/ui/fonts'\n"],
];
const dirs: string[] = [];
beforeAll(() => {
  for (const [, entry, prelude] of CASES) dirs.push(materialize(project(entry, prelude)));
  dirs.push(materialize(project("'@keel/ui/fonts'")));
}, SLOW);
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

test(
  "`styles` entries `'./x.css'`, `'@keel/ui'` and a variable are each one E1587 in `keel check` and `keel build`.",
  () => {
    for (const [i, [label]] of CASES.entries()) {
      const dir = dirs[i] ?? "";
      const check = keel(dir, ["check"]);
      expect(diags(check, "E1587"), `check ${label}`).toHaveLength(1);
      expect(check.status, `check ${label}`).toBe(1);
      const build = keel(dir, ["build"]);
      expect(diags(build, "E1587"), `build ${label}`).toHaveLength(1);
      expect(build.status, `build ${label}`).toBe(1);
    }
  },
  SLOW,
);

test(
  "E1587: a `styles` entry that is a string literal naming a package export that is a `.css` file is none in `keel check` and `keel build`.",
  () => {
    const dir = dirs[CASES.length] ?? "";
    expect(diags(keel(dir, ["check"]), "E1587")).toEqual([]);
    const build = keel(dir, ["build"]);
    expect(diags(build, "E1587")).toEqual([]);
    expect(build.status).toBe(0);
  },
  SLOW,
);
