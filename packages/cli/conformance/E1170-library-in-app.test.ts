// k.module the E1170 rule and its conformance clause, each quoted whole (the binary's: `keel check` and `keel pack` run in an app's folder)
// Spec: k.module, clause "A folder holding `modules/shop/module.ts` (or `topology.ts`) whose `package.json` is `{\"name\":\"@acme/app\",\"keel\":\"library\"}` is one E1170 at `keel check`, beside what it reports with no `\"keel\"` key, and `keel pack` there is that E1170 and no other diagnostic."
// Rules: E1170 "`\"keel\": \"library\"` in the `package.json` of an app's folder, one holding `topology.ts` or a `modules/<id>/module.ts`, at that key (message `an app's folder is no library's own folder; drop \"keel\": \"library\"`; fix: none): `keel check` reads the folder as an app, not as k.library-pack's own folder, and `keel pack` stops with it alone. No fix edits `node_modules/`."
// Seed: 1337 (no generated input). Binary runs: `keel check` on three folders (library-marked with `modules/shop/module.ts`, the same without the key, library-marked with `topology.ts` alone) and `keel pack` on the first, each shared by its cases.
// ASSUMPTIONS (spec silent): the folder is library-support.ts's `project()` with `package.json` replaced by the clause's, written as `JSON.stringify(value, null, 2)` (keys at two spaces); "at that key" is `path` `package.json`, the line of `"keel"` and a column from its opening quote to its closing one;
// "beside what it reports with no key" is every other diagnostic of the run (code, path, line, message) equal with and without the key; "`keel pack` there is that E1170 and no other diagnostic" is exactly one `diag` record, an E1170, and a non-zero status.
import { afterAll, describe, expect, test } from "vitest";
import type { Rec, Run } from "./compat-support.ts";
import { SLOW, type Tree, cleanup, keel, materialize, project } from "./library-support.ts";

const MESSAGE = `an app's folder is no library's own folder; drop "keel": "library"`;
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});

const PKG_LIBRARY = JSON.stringify({ name: "@acme/app", keel: "library" }, null, 2);
const PKG_PLAIN = JSON.stringify({ name: "@acme/app" }, null, 2);
const app = (pkg: string): Tree => ({ ...project({ deps: [], libraries: [{}] }), "package.json": pkg });
const diagsOf = (r: Run): Rec[] => r.records.filter((x) => x.kind === "diag");
const e1170 = (r: Run): Rec[] => diagsOf(r).filter((x) => x.code === "E1170");
const signature = (r: Rec): string =>
  `${String(r.code)} ${String(r.path)}:${String(r.line)}:${String(r.col)} ${String(r.message)}`;

const dirOf = (tree: Tree): string => {
  const dir = materialize(tree);
  made.push(dir);
  return dir;
};
const runs = new Map<string, Run>();
const once = (key: string, tree: () => Tree, args: string[]): Run => {
  const hit = runs.get(key);
  if (hit !== undefined) return hit;
  const r = keel(dirOf(tree()), args);
  runs.set(key, r);
  return r;
};
const marked = () => once("check-marked", () => app(PKG_LIBRARY), ["check"]);
const plain = () => once("check-plain", () => app(PKG_PLAIN), ["check"]);

describe("E1170: an app's folder whose package.json says keel: library", () => {
  test(
    'A folder holding `modules/shop/module.ts` whose `package.json` is `{"name":"@acme/app","keel":"library"}` is one E1170 at `keel check`',
    () => {
      const hits = e1170(marked());
      expect(hits.length).toBe(1);
      expect(hits[0]?.path).toBe("package.json");
      expect(hits[0]?.message).toBe(MESSAGE);
      expect(hits[0]?.fix).toBeUndefined();
    },
    SLOW,
  );

  test(
    'E1170 is at the `"keel"` key of `package.json`',
    () => {
      const hit = e1170(marked())[0];
      const lines = PKG_LIBRARY.split("\n");
      const line = lines.findIndex((l) => l.includes('"keel"')) + 1;
      const col = (lines[line - 1] ?? "").indexOf('"keel"') + 1;
      expect(hit?.line).toBe(line);
      expect(hit?.col).toBeGreaterThanOrEqual(col);
      expect(hit?.col).toBeLessThanOrEqual(col + '"keel"'.length - 1);
    },
    SLOW,
  );

  test(
    'E1170 is reported beside what `keel check` reports with no `"keel"` key',
    () => {
      expect(e1170(plain())).toEqual([]);
      const rest = diagsOf(marked())
        .filter((x) => x.code !== "E1170")
        .map(signature);
      expect(rest).toEqual(diagsOf(plain()).map(signature));
    },
    SLOW,
  );

  test(
    'A folder holding `topology.ts` whose `package.json` is `{"name":"@acme/app","keel":"library"}` is one E1170 at `keel check`',
    () => {
      const tree: Tree = { ...app(PKG_LIBRARY) };
      for (const k of Object.keys(tree)) if (k.startsWith("modules/")) delete tree[k];
      const hits = e1170(once("check-topology", () => tree, ["check"]));
      expect(hits.length).toBe(1);
      expect(hits[0]?.path).toBe("package.json");
    },
    SLOW,
  );

  test(
    '`keel pack` in a folder holding `modules/shop/module.ts` whose `package.json` says `"keel": "library"` is that E1170 and no other diagnostic',
    () => {
      const r = once("pack-marked", () => app(PKG_LIBRARY), ["pack"]);
      const found = diagsOf(r);
      expect(found.map((x) => x.code)).toEqual(["E1170"]);
      expect(found[0]?.message).toBe(MESSAGE);
      expect(r.status).not.toBe(0);
    },
    SLOW,
  );
});
