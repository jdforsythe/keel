// Spec: k.scaffold, Conformance "`keel scaffold project p` and `keel scaffold project p --workspace` write no `index.html`, and `topology.ts`'s deployable has `styles: ['@keel/ui/fonts']`."
// Seed: none (no generated input beyond the three adapters; spawns are costly). Pending: `project` still writes `index.html` and no `styles`.
// ASSUMPTION: `topology.ts` is written with `styles` on the one deployable, in either quote style; with `--workspace` the project folder is still `<name>/`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, readTree, scaffolded } from "./agent-files-support.ts";
import { apply } from "./fixtures.ts";

const STYLES = /styles:\s*\[\s*['"]@keel\/ui\/fonts['"]\s*\]/;
let dir = "";
let wsDir = "";
let tree = new Map<string, string>();
let wsTree = new Map<string, string>();
beforeAll(() => {
  const a = scaffolded();
  dir = a.dir;
  tree = readTree(a.proj);
  const b = scaffolded(["--workspace"]);
  wsDir = b.dir;
  wsTree = readTree(b.proj);
});
afterAll(() => {
  cleanup(dir);
  cleanup(wsDir);
});

describe("k.scaffold: project writes no index.html and declares styles", () => {
  it.skip("`keel scaffold project p` writes no `index.html`, and `topology.ts`'s deployable has `styles: ['@keel/ui/fonts']`", () => {
    expect([...tree.keys()].filter((p) => p.split("/").pop() === "index.html")).toEqual([]);
    expect(tree.get("topology.ts") ?? "").toMatch(STYLES);
  });

  it.skip("`keel scaffold project p --workspace` writes no `index.html`, and `topology.ts`'s deployable has `styles: ['@keel/ui/fonts']`", () => {
    expect([...wsTree.keys()].filter((p) => p.split("/").pop() === "index.html")).toEqual([]);
    expect(wsTree.get("topology.ts") ?? "").toMatch(STYLES);
  });

  it.skip("for each adapter `client`, `node` and `static` the generated `topology.ts` has the `styles` entry and no `index.html` is written", () => {
    for (const adapter of ["client", "node", "static"]) {
      const files = apply("project", { name: "shop", adapter }, new Map()).files;
      expect(files.has("index.html"), adapter).toBe(false);
      expect(files.get("topology.ts") ?? "", adapter).toMatch(STYLES);
    }
  });
});
