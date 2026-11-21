// Spec: k.boundary, Conformance "A route component reaching `lib/keys.server.ts` through `lib/fmt.ts` is one E1004 at `lib/fmt.ts` naming the chain, and a literal-origin `ctx.net.fetch` in `lib/fmt.ts` is E1571; none for a type-only import, a schema both sides import, a `routes.ts` value import, or a file only server-only files import."
// Spec: k.boundary, Conformance "For generated import graphs, E1004 is reported exactly when a route component reaches a server-only file by value imports through no server-only file or `routes.ts`."
// Spec: k.boundary, Reach "Client-reachable code (E1004 and E1571; E1107 has its own, k.leave), with a `topology.ts`: a file under `modules/<id>/`, not server-only, of a `node` or `static` module (one such a deployable lists); a file of a `client` module, for imports of another module's server-only files; and a project file outside `node_modules/` a client entry reaches by value imports, re-exports and literal `import()`, not through a server-only file. Client entries: each route `component` of a `node` or `static` module and every file of a `client` one. No `topology.ts`: every file but server-only ones. A `routes.ts` may import server-only files by value; a specifier with a query names its file; package imports are not followed (E1007 covers them). An E1004 found through a chain ends `(<entry> -> … -> <file>)`."
// Seed 1337 (fc.assert below). `check` over in-memory project trees with a `topology.ts` (the type pass is off: the rule reads syntax and the topology).
// Node `api` lists module `a`, `client` `web` lists module `w`. E1004's message ends `(<entry> -> … -> <file>)`, the chain from the route component to the server-only file.
import { posix } from "node:path";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CONTRACT_A, type Diag, ROUTES_A, diagsOf, file, nodeA, pageOf } from "./boundary-support.ts";
import { SEED } from "./support.ts";

const FMT = (extra = ""): ReturnType<typeof file> =>
  file(
    "lib/fmt.ts",
    `import { key } from './keys.server.ts'\n${extra}export const fmt = (x: string): string => x + key\n`,
  );
const KEYS = file("lib/keys.server.ts", "export const key = 'k'\n");
const PAGE_FMT = pageOf(
  "import { fmt } from '../../lib/fmt.ts'\n",
  "export default function Page() {\n  return fmt('x')\n}\n",
);
const LOAD = file("modules/a/load.server.ts", "export const load = () => 1\nexport type T = number\n");
const FETCH =
  "import type { Ctx } from '@keel/ctx'\nexport const get = (ctx: Ctx) => ctx.net.fetch(new Request('https://api.example/x'))\n";

const e1004 = (files: Parameters<typeof diagsOf>[0]): Diag[] => diagsOf(files, "E1004");

describe("k.boundary Reach: a route component reaching a server-only file through a plain file", () => {
  test("`Page.tsx` reaching `lib/keys.server.ts` through `lib/fmt.ts` is one E1004 at `lib/fmt.ts` naming the chain", () => {
    const d = e1004(nodeA([ROUTES_A, CONTRACT_A, PAGE_FMT, FMT(), KEYS]));
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("lib/fmt.ts");
    expect(d[0]?.message.endsWith("(modules/a/Page.tsx -> lib/fmt.ts -> lib/keys.server.ts)")).toBe(true);
  });

  test("a literal-origin `ctx.net.fetch` in `lib/fmt.ts` is one E1571", () => {
    const files = nodeA([ROUTES_A, CONTRACT_A, PAGE_FMT, FMT(FETCH), KEYS]);
    const hits = diagsOf(files, "E1571");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toBe("lib/fmt.ts");
  });

  test("the same `lib/fmt.ts` reached by no route component is no E1004 and no E1571", () => {
    const files = nodeA([ROUTES_A, CONTRACT_A, pageOf(""), FMT(), KEYS, file("lib/net.ts", FETCH)]);
    expect(e1004(files)).toEqual([]);
    expect(diagsOf(files, "E1571")).toEqual([]);
  });
});

describe("k.boundary Reach: a `client` module imports another module's server-only file", () => {
  test("`modules/w/View.tsx` importing `../a/load.server.ts` is one E1004", () => {
    const d = e1004(
      nodeA([
        LOAD,
        file(
          "modules/w/View.tsx",
          "import { load } from '../a/load.server.ts'\nexport default function View() {\n  return load()\n}\n",
        ),
      ]),
    );
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("modules/w/View.tsx");
  });

  test("`modules/w/loadW.server.ts` imported by `modules/w/routes.ts` and by `modules/w/View.tsx` is none: its handler files are browser files", () => {
    const d = e1004(
      nodeA([
        file("modules/w/loadW.server.ts", "export const loadW = () => 1\n"),
        file(
          "modules/w/routes.ts",
          "import { manifest } from '@keel/router'\nimport { w } from './w.contract.ts'\nimport { loadW } from './loadW.server.ts'\nimport View from './View.tsx'\nexport const routes = manifest(w, { 'w.home': { loader: loadW, component: View } })\n",
        ),
        file(
          "modules/w/w.contract.ts",
          "import { contract } from '@keel/router/contract'\nexport const w = contract('w', { 'w.home': { path: '/' } })\n",
        ),
        file(
          "modules/w/View.tsx",
          "import { loadW } from './loadW.server.ts'\nexport default function View() {\n  return loadW()\n}\n",
        ),
      ]),
    );
    expect(d).toEqual([]);
  });
});

describe("k.boundary Reach: a specifier with a query names its file", () => {
  const RAW = file("modules/a/x.server.ts", "export const x = 1\n");
  const AUTH = file("modules/a/auth.guard.ts", "export const auth = 1\n");
  const cases: readonly (readonly [string, string])[] = [
    [
      "`import s from './x.server.ts?raw'` in `Page.tsx`",
      "import s from './x.server.ts?raw'\nReflect.set(globalThis, 's', s)\n",
    ],
    ["`import('./x.server.ts?url')` in `Page.tsx`", "export const lazy = () => import('./x.server.ts?url')\n"],
    [
      "`import { auth } from './auth.guard.ts'` in `Page.tsx`",
      "import { auth } from './auth.guard.ts'\nReflect.set(globalThis, 'a', auth)\n",
    ],
  ];
  for (const [name, source] of cases) {
    test(`${name} is one E1004`, () => {
      const d = e1004(
        nodeA([
          ROUTES_A,
          CONTRACT_A,
          RAW,
          AUTH,
          file("modules/a/Page.tsx", `${source}export default function Page() {\n  return null\n}\n`),
        ]),
      );
      expect(d).toHaveLength(1);
      expect(d[0]?.path).toBe("modules/a/Page.tsx");
    });
  }
});

describe("k.boundary Reach: none", () => {
  const SCHEMA = file("modules/a/Item.schema.ts", "export const Item = { id: 'x' }\n");
  const none: readonly (readonly [string, Parameters<typeof nodeA>[0]])[] = [
    [
      "`import type { T } from './load.server.ts'` in `Page.tsx`",
      [
        ROUTES_A,
        CONTRACT_A,
        LOAD,
        pageOf(
          "import type { T } from './load.server.ts'\n",
          "export default function Page(): T | null {\n  return null\n}\n",
        ),
      ],
    ],
    [
      "`Item.schema.ts` imported by `Page.tsx` and by `load.server.ts`",
      [
        ROUTES_A,
        CONTRACT_A,
        SCHEMA,
        file("modules/a/load.server.ts", "import { Item } from './Item.schema.ts'\nexport const load = () => Item\n"),
        pageOf("import { Item } from './Item.schema.ts'\n", "export default function Page() {\n  return Item\n}\n"),
      ],
    ],
    [
      "`routes.ts` importing `load` from `load.server.ts` and `Page.tsx` importing `a.contract.ts` for `a.href`",
      [
        file(
          "modules/a/routes.ts",
          "import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\nimport { load } from './load.server.ts'\nimport Page from './Page.tsx'\nexport const routes = manifest(a, { 'a.show': { loader: load, component: Page } })\n",
        ),
        LOAD,
        pageOf(
          "import { a } from './a.contract.ts'\n",
          "export default function Page() {\n  return a.href('a.show')\n}\n",
        ),
      ],
    ],
    [
      "`lib/only.ts` imported only by `load.server.ts` and itself importing `lib/db.server.ts`",
      [
        ROUTES_A,
        CONTRACT_A,
        pageOf(""),
        file("modules/a/load.server.ts", "import { only } from '../../lib/only.ts'\nexport const load = () => only\n"),
        file("lib/only.ts", "import { db } from './db.server.ts'\nexport const only = db\n"),
        file("lib/db.server.ts", "export const db = 1\n"),
      ],
    ],
    [
      "a server-only file importing another server-only file",
      [
        ROUTES_A,
        CONTRACT_A,
        pageOf(""),
        LOAD,
        file("modules/a/other.server.ts", "import { load } from './load.server.ts'\nexport const other = load\n"),
      ],
    ],
    [
      "tooling at the project root importing a server-only file",
      [
        ROUTES_A,
        CONTRACT_A,
        pageOf(""),
        LOAD,
        file("vite.config.ts", "import { load } from './modules/a/load.server.ts'\nexport default load\n"),
      ],
    ],
  ];
  for (const [name, files] of none) {
    test(`${name} is not E1004`, () => {
      expect(e1004(nodeA(files))).toEqual([]);
    });
  }

  test("a `*.server.ts` file of a module only a `client` deployable lists, imported by its own page, is not E1004", () => {
    const d = e1004(
      nodeA([
        file("modules/w/own.server.ts", "export const own = 1\n"),
        file(
          "modules/w/View.tsx",
          "import { own } from './own.server.ts'\nexport default function View() {\n  return own\n}\n",
        ),
      ]),
    );
    expect(d).toEqual([]);
  });
});

describe("k.boundary Reach: generated import graphs", () => {
  type Kind = "component" | "plain" | "plainLib" | "server" | "serverLib";
  type Node = { kind: Kind; path: string; name: string };
  type Edge = { from: number; to: number; type: boolean };

  const kinds = fc.constantFrom<Kind>("component", "plain", "plainLib", "server", "serverLib");
  const graph = fc
    .tuple(
      fc.array(kinds, { minLength: 1, maxLength: 8 }),
      fc.array(fc.tuple(fc.nat(7), fc.nat(7), fc.boolean()), { maxLength: 20 }),
      fc.array(fc.nat(7), { maxLength: 4 }),
    )
    .map(([ks, rawEdges, routeTargets]) => {
      const nodes: Node[] = ks.map((kind, i) => {
        const dir = kind === "plainLib" || kind === "serverLib" ? "lib" : "modules/a";
        const ext = kind === "component" ? ".tsx" : kind === "server" || kind === "serverLib" ? ".server.ts" : ".ts";
        const stem = kind === "component" ? `C${i}` : kind === "plain" || kind === "plainLib" ? `p${i}` : `s${i}`;
        return { kind, path: `${dir}/${stem}${ext}`, name: `x${i}` };
      });
      const seen = new Set<string>();
      const edges: Edge[] = [];
      for (const [a, b, type] of rawEdges) {
        const from = a % nodes.length;
        const to = b % nodes.length;
        const target = nodes[to];
        if (from >= to || target === undefined || target.kind === "component" || seen.has(`${from}:${to}`)) continue;
        seen.add(`${from}:${to}`);
        edges.push({ from, to, type });
      }
      return { nodes, edges, routeTargets: [...new Set(routeTargets.map((t) => t % nodes.length))] };
    });

  const nodeAt = (g: { nodes: Node[] }, i: number): Node => {
    const n = g.nodes[i];
    if (n === undefined) throw new Error(`no node ${i}`);
    return n;
  };
  const isServer = (n: Node): boolean => n.kind === "server" || n.kind === "serverLib";

  function files(g: { nodes: Node[]; edges: Edge[]; routeTargets: number[] }): Parameters<typeof nodeA>[0] {
    const out = g.nodes.map((n, i) => {
      const imports = g.edges
        .filter((e) => e.from === i)
        .map((e) => {
          const t = g.nodes[e.to];
          if (t === undefined) return "";
          const spec = posix.relative(posix.dirname(n.path), t.path);
          return `import ${e.type ? "type " : ""}{ ${t.name} } from '${spec.startsWith(".") ? spec : `./${spec}`}'\n`;
        })
        .join("");
      const uses = g.edges
        .filter((e) => e.from === i && !e.type)
        .map((e) => `void ${g.nodes[e.to]?.name}\n`)
        .join("");
      const body =
        n.kind === "component"
          ? `${uses}export default function C${i}() {\n  return null\n}\n`
          : `${uses}export const ${n.name} = ${i}\n`;
      return file(n.path, `${imports}${body}`);
    });
    const comps = g.nodes.map((n, i) => ({ n, i })).filter(({ n }) => n.kind === "component");
    const servers = g.routeTargets.filter((t) => isServer(nodeAt(g, t)));
    const spec = (n: Node): string => posix.relative("modules/a", n.path).replace(/^(?!\.)/, "./");
    const routes = file(
      "modules/a/routes.ts",
      `import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\n${comps.map(({ n, i }) => `import C${i} from '${spec(n)}'\n`).join("")}${servers.map((t) => `import { ${nodeAt(g, t).name} } from '${spec(nodeAt(g, t))}'\n`).join("")}${servers.map((t) => `void ${nodeAt(g, t).name}\n`).join("")}export const routes = manifest(a, { ${comps.map(({ i }) => `'a.p${i}': { component: C${i} }`).join(", ")} })\n`,
    );
    const contractA = file(
      "modules/a/a.contract.ts",
      `import { contract } from '@keel/router/contract'\nexport const a = contract('a', { ${comps.map(({ i }) => `'a.p${i}': { path: '/p${i}' }`).join(", ")} })\n`,
    );
    return [...out, routes, contractA];
  }

  /** Reports expected by the spec: a plain or component file with a value import of a server-only file, in a module file or reached from a route component through no server-only file or `routes.ts`. */
  function expected(g: { nodes: Node[]; edges: Edge[] }): Map<string, number> {
    const reached = new Set<number>();
    const walk = (i: number): void => {
      if (reached.has(i)) return;
      reached.add(i);
      for (const e of g.edges) {
        const to = g.nodes[e.to];
        if (e.from === i && !e.type && to !== undefined && !isServer(to)) walk(e.to);
      }
    };
    g.nodes.forEach((n, i) => {
      if (n.kind === "component") walk(i);
    });
    const out = new Map<string, number>();
    g.nodes.forEach((n, i) => {
      if (isServer(n)) return;
      const hits = g.edges.filter((e) => e.from === i && !e.type && isServer(nodeAt(g, e.to))).length;
      const inModule = n.kind === "component" || n.kind === "plain";
      if (hits > 0 && (inModule || reached.has(i))) out.set(n.path, hits);
    });
    return out;
  }

  test("E1004 is reported exactly where a route component's value imports reach a server-only file, each report at the last plain file's import", () => {
    fc.assert(
      fc.property(graph, (g) => {
        const d = e1004(nodeA(files(g)));
        const got = new Map<string, number>();
        for (const x of d) got.set(x.path, (got.get(x.path) ?? 0) + 1);
        expect([...got.entries()].sort()).toEqual([...expected(g).entries()].sort());
        for (const x of d) {
          if (x.path.startsWith("lib/")) expect(x.message).toMatch(/\(modules\/a\/C\d+\.tsx -> .*\)$/);
        }
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
