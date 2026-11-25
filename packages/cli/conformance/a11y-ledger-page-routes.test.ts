// Spec: k.a11y, Conformance "In a project whose `routes.json` holds page `m.p` (`path: '/p'`, `layout: 'm.l'`), layout `m.l` (`path: null`), layout `m.x` (`path: null`) that no entry names, and API entry `m.api` (`api: true`), `keel ledger` emits items whose route is `m.p` and none whose route is `m.l`, `m.x` or `m.api`, and reports one W1731 naming `m.x`."
// Spec: k.a11y, Conformance "An E1802 that `keel check` reports in a file of layout `m.l`'s module, the page `m.p` in another module, makes `a11y:.:m.p#1.1.1` rung `none` after a passing `renderRoute` test of `m.p`; without it the rung is `example`."
// Seed: 1337 (the page-route property below; every other case is a fixed project, one binary run per step).
// The real `keel` binary over temp projects (OS tmpdir). Assumed: `keel ledger` finds a project by its `.keel/routes.json`, whose `data` maps a route id to
// `{ path, layout?, api?, actions?, guard? }` (k.router Artifacts: `actions` lists a page's bound verbs, `guard` is the guard's redirect, a layout has `path: null`),
// a layout entry may itself carry `layout`, and W1731 is a `diag` record naming the layout's id and the file `.keel/routes.json`.
// "the page `m.p` in another module" is read as another source file: the layout's component and the page's component live in two files of the project.
// Untestable here, one line: a page whose action or guard redirects is a page route because k.a11y Claims defines one by `path` and `api` alone; the property gives pages `actions` and `guard` and expects their items.
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { a11yItems, buildAndTest, itemRecord, keelProject, testHead } from "./a11y-project-support.ts";
import { type Run, keel, removeProject, writeFiles } from "./test-sim-project.ts";

const created: string[] = [];
afterAll(() => {
  for (const d of created) removeProject(d);
});
const track = (dir: string): string => {
  created.push(dir);
  return dir;
};

type Entry = { path: string | null; layout?: string; api?: true; actions?: string[]; guard?: string };
const routesJson = (data: Readonly<Record<string, Entry>>): string =>
  `${JSON.stringify({ data, hash: "fnv1a:00000000" })}\n`;
/** The route id of an item `a11y:<project>:<routeId>#<criterion>`: the text after the last `:` before `#`. */
const routeOf = (item: string): string => item.slice(item.lastIndexOf(":", item.indexOf("#")) + 1, item.indexOf("#"));
const w1731 = (run: Run): Record<string, unknown>[] =>
  run.records.filter((r) => r.kind === "diag" && r.code === "W1731");

describe("k.a11y: items exist per page route only", () => {
  it("`keel ledger` emits items whose route is `m.p` and none whose route is `m.l`, `m.x` or `m.api`", () => {
    const dir = track(
      keelProject("a11y-pages", {
        ".keel/routes.json": routesJson({
          "m.p": { path: "/p", layout: "m.l" },
          "m.l": { path: null },
          "m.x": { path: null },
          "m.api": { path: "/api/x", api: true },
        }),
      }),
    );
    const routes = new Set(a11yItems(keel(dir, ["ledger"])).map(routeOf));
    expect([...routes]).toEqual(["m.p"]);
  }, 60_000);

  it("reports one W1731 naming `m.x`, at `.keel/routes.json`, and none for `m.l`", () => {
    const dir = track(
      keelProject("a11y-w1731", {
        ".keel/routes.json": routesJson({
          "m.p": { path: "/p", layout: "m.l" },
          "m.l": { path: null },
          "m.x": { path: null },
          "m.api": { path: "/api/x", api: true },
        }),
      }),
    );
    const found = w1731(keel(dir, ["ledger"]));
    expect(found).toHaveLength(1);
    const text = JSON.stringify(found[0]);
    expect(text).toContain("m.x");
    expect(text).not.toContain("m.l");
    expect(text).toContain(".keel/routes.json");
  }, 60_000);

  it("a layout named only by another layout that a page names is in that page's chain: no W1731", () => {
    const dir = track(
      keelProject("a11y-w1731-chain", {
        ".keel/routes.json": routesJson({
          "m.p": { path: "/p", layout: "m.inner" },
          "m.inner": { path: null, layout: "m.outer" },
          "m.outer": { path: null },
        }),
      }),
    );
    const run = keel(dir, ["ledger"]);
    expect(a11yItems(run).length).toBeGreaterThan(0);
    for (const item of a11yItems(run)) expect(item.startsWith("a11y:.:")).toBe(true);
    expect(w1731(run)).toEqual([]);
  }, 60_000);

  it("a layout wrapping no page route is W1731 even when an API entry names it", () => {
    const dir = track(
      keelProject("a11y-w1731-api", {
        ".keel/routes.json": routesJson({
          "m.api": { path: "/api/x", api: true, layout: "m.l" },
          "m.l": { path: null },
        }),
      }),
    );
    const found = w1731(keel(dir, ["ledger"]));
    expect(found).toHaveLength(1);
    expect(JSON.stringify(found[0])).toContain("m.l");
    expect(a11yItems(keel(dir, ["ledger"]))).toEqual([]);
  }, 60_000);

  it("items are exactly the page routes and W1731 exactly the layouts no page names, over any mix of pages, layouts and API entries (property, seed 1337)", () => {
    const kinds = fc.record({
      pages: fc.array(
        fc.record({
          layout: fc.option(fc.integer({ min: 0, max: 2 }), { nil: undefined }),
          redirecting: fc.boolean(),
        }),
        { maxLength: 3 },
      ),
      layouts: fc.integer({ min: 0, max: 3 }),
      apis: fc.array(fc.option(fc.integer({ min: 0, max: 2 }), { nil: undefined }), { maxLength: 2 }),
    });
    fc.assert(
      fc.property(kinds, ({ pages, layouts, apis }) => {
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
        const dir = keelProject("a11y-pages-prop", { ".keel/routes.json": routesJson(data) });
        try {
          const run = keel(dir, ["ledger"]);
          const routes = new Set(a11yItems(run).map(routeOf));
          expect([...routes].sort()).toEqual(pages.map((_, i) => `m.p${i}`).sort());
          const orphans = Array.from({ length: layouts }, (_, i) => `m.l${i}`).filter((id) => !named.has(id));
          const reported = w1731(run).map((d) => JSON.stringify(d));
          expect(reported).toHaveLength(orphans.length);
          for (const id of orphans)
            expect(reported.filter((t) => t.includes(`"${id}"`) || t.includes(id))).not.toHaveLength(0);
        } finally {
          removeProject(dir);
        }
      }),
      { seed: 1337, numRuns: 25 },
    );
  }, 300_000);
});

// ---- E1802 in a layout's module counts against the pages it wraps
const CONTRACT = `import { contract } from "@keel/router/contract";
export const m = contract("m", {
  "m.l": { layout: true },
  "m.p": { path: "/p" },
});
`;
const LAYOUT = (label: string): string => `import type { RouteProps } from "@keel/router";
import { Box, Input } from "@keel/ui";

// the empty-layout branch never renders under a page; the static check reads it all the same
export const Shell = (p: RouteProps) => {
  const kids = p.children;
  if (kids === undefined) return Input({ id: "m.l.empty", label: ${JSON.stringify(label)}, autocomplete: "off" });
  return Box({ id: "m.l.box", children: () => [kids()] });
};
`;
const PAGE = `import { Text } from "@keel/ui";

export const Page = () => Text({ id: "m.p.msg", children: "p" });
`;
const ROUTES = `import { manifest } from "@keel/router";
import { m } from "./m.contract.ts";
import { Shell } from "./Shell.ts";
import { Page } from "./Page.ts";

export const routes = manifest(m, {
  "m.l": { component: Shell },
  "m.p": { component: Page, title: () => "P", layout: "m.l" },
});
`;
const TEST = `${testHead(false)}
it("renders the page p inside its layout", async () => {
  const h = await renderRoute("m.p", { routes, ctx: ctx() });
  expect(h.find("m.p.msg").text).toBe("p");
  h.dispose();
});
`;
const ELSEWHERE = `import { Input } from "@keel/ui";

export const Elsewhere = () => Input({ id: "m.e.in", label: " ", autocomplete: "off" });
`;

// `keel build` refuses an E1802, so the project builds and tests clean, then `after` is written and `keel ledger` reads the tree
const withLayout = (prefix: string, after: Readonly<Record<string, string>>): { run: Run; checked: boolean } => {
  const dir = track(
    keelProject(prefix, {
      "topology.ts": `export default { api: { modules: ["m"], adapter: "node" } };\n`,
      "modules/m/m.contract.ts": CONTRACT,
      "modules/m/Shell.ts": LAYOUT("Name"),
      "modules/m/Page.ts": PAGE,
      "modules/m/routes.ts": ROUTES,
      "modules/m/test/p.test.ts": TEST,
    }),
  );
  expect(buildAndTest(dir).status).toBe(0);
  writeFiles(dir, after);
  const checked = keel(dir, ["check"]).records.some((r) => r.kind === "diag" && r.code === "E1802");
  return { run: keel(dir, ["ledger"]), checked };
};

describe("k.a11y: a layout's static codes count against every page it wraps", () => {
  it("an E1802 in layout `m.l`'s module makes `a11y:.:m.p#1.1.1` rung `none` after a passing `renderRoute` test of `m.p`", () => {
    const { run, checked } = withLayout("a11y-layout-e1802", { "modules/m/Shell.ts": LAYOUT(" ") });
    expect(checked).toBe(true);
    expect(itemRecord(run, "a11y:.:m.p#1.1.1")).toMatchObject({ rung: "none" });
  }, 120_000);

  it("without that E1802 the rung of `a11y:.:m.p#1.1.1` is `example`", () => {
    const { run, checked } = withLayout("a11y-layout-clean", {});
    expect(checked).toBe(false);
    expect(itemRecord(run, "a11y:.:m.p#1.1.1")).toMatchObject({ rung: "example" });
  }, 120_000);

  it("an E1802 in a module outside the page's chain does not change the rung of `a11y:.:m.p#1.1.1`", () => {
    const { run, checked } = withLayout("a11y-layout-other", { "modules/m/Elsewhere.ts": ELSEWHERE });
    expect(checked).toBe(true);
    expect(itemRecord(run, "a11y:.:m.p#1.1.1")).toMatchObject({ rung: "example" });
  }, 120_000);

  it("the layout `m.l` has no item of its own", () => {
    const { run, checked } = withLayout("a11y-layout-no-item", {});
    expect(new Set(a11yItems(run).map(routeOf))).toEqual(new Set(["m.p"]));
  }, 120_000);
});
