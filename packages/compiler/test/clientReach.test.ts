// Client reach (k.boundary Reach): which files E1004 reads, and which server-only imports it reports with which chain.
import fc from "fast-check";
import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";
import { clientReach } from "../src/internal/clientReach.ts";
import type { Topology } from "../src/types/Topology.ts";

const files = (tree: Record<string, string>) =>
  Object.entries(tree).map(([path, source]) => ({
    path,
    program: parseSync(path, source, { sourceType: "module" }).program,
  }));
const node: Topology = { api: { modules: ["a"], adapter: "node" }, web: { modules: ["w"], adapter: "client" } };
const ROUTES =
  "import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nexport const routes = manifest({ 'a.p': { path: '/', component: Page } })\n";

describe("clientReach", () => {
  it("names the chain from the route component to the server-only file", () => {
    const r = clientReach(
      files({
        "modules/a/routes.ts": ROUTES,
        "modules/a/Page.tsx": "import { f } from '../../lib/f.ts'\nexport default () => f\n",
        "lib/f.ts": "import { k } from './k.guard.ts'\nexport const f = k\n",
        "lib/k.guard.ts": "export const k = 1\n",
      }),
      node,
    );
    expect(r.hits).toEqual([
      { path: "lib/f.ts", start: 0, source: "./k.guard.ts", chain: "modules/a/Page.tsx -> lib/f.ts -> lib/k.guard.ts" },
    ]);
    expect([...r.subject].sort()).toEqual(["lib/f.ts", "modules/a/Page.tsx", "modules/a/routes.ts"]);
  });

  it("lets a routes.ts and a client module's own handler files import server-only names", () => {
    const r = clientReach(
      files({
        "modules/a/routes.ts": `import { load } from './load.server.ts'\n${ROUTES}`,
        "modules/a/Page.tsx": "export default () => null\n",
        "modules/a/load.server.ts": "export const load = 1\n",
        "modules/w/View.tsx": "import { own } from './own.server.ts'\nexport default () => own\n",
        "modules/w/own.server.ts": "export const own = 1\n",
      }),
      node,
    );
    expect(r.hits).toEqual([]);
  });

  it("reports a query import by its file, and a client module's import of another module's server-only file", () => {
    const r = clientReach(
      files({
        "modules/a/x.ts": "import s from './n.server.ts?raw'\nexport const x = s\n",
        "modules/w/View.tsx": "import { load } from '../a/load.server.ts'\nexport default () => load\n",
      }),
      node,
    );
    expect(r.hits.map((h) => [h.path, h.source])).toEqual([
      ["modules/w/View.tsx", "../a/load.server.ts"],
      ["modules/a/x.ts", "./n.server.ts?raw"],
    ]);
  });

  it("without a topology reads every file but server-only ones, and never one only server-only files import", () => {
    fc.assert(
      fc.property(fc.constantFrom("server", "guard"), fc.boolean(), (kind, typeOnly) => {
        const r = clientReach(
          files({
            [`a.${kind}.ts`]: "import { b } from './b.ts'\nexport const a = b\n",
            "b.ts": `import ${typeOnly ? "type " : ""}{ c } from './c.${kind}.ts'\nexport const b = 1\n`,
            [`c.${kind}.ts`]: "export const c = 1\n",
          }),
          undefined,
        );
        expect([...r.subject]).toEqual(["b.ts"]);
        expect(r.hits.length).toBe(typeOnly ? 0 : 1);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});
