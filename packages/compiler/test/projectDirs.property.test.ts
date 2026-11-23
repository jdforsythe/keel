// projectDirs: the project roots among a tree's files. Seed 1337 for the properties.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { projectDirs } from "../src/index.ts";

const TOP = "import { topology } from '@keel/server'\nexport default topology({})\n";
const f = (path: string, source = "") => ({ path, source });

describe("projectDirs", () => {
  it("the tree's own root is always a project", () => {
    expect(projectDirs([])).toEqual([""]);
    expect(projectDirs([f("a.ts"), f("src/b.ts")])).toEqual([""]);
    expect(projectDirs([f("topology.ts", TOP), f(".keel/ids.json", "{}")])).toEqual([""]);
  });

  it("a dir holding a topology.ts with a default export is a project, readable or not", () => {
    expect(projectDirs([f("apps/a/topology.ts", TOP)])).toEqual(["apps/a/", ""]);
    expect(projectDirs([f("apps/a/topology.ts", "export default {")])).toEqual(["apps/a/", ""]);
    expect(projectDirs([f("apps/a/topology.ts", "const t = 1\n  export   default t")])).toEqual(["apps/a/", ""]);
    expect(projectDirs([f("apps/a/topology.ts", "\texport\tdefault(t)")])).toEqual(["apps/a/", ""]);
  });

  it("a topology.ts with no default export, or a file of another name, is not a topology", () => {
    for (const file of [
      f("apps/a/topology.ts", "export const topology = 1\n"),
      f("apps/a/topology.ts", ""),
      f("apps/a/topology.ts", "// export default nothing\n"),
      f("apps/a/topology.ts", "export defaults\n"),
      f("apps/a/topology.ts", "exportdefault x\n"),
      f("apps/a/topology.ts", "const a = 'x'; export default a\n"),
      f("apps/a/mytopology.ts", TOP),
      f("apps/a/topology.tsx", TOP),
      f("apps/a/topology.ts.bak", TOP),
      f("apps/a/topologyXts", TOP),
      f("apps/a/topology.ts/readme.md", TOP),
    ])
      expect(projectDirs([file]), `${file.path} ${file.source}`).toEqual([""]);
  });

  it("a dir holding a .keel artifact is a project", () => {
    expect(projectDirs([f("apps/b/.keel/ids.json", "export default 1")])).toEqual(["apps/b/", ""]);
    expect(projectDirs([f("apps/b/.keel/a11y.json")])).toEqual(["apps/b/", ""]);
    for (const path of [
      "apps/b/.keel/ids.txt",
      "apps/b/.keel/ids.json.bak",
      "apps/b/.keel/nested/ids.json",
      "apps/b/.keel/.json/x",
      "apps/b/x.keel/ids.json",
      "apps/b/.keelx/ids.json",
      "apps/b/.keel/idsXjson",
      "apps/b/akeel/ids.json",
      "apps/b/.keel/.json",
    ])
      expect(projectDirs([f(path)]), path).toEqual([""]);
  });

  it("a dir with a modules segment is never a project", () => {
    for (const path of ["modules/m/topology.ts", "apps/a/modules/topology.ts", "apps/modules/x/y/topology.ts"])
      expect(projectDirs([f(path, TOP)]), path).toEqual([""]);
    expect(projectDirs([f("apps/modules/x/.keel/ids.json")])).toEqual([""]);
    expect(projectDirs([f("apps/mymodules/topology.ts", TOP)])).toEqual(["apps/mymodules/", ""]);
    expect(projectDirs([f("apps/modules-x/.keel/ids.json")])).toEqual(["apps/modules-x/", ""]);
  });

  it("lists each project once, deepest first and by name among equals", () => {
    expect(
      projectDirs([
        f("apps/b/topology.ts", TOP),
        f("apps/a/.keel/ids.json"),
        f("apps/b/.keel/ids.json"),
        f("apps/a/topology.ts", "export const x = 1"),
        f("apps/topology.ts", TOP),
        f("apps/a/inner/topology.ts", TOP),
        f("zz/.keel/a.json"),
        f("ab/.keel/a.json"),
      ]),
    ).toEqual(["apps/a/inner/", "apps/a/", "apps/b/", "apps/", "ab/", "zz/", ""]);
  });

  const seg = fc.constantFrom("a", "b", "apps", "modules", "x1");
  const dir = fc.array(seg, { minLength: 0, maxLength: 3 }).map((s) => s.map((x) => `${x}/`).join(""));
  const entry = fc.oneof(
    dir.map((d) => ({ file: f(`${d}topology.ts`, TOP), dir: d })),
    dir.map((d) => ({ file: f(`${d}.keel/ids.json`), dir: d })),
    dir.map((d) => ({ file: f(`${d}topology.ts`, "export const t = 1"), dir: undefined })),
    dir.map((d) => ({ file: f(`${d}page.ts`, TOP), dir: undefined })),
  );

  it("is the root and each marked dir without a modules segment, deepest first, in any file order", () => {
    fc.assert(
      fc.property(fc.array(entry, { maxLength: 8 }), (entries) => {
        const want = new Set([""]);
        for (const e of entries) if (e.dir !== undefined && !e.dir.split("/").includes("modules")) want.add(e.dir);
        const got = projectDirs(entries.map((e) => e.file));
        expect(new Set(got)).toEqual(want);
        expect(got).toHaveLength(want.size);
        expect(got.at(-1)).toBe("");
        for (let i = 1; i < got.length; i++) {
          const [a, b] = [got[i - 1] ?? "", got[i] ?? ""];
          expect(a.length > b.length || (a.length === b.length && a < b)).toBe(true);
        }
        expect(projectDirs(entries.map((e) => e.file).reverse())).toEqual(got);
      }),
      { seed: 1337, numRuns: 200 },
    );
  });

  it("a file's own project is the first dir that prefixes its path", () => {
    fc.assert(
      fc.property(fc.array(entry, { maxLength: 8 }), dir, (entries, d) => {
        const dirs = projectDirs(entries.map((e) => e.file));
        const path = `${d}page.ts`;
        const own = dirs.find((p) => path.startsWith(p)) ?? "";
        for (const p of dirs) if (path.startsWith(p)) expect(own.length).toBeGreaterThanOrEqual(p.length);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
