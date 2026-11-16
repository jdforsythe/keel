import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type SourceFile, check } from "../src/index.ts";

const SEED = 1337;
const f = (path: string, source: string): SourceFile => ({ path, source });
const HEAD = "import { topology } from '@keel/server'\n";
const MODULE = f(
  "modules/a/module.ts",
  "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [] })\n",
);
const codes = (files: SourceFile[]) =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.path === "topology.ts")
    .map((d) => d.code);

/** Default exports the static read cannot take: the deployables reach `topology` through a binding or a call. */
const unreadable = fc.constantFrom(
  "const t = { web: { modules: ['a'], adapter: 'static' } }\nexport default topology(t)\n",
  "const make = () => ({ web: { modules: ['a'], adapter: 'static' } })\nexport default topology(make())\n",
  "const web = { modules: ['a'], adapter: 'static' } as const\nexport default topology({ web })\n",
);

describe("topology.ts in check(files) without a caller topology", () => {
  it("a topology the static read cannot take is one E1552 at topology.ts", () => {
    fc.assert(
      fc.property(unreadable, (body) => {
        expect(codes([f("topology.ts", HEAD + body), MODULE])).toEqual(["E1552"]);
      }),
      { seed: SEED, numRuns: 6 },
    );
  });

  it("a literal topology is none", () => {
    const files = [
      f("topology.ts", `${HEAD}export default topology({ web: { modules: ['a'], adapter: 'static' } })\n`),
      MODULE,
    ];
    expect(codes(files)).toEqual([]);
  });
});

describe("a workspace with an unreadable topology.ts in a subfolder", () => {
  it.fails(
    "is one E1552 at <name>/topology.ts, the folder its own project (a folder holding a topology.ts is not a project root unless it reads statically)",
    () => {
      const root = f("topology.ts", `${HEAD}export default topology({ web: { modules: ['a'], adapter: 'static' } })\n`);
      const app = f(
        "apps/web/topology.ts",
        `${HEAD}const t = { web: { modules: ['a'], adapter: 'static' } }\nexport default topology(t)\n`,
      );
      const result = check([root, MODULE, app, f("apps/web/main.ts", "export const x = 1\n")], { types: false });
      expect(result.diagnostics.filter((d) => d.code === "E1552").map((d) => d.path)).toEqual(["apps/web/topology.ts"]);
    },
  );
});
