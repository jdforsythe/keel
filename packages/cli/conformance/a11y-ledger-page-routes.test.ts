// Spec: k.a11y, Conformance "In a project whose `routes.json` holds page `m.p` (`path: '/p'`, `layout: 'm.l'`), layout `m.l` (`path: null`), layout `m.x` (`path: null`) that no entry names, and API entry `m.api` (`api: true`), `keel ledger` emits items whose route is `m.p` and none whose route is `m.l`, `m.x` or `m.api`, and reports one W1731 naming `m.x`."
// Spec: k.a11y, Conformance "An E1802 that `keel check` reports in a file under `modules/s/`, the module of layout `s.l` that wraps page `m.p` of module `m`, makes `a11y:.:m.p#1.1.1` rung `none` after a passing `renderRoute` test of `m.p`; without it, or with it under a module no entry of `m.p`'s chain names, the rung is `example`."
// Seed: 1337 (the page-route property below, sampled once with fc.sample; every other case is a fixed project).
// The real `keel` binary over temp projects (OS tmpdir). Cost: `keel ledger` finds every project under the directory it runs in by its `.keel/routes.json` (k.a11y Claims), so the cases that differ only by `routes.json`
// are projects of one directory read by one `keel ledger`, and the layout cases build and test one project once and move one file between `keel ledger` runs.
// `routes.json` entries have the k.compiler Artifacts shape `{ path, params, search, actions, layout, guard, module }`, an API entry adding `api: true` and `method`; `layout` is a layout's id else `null`, `module` the id's module prefix.
// W1731 is a `diag` record at `.keel/routes.json` naming the layout's id (k.ledger Rules). A page route is defined by `path` and `api` alone (k.a11y Claims): the property gives pages `actions` and `guard`.
// "a file under `modules/s/`" is a file of the module folder `modules/s/`; the page's chain is `m.p` (module `m`) then `s.l` (module `s`): `modules/o/` is a module no entry of the chain names.
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { a11yItems, buildAndTest, itemRecord, keelProject, testHead } from "./a11y-project-support.ts";
import { type Run, keel, removeFile, removeProject, writeFiles } from "./test-sim-project.ts";

const created: string[] = [];
afterAll(() => {
  for (const d of created) removeProject(d);
});
const track = (dir: string): string => {
  created.push(dir);
  return dir;
};

type Entry = { path: string | null; layout?: string; api?: true; actions?: string[]; guard?: string };
const entryOf = (id: string, e: Entry): Record<string, unknown> => ({
  path: e.path,
  params: {},
  search: {},
  actions: e.actions ?? (e.api === true ? ["GET"] : []),
  layout: e.layout ?? null,
  guard: e.guard ?? null,
  module: id.slice(0, id.indexOf(".")),
  ...(e.api === true ? { api: true, method: "GET" } : {}),
});
const routesJson = (data: Readonly<Record<string, Entry>>): string =>
  `${JSON.stringify({
    data: Object.fromEntries(Object.entries(data).map(([id, e]) => [id, entryOf(id, e)])),
    hash: "fnv1a:00000000",
  })}\n`;
/** The route id of an item `a11y:<project>:<routeId>#<criterion>`: the text after the last `:` before `#`. */
const routeOf = (item: string): string => item.slice(item.lastIndexOf(":", item.indexOf("#")) + 1, item.indexOf("#"));
/** The project of an item: the text between `a11y:` and the route id. */
const projectOf = (item: string): string => item.slice(5, item.lastIndexOf(":", item.indexOf("#")));
const w1731 = (run: Run): Record<string, unknown>[] =>
  run.records.filter((r) => r.kind === "diag" && r.code === "W1731");

const MIXED: Record<string, Entry> = {
  "m.p": { path: "/p", layout: "m.l" },
  "m.l": { path: null },
  "m.x": { path: null },
  "m.api": { path: "/api/x", api: true },
};

describe("k.a11y: items exist per page route only", () => {
  let mixed: Run;
  let grouped: Run;
  const sampled = fc.sample(
    fc.record({
      pages: fc.array(
        fc.record({
          layout: fc.option(fc.integer({ min: 0, max: 2 }), { nil: undefined }),
          redirecting: fc.boolean(),
        }),
        { maxLength: 3 },
      ),
      layouts: fc.integer({ min: 0, max: 3 }),
      apis: fc.array(fc.option(fc.integer({ min: 0, max: 2 }), { nil: undefined }), { maxLength: 2 }),
    }),
    { seed: 1337, numRuns: 25 },
  );
  const dataOf = ({
    pages,
    layouts,
    apis,
  }: (typeof sampled)[number]): { data: Record<string, Entry>; named: Set<string> } => {
    const data: Record<string, Entry> = {};
    const named = new Set<string>();
    pages.forEach((p, i) => {
      const entry: Entry = { path: `/p${i}` };
      if (p.layout !== undefined && p.layout < layouts) {
        entry.layout = `m.l${p.layout}`;
        named.add(`m.l${p.layout}`);
      }
      if (p.redirecting) {
        entry.actions = ["POST"];
        entry.guard = "m.login";
      }
      data[`m.p${i}`] = entry;
    });
    for (let i = 0; i < layouts; i++) data[`m.l${i}`] = { path: null };
    apis.forEach((l, i) => {
      data[`m.a${i}`] = { path: `/api/a${i}`, api: true };
      if (l !== undefined && l < layouts) data[`m.a${i}`] = { path: `/api/a${i}`, api: true, layout: `m.l${l}` };
    });
    return { data, named };
  };
  const pad = (i: number): string => String(i).padStart(2, "0");

  beforeAll(() => {
    mixed = keel(track(keelProject("a11y-pages", { ".keel/routes.json": routesJson(MIXED) })), ["ledger"]);
    const files: Record<string, string> = {
      "chain/.keel/routes.json": routesJson({
        "m.p": { path: "/p", layout: "m.inner" },
        "m.inner": { path: null, layout: "m.outer" },
        "m.outer": { path: null },
      }),
      "apiname/.keel/routes.json": routesJson({
        "m.api": { path: "/api/x", api: true, layout: "m.l" },
        "m.l": { path: null },
      }),
    };
    sampled.forEach((s, i) => {
      files[`prop/c${pad(i)}/.keel/routes.json`] = routesJson(dataOf(s).data);
    });
    grouped = keel(track(keelProject("a11y-pages-grouped", files)), ["ledger"]);
  }, 180_000);

  it("`keel ledger` emits items whose route is `m.p` and none whose route is `m.l`, `m.x` or `m.api`", () => {
    expect([...new Set(a11yItems(mixed).map(routeOf))]).toEqual(["m.p"]);
  });

  it("reports one W1731 naming `m.x`, at `.keel/routes.json`, and none for `m.l`", () => {
    const found = w1731(mixed);
    expect(found).toHaveLength(1);
    const text = JSON.stringify(found[0]);
    expect(text).toContain("m.x");
    expect(text).not.toContain("m.l");
    expect(text).toContain(".keel/routes.json");
  });

  it("a layout named only by another layout that a page names is in that page's chain: no W1731", () => {
    const items = a11yItems(grouped).filter((i) => projectOf(i) === "chain");
    expect(items.length).toBeGreaterThan(0);
    expect(new Set(items.map(routeOf))).toEqual(new Set(["m.p"]));
    expect(w1731(grouped).filter((d) => JSON.stringify(d).includes("chain/.keel/routes.json"))).toEqual([]);
  });

  it("a layout wrapping no page route is W1731 even when an API entry names it", () => {
    const found = w1731(grouped).filter((d) => JSON.stringify(d).includes("apiname/.keel/routes.json"));
    expect(found).toHaveLength(1);
    expect(JSON.stringify(found[0])).toContain("m.l");
    expect(a11yItems(grouped).filter((i) => projectOf(i) === "apiname")).toEqual([]);
  });

  it("items are exactly the page routes and W1731 exactly the layouts no page names, over any mix of pages, layouts and API entries (property, seed 1337)", () => {
    expect(sampled).toHaveLength(25);
    sampled.forEach((s, i) => {
      const project = `prop/c${pad(i)}`;
      const { named } = dataOf(s);
      const routes = new Set(
        a11yItems(grouped)
          .filter((it) => projectOf(it) === project)
          .map(routeOf),
      );
      expect([...routes].sort()).toEqual(s.pages.map((_, k) => `m.p${k}`).sort());
      const orphans = Array.from({ length: s.layouts }, (_, k) => `m.l${k}`).filter((id) => !named.has(id));
      const reported = w1731(grouped)
        .map((d) => JSON.stringify(d))
        .filter((t) => t.includes(`${project}/.keel/routes.json`));
      expect(reported).toHaveLength(orphans.length);
      for (const id of orphans) expect(reported.filter((t) => t.includes(id))).toHaveLength(1);
    });
  });
});

// ---- E1802 in a module of the page's chain counts against the page
const TOPOLOGY = `export default { api: { modules: ["s", "m"], adapter: "node" } };\n`;
const MODULE = (id: string, deps: string[], exported: string[]): string => `import { module } from "@keel/compiler";
export default module({ id: ${JSON.stringify(id)}, deps: ${JSON.stringify(deps)}, capabilities: [], public: { exports: ${JSON.stringify(exported)} } });
`;
const S_CONTRACT = `import { contract } from "@keel/router/contract";
export const s = contract("s", { "s.l": { layout: true } });
`;
const M_CONTRACT = `import { contract } from "@keel/router/contract";
export const m = contract("m", { "m.p": { path: "/p" } });
`;
const LAYOUT = (label: string): string => `import type { RouteProps } from "@keel/router";
import { Box, Input } from "@keel/ui";

// the empty-layout branch never renders under a page; the static check reads it all the same
export const Shell = (p: RouteProps) => {
  const kids = p.children;
  if (kids === undefined) return Input({ id: "s.l.empty", label: ${JSON.stringify(label)}, autocomplete: "off" });
  return Box({ id: "s.l.box", children: () => [kids()] });
};
`;
const PAGE = `import { Text } from "@keel/ui";

export const Page = () => Text({ id: "m.p.msg", children: "p" });
`;
const S_ROUTES = `import { manifest } from "@keel/router";
import { s } from "./s.contract.ts";
import { Shell } from "./Shell.ts";

export const routes = manifest(s, { "s.l": { component: Shell } });
`;
const M_ROUTES = `import { manifest } from "@keel/router";
import { m } from "./m.contract.ts";
import { Page } from "./Page.ts";

export const routes = manifest(m, { "m.p": { component: Page, title: () => "P", layout: "s.l" } });
`;
const TEST = `${testHead(false).replace('import { routes } from "../routes.ts";', 'import { routeTable } from "@keel/router";\nimport { routes as mRoutes } from "../routes.ts";\nimport { routes as sRoutes } from "../../s/routes.ts";')}
const routes = routeTable(sRoutes, mRoutes);
it("renders the page p inside its layout", async () => {
  const h = await renderRoute("m.p", { routes, ctx: ctx() });
  expect(h.find("m.p.msg").text).toBe("p");
  h.dispose();
});
`;
const ELSEWHERE = `import { Input } from "@keel/ui";

export const Elsewhere = () => Input({ id: "o.in", label: " ", autocomplete: "off" });
`;

describe("k.a11y: a static code in a module of the page's chain counts against the page", () => {
  let dir = "";
  let clean: Run;
  // `keel build` refuses an E1802, so the project builds and tests clean once; a case then writes one file, runs `keel check` and `keel ledger`, and puts the tree back
  beforeAll(() => {
    dir = track(
      keelProject("a11y-layout", {
        "topology.ts": TOPOLOGY,
        "modules/s/module.ts": MODULE("s", [], ["routes"]),
        "modules/s/s.contract.ts": S_CONTRACT,
        "modules/s/Shell.ts": LAYOUT("Name"),
        "modules/s/routes.ts": S_ROUTES,
        "modules/m/module.ts": MODULE("m", ["s"], []),
        "modules/m/m.contract.ts": M_CONTRACT,
        "modules/m/Page.ts": PAGE,
        "modules/m/routes.ts": M_ROUTES,
        "modules/m/test/p.test.ts": TEST,
      }),
    );
    expect(buildAndTest(dir).status).toBe(0);
    clean = keel(dir, ["ledger"]);
  }, 180_000);

  const withFile = (path: string, source: string, restore?: string): { run: Run; checked: boolean } => {
    writeFiles(dir, { [path]: source });
    try {
      const checked = keel(dir, ["check"]).records.some((r) => r.kind === "diag" && r.code === "E1802");
      return { run: keel(dir, ["ledger"]), checked };
    } finally {
      if (restore === undefined) removeFile(dir, path);
      else writeFiles(dir, { [path]: restore });
    }
  };

  it("an E1802 in a file under `modules/s/`, the module of layout `s.l`, makes `a11y:.:m.p#1.1.1` rung `none` after a passing `renderRoute` test of `m.p`", () => {
    const { run, checked } = withFile("modules/s/Shell.ts", LAYOUT(" "), LAYOUT("Name"));
    expect(checked).toBe(true);
    expect(itemRecord(run, "a11y:.:m.p#1.1.1")).toMatchObject({ rung: "none" });
  }, 120_000);

  it("an E1802 in a file under `modules/m/`, the module of page `m.p`, makes `a11y:.:m.p#1.1.1` rung `none`", () => {
    const { run, checked } = withFile("modules/m/Elsewhere.ts", ELSEWHERE);
    expect(checked).toBe(true);
    expect(itemRecord(run, "a11y:.:m.p#1.1.1")).toMatchObject({ rung: "none" });
  }, 120_000);

  it("without that E1802 the rung of `a11y:.:m.p#1.1.1` is `example`", () => {
    expect(itemRecord(clean, "a11y:.:m.p#1.1.1")).toMatchObject({ rung: "example" });
  });

  it("an E1802 under a module no entry of `m.p`'s chain names, `modules/o/`, does not change the rung of `a11y:.:m.p#1.1.1`", () => {
    const { run, checked } = withFile("modules/o/Elsewhere.ts", ELSEWHERE);
    expect(checked).toBe(true);
    expect(itemRecord(run, "a11y:.:m.p#1.1.1")).toMatchObject({ rung: "example" });
  }, 120_000);

  it("the layout `s.l` has no item of its own", () => {
    expect(new Set(a11yItems(clean).map(routeOf))).toEqual(new Set(["m.p"]));
  });
});
