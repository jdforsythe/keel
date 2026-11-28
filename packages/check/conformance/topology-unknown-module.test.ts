// Spec: k.topology, clause "With `topology({ web: { modules: ['shop', 'ghost'], adapter: 'node' } })` and no `modules/ghost/`, `keel check` and `keel build` each report one E1552 at `'ghost'` in `topology.ts`, message `web: unknown module ghost`, and `keel build` writes no `dist/web/server.mjs`; with `modules/ghost/module.ts` present, or `ghost` the root manifest id of a library in `shop`'s `deps`, neither reports it."
// Seed 1337. In-memory project files; the `keel build` half is packages/cli/conformance/build-unknown-module.test.ts.
import { check } from "@keel/check";
import { describe, expect, it } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";

const MESSAGE = "web: unknown module ghost";
const TOPOLOGY =
  "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['shop', 'ghost'], adapter: 'node' } })\n";
const SHOP = (deps: string[] = []) => manifestFile({ id: "shop", deps, capabilities: [], exports: [] });
const unknown = (files: Files) =>
  check(files, {}).diagnostics.filter((d) => d.code === "E1552" && d.message === MESSAGE);

describe("k.topology: a deployable naming an unknown module", () => {
  it("`modules: ['shop', 'ghost']` with no `modules/ghost/` is one E1552 at `'ghost'` in `topology.ts`, message `web: unknown module ghost`", () => {
    const ds = unknown([{ path: "topology.ts", source: TOPOLOGY }, SHOP()]);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("topology.ts");
    const before = TOPOLOGY.slice(0, TOPOLOGY.indexOf("'ghost'")).split("\n");
    expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual({
      line: before.length,
      col: (before[before.length - 1]?.length ?? 0) + 1,
    });
  });

  it("with `modules/ghost/module.ts` present it is not reported", () => {
    expect(
      unknown([
        { path: "topology.ts", source: TOPOLOGY },
        SHOP(),
        manifestFile({ id: "ghost", deps: [], capabilities: [], exports: [] }),
      ]),
    ).toEqual([]);
  });

  it("with `ghost` the root manifest id of a library in `shop`'s `deps` it is not reported", () => {
    const root = "node_modules/@acme/ghost";
    const files: Files = [
      { path: "topology.ts", source: TOPOLOGY },
      SHOP(["@acme/ghost"]),
      {
        path: `${root}/package.json`,
        source: JSON.stringify({ name: "@acme/ghost", version: "1.0.0", type: "module", keel: "library" }),
      },
      manifestFile({ id: "ghost", deps: [], capabilities: [], exports: [] }, root),
    ];
    expect(unknown(files)).toEqual([]);
  });
});
