// Mutation-killing tests for `keel scaffold` / `keel codemod`: exact records, labels, refusals and dry-run diffs.
import { beforeAll, describe, expect, it } from "vitest";
import { runEngine } from "../src/internal/runEngine.ts";
import type { Io } from "../src/types/Io.ts";

const CWD = "/work/shop";
type Files = { path: string; source: string }[];
const applied = (files: Files, writes: readonly { path: string; content: string | null }[]): Files => {
  const m = new Map(files.map((f) => [f.path, f.source]));
  for (const w of writes)
    if (w.content === null) m.delete(w.path);
    else m.set(w.path, w.content);
  return [...m].map(([path, source]) => ({ path, source }));
};
const manifest = (id: string, deps: string[], exports: string[]): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps)}, capabilities: [], public: { exports: ${JSON.stringify(exports)}, routes: [] } })\n`;

let tree: Files = [];
let cyclic: Files = [];
const go = (argv: string[], files: Files = tree) => runEngine(argv, { cwd: CWD, files } satisfies Io);

beforeAll(async () => {
  let files: Files = [];
  for (const argv of [
    ["scaffold", "project", "shop"],
    ["scaffold", "module", "orders"],
    ["scaffold", "module", "catalog"],
    ["scaffold", "component", "orders/OrderCard"],
    ["scaffold", "store", "orders.cartItems"],
    ["scaffold", "store", "orders.cart"],
    ["scaffold", "route", "orders.list", "--path", "/orders"],
  ])
    files = applied(
      files,
      // `scaffold project shop` writes under `shop/` (rfc:0068); the other ops run inside it.
      argv[1] === "project"
        ? (await runEngine(argv, { cwd: "/work", files })).writes.map((w) => ({
            ...w,
            path: w.path.replace(/^shop\//, ""),
          }))
        : (await runEngine(argv, { cwd: CWD, files })).writes,
    );
  tree = files;
  cyclic = applied(files, [
    { path: "modules/orders/module.ts", content: manifest("orders", [], ["OrderCard", "Other"]) },
    { path: "modules/orders/Other.ts", content: "export const Other = 1\n" },
    {
      path: "modules/orders/OrdersUse.ts",
      content: "import OrderCard from './OrderCard.tsx'\nexport const OrdersUse = OrderCard\n",
    },
    {
      path: "modules/catalog/CatalogOther.ts",
      content: "import { Other } from '../orders/Other.ts'\nexport const CatalogOther = Other\n",
    },
    { path: "modules/catalog/module.ts", content: manifest("catalog", ["orders"], []) },
    {
      path: "modules/catalog/CatalogRow.tsx",
      content:
        "import OrderCard from '../orders/OrderCard.tsx'\nexport default function CatalogRow() {\n  return OrderCard\n}\n",
    },
  ]);
}, 60_000);

describe("scaffold command routing", () => {
  it("no operation is an empty ok run with its own name", async () => {
    const s = await go(["scaffold"]);
    expect(s.result).toEqual({ code: 0, stdout: "ok scaffold 0 created, 0 changed, 0 removed\n", stderr: "" });
    expect(s.writes).toEqual([]);
    const c = await go(["codemod"]);
    expect(c.result.stdout).toBe("ok codemod 0 created, 0 changed, 0 removed\n");
    expect(c.records).toEqual([
      { kind: "summary", ok: true, name: "codemod", counts: { created: 0, changed: 0, removed: 0 } },
    ]);
  });

  it("transaction and service are scaffold-only operations", async () => {
    const c = await go(["codemod", "transaction", "x"]);
    expect(c.result.code).toBe(2);
    expect(c.result.stdout).toBe(
      'E1052 unknown codemod operation "transaction"; it is keel scaffold transaction\n  see: keel docs k.scaffold\nfail codemod\n',
    );
  });

  it("an unknown operation is E1052 with a pointer to the other command when it lives there", async () => {
    const r = await go(["scaffold", "bogusbogusbogusbogusbogusbogus"]);
    expect(r.result).toEqual({
      code: 2,
      stdout:
        'E1052 unknown scaffold operation "bogusbogusbogusbogusbogu"\n  see: keel docs k.scaffold\nfail scaffold\n',
      stderr: "",
    });
    expect(r.records[0]).toEqual({
      kind: "diag",
      code: "E1052",
      message: 'unknown scaffold operation "bogusbogusbogusbogusbogu"',
      see: "k.scaffold",
    });
    expect(r.writes).toEqual([]);
    for (const op of ["rename", "move", "add-field"])
      expect((await go(["scaffold", op, "a", "b"])).result.stdout).toBe(
        `E1052 unknown scaffold operation "${op}"; it is keel codemod ${op}\n  see: keel docs k.scaffold\nfail scaffold\n`,
      );
    for (const op of ["project", "module", "route", "component", "store"])
      expect((await go(["codemod", op, "a"])).result.stdout).toBe(
        `E1052 unknown codemod operation "${op}"; it is keel scaffold ${op}\n  see: keel docs k.scaffold\nfail codemod\n`,
      );
    expect((await go(["codemod", "zzz"])).result.stdout).toBe(
      'E1052 unknown codemod operation "zzz"\n  see: keel docs k.scaffold\nfail codemod\n',
    );
  });
});

describe("scaffold edits", () => {
  it("applied: edit records without diffs, writes with content and readonly false", async () => {
    const e = await go(["scaffold", "component", "app/Fresh"], applied(tree, []));
    expect(e.result.code).toBe(0);
    expect(e.records).toEqual([
      { kind: "scaffold.edit", action: "create", path: "modules/app/Fresh.test.tsx" },
      { kind: "scaffold.edit", action: "create", path: "modules/app/Fresh.tsx" },
      { kind: "summary", ok: true, name: "scaffold component", counts: { created: 2, changed: 0, removed: 0 } },
    ]);
    expect(e.writes.map((w) => [w.path, w.readonly])).toEqual([
      ["modules/app/Fresh.test.tsx", false],
      ["modules/app/Fresh.tsx", false],
    ]);
    expect(e.writes[1]?.content).toContain("export default function Fresh(");
  });

  it("dry run: unified diffs per action, no writes, label carries --dry-run", async () => {
    const mod = await go(["scaffold", "module", "billing", "--dry-run"]);
    expect(mod.writes).toEqual([]);
    const edits = mod.records.filter((r) => r.kind === "scaffold.edit");
    expect(edits.map((r) => r.action)).toEqual(["create", "create", "create", "change", "change", "change"]);
    const diffOf = (p: string): string => {
      const rec = edits.find((r) => r.path === p);
      return typeof rec?.diff === "string" ? rec.diff : "";
    };
    expect(
      diffOf("modules/billing/module.ts").startsWith("--- /dev/null\n+++ b/modules/billing/module.ts\n@@ -0,0 +1,"),
    ).toBe(true);
    const topo = diffOf("topology.ts");
    expect(topo.startsWith("--- a/topology.ts\n+++ b/topology.ts\n@@")).toBe(true);
    expect(topo).toContain("billing");
    expect(mod.result.stdout.split("\n").at(-2)).toBe("ok scaffold module --dry-run 3 created, 3 changed, 0 removed");

    const ren = await go(["codemod", "rename", "OrderCard", "OrderTile", "--dry-run"]);
    const gone = ren.records.filter((r) => r.kind === "scaffold.edit" && r.action === "remove");
    expect(gone).toHaveLength(2);
    for (const r of gone) {
      const diff = typeof r.diff === "string" ? r.diff : "";
      expect(diff.startsWith(`--- a/${String(r.path)}\n+++ /dev/null\n@@ -1,`)).toBe(true);
    }
    expect(ren.records.at(-1)).toEqual({
      kind: "summary",
      ok: true,
      name: "codemod rename --dry-run",
      counts: { created: 2, changed: 0, removed: 2 },
    });
    expect(ren.writes).toEqual([]);
  });

  it("applied rename: create, change, remove order; removes write null content", async () => {
    const e = await go(["codemod", "rename", "CartState", "BasketState"]);
    expect(
      e.records.map((r) => (r.kind === "scaffold.edit" ? `${String(r.action)} ${String(r.path)}` : r.kind)),
    ).toEqual([
      "create modules/orders/BasketState.schema.ts",
      "change modules/orders/cart.store.test.ts",
      "change modules/orders/cart.store.ts",
      "remove modules/orders/CartState.schema.ts",
      "summary",
    ]);
    expect(e.writes.map((w) => w.content === null)).toEqual([false, false, false, true]);
    expect(e.writes.every((w) => !w.readonly)).toBe(true);
  });
});

describe("codemod rename kind inference", () => {
  it("PascalCase falls from component to schema; dotted from store to route", async () => {
    expect((await go(["codemod", "rename", "CartState", "BasketState"])).result.code).toBe(0);
    const route = await go(["codemod", "rename", "orders.list", "orders.index"]);
    expect(route.result.code).toBe(0);
    expect(route.writes.map((w) => w.path)).toContain("modules/orders/IndexPage.tsx");
    const store = await go(["codemod", "rename", "orders.cart", "orders.basket"]);
    expect(store.writes.map((w) => w.path)).toContain("modules/orders/basket.store.ts");
  });

  it("only a leading capital selects the PascalCase kinds", async () => {
    const r = await go(["codemod", "rename", "orders.cartItems", "orders.basketItems"]);
    expect(r.result.code).toBe(0);
    expect(r.writes.map((w) => w.path)).toContain("modules/orders/basketItems.store.ts");
  });

  it("the last refusal is reported when no kind finds `from`", async () => {
    expect((await go(["codemod", "rename", "Nope", "Nada"])).result.stdout).toBe(
      "E1052 Nope:1:1 no schema named Nope\n  see: keel docs k.scaffold\nfail codemod rename\n",
    );
    expect((await go(["codemod", "rename", "nope.x", "nope.y"])).result.stdout).toBe(
      "E1052 nope.x:1:1 no route nope.x\n  see: keel docs k.scaffold\nfail codemod rename\n",
    );
  });

  it("a refusal other than E1052 stops the search at that kind", async () => {
    const r = await go(["codemod", "rename", "OrderCard", "bad_name", "--format=json"]);
    expect(r.result.code).toBe(1);
    expect(r.result.stdout).toBe(
      '{"kind":"diag","code":"E1352","path":"bad_name","line":1,"col":1,"message":"component name bad_name must be PascalCase","see":"k.scaffold"}\n{"kind":"summary","ok":false,"name":"codemod rename","counts":{}}\n',
    );
  });

  it("an explicit --kind is the only kind tried", async () => {
    const r = await go(["codemod", "rename", "OrderCard", "OrderTile", "--kind", "schema"]);
    expect(r.result.stdout).toBe(
      "E1052 OrderCard:1:1 no schema named OrderCard\n  see: keel docs k.scaffold\nfail codemod rename\n",
    );
    expect((await go(["codemod", "rename", "OrderCard", "OrderTile", "--kind", "component"])).result.code).toBe(0);
  });
});

describe("refusals", () => {
  it("carry location and see, write nothing, and name the operation", async () => {
    const dup = await go(["scaffold", "module", "orders", "--format=json"]);
    expect(dup.result.code).toBe(1);
    expect(dup.records).toEqual([
      {
        kind: "diag",
        code: "E1351",
        path: "modules/orders/module.ts",
        line: 1,
        col: 1,
        message: "module orders already exists; use a codemod",
        see: "k.scaffold",
      },
      { kind: "summary", ok: false, name: "scaffold module", counts: {} },
    ]);
    expect(dup.writes).toEqual([]);
  });

  it("an edit that would break check carries its cause diagnostic at line 1 col 1 under k.check", async () => {
    const r = await go(["codemod", "move", "OrderCard", "--to", "catalog"], cyclic);
    console.error(
      "DBG",
      JSON.stringify(r.writes.map((w) => [w.path, w.content?.slice(0, 300)])),
      [...cyclic.map((f) => f.path)].join(","),
    );
    expect(r.result.code).toBe(1);
    expect(r.writes).toEqual([]);
    expect(r.records).toEqual([
      {
        kind: "diag",
        code: "E1353",
        path: "modules/catalog/module.ts",
        line: 1,
        col: 1,
        message: "operation aborted, would introduce E1153: cycle in module deps: catalog -> orders -> c...",
        see: "k.scaffold",
      },
      {
        kind: "diag",
        code: "E1153",
        path: "modules/catalog/module.ts",
        line: 1,
        col: 1,
        message: "cycle in module deps: catalog -> orders -> catalog",
        see: "k.check",
      },
      { kind: "summary", ok: false, name: "codemod move", counts: {} },
    ]);
  });
});
