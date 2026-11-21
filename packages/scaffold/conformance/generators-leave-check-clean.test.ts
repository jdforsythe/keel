// Spec: k.scaffold, clause "Each generator run in a fresh project leaves `keel check` and `keel test` clean."
// Real: each generator's tree is materialized and the actual `keel` binary runs `check` and `test` on it.
// Extra cases keep the relative-import proxy (every relative import resolves to a file in the tree).
// Service (RFC 0039): `modules/orders/OrdersApi.schema.ts` exporting `OrdersApi` and `api.server.ts` exporting `api` satisfy
// E1752; the case runs both on the in-process placement and on the real `keel scaffold service --openapi` output.
import { afterAll, describe, expect, it } from "vitest";
import { type Files, ORDERS_OPENAPI, SERVICE_INPUT, apply, fresh, withStoreCart } from "./fixtures.ts";
import { type CliRecord, cleanup, keel, materialize, readTree } from "./keel-cli.ts";

function unresolved(files: Files): string[] {
  const bad: string[] = [];
  for (const [path, src] of files) {
    if (!/\.tsx?$/.test(path)) continue;
    for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const spec = m[1] ?? "";
      const parts = path.split("/").slice(0, -1);
      for (const seg of spec.split("/")) {
        if (seg === "..") parts.pop();
        else if (seg !== ".") parts.push(seg);
      }
      const target = parts.join("/");
      const cands = [
        target,
        `${target}.ts`,
        `${target}.tsx`,
        target.replace(/\.js$/, ".ts"),
        target.replace(/\.js$/, ".tsx"),
      ];
      if (!cands.some((c) => files.has(c))) bad.push(`${path} -> ${spec}`);
    }
  }
  return bad;
}

function freshNode(): Files {
  let files: Files = new Map();
  files = apply("project", { name: "shop", adapter: "node" }, files).files;
  files = apply("module", { id: "orders" }, files).files;
  files = apply("module", { id: "catalog" }, files).files;
  return files;
}

function nodeWithOpenApi(): Files {
  const f = freshNode();
  f.set("openapi.json", `${ORDERS_OPENAPI}\n`);
  return f;
}

describe("generators leave the tree self-consistent", () => {
  const gens: [Parameters<typeof apply>[0], Record<string, unknown>][] = [
    ["module", { id: "billing" }],
    ["route", { id: "orders.list", path: "/orders" }],
    ["component", { id: "orders/OrderTile" }],
    ["store", { id: "orders.basket" }],
  ];
  it("project leaves no unresolved relative import", () => {
    expect(unresolved(apply("project", { name: "shop" }, new Map()).files)).toEqual([]);
  });
  for (const [op, input] of gens) {
    it(`${String(op)} in a fresh project leaves no unresolved relative import`, () => {
      expect(unresolved(apply(op, input, fresh()).files)).toEqual([]);
    });
  }
});

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

function summaryOf(records: CliRecord[], name: string): CliRecord | undefined {
  return records.find((r) => r.kind === "summary" && r.name === name);
}
function counts(r: CliRecord | undefined): Record<string, unknown> {
  const c = r?.counts;
  return typeof c === "object" && c !== null ? { ...c } : {};
}

function clean(tree: Files): void {
  const dir = materialize(tree);
  dirs.push(dir);
  cleanDir(dir, [...tree.keys()].filter((p) => /\.test\.tsx?$/.test(p)).length);
}

function cleanDir(dir: string, testFiles: number): void {
  const diags = (rs: CliRecord[]) => JSON.stringify(rs.filter((r) => r.kind === "diag"));
  const check = keel(dir, ["check"]);
  const checkSummary = summaryOf(check.records, "check");
  expect(check.status, diags(check.records)).toBe(0);
  expect(checkSummary?.ok, diags(check.records)).toBe(true);
  expect(counts(checkSummary).errors, diags(check.records)).toBe(0);
  expect(counts(checkSummary).warnings, diags(check.records)).toBe(0);
  expect(check.records.filter((r) => r.kind === "diag")).toEqual([]);

  const test = keel(dir, ["test"]);
  const testSummary = summaryOf(test.records, "test");
  const detail = JSON.stringify(test.records.slice(0, 20));
  expect(test.status, detail).toBe(0);
  expect(testSummary?.ok, detail).toBe(true);
  expect(counts(testSummary).failed, detail).toBe(0);
  expect(Number(counts(testSummary).tests), detail).toBeGreaterThanOrEqual(testFiles);
}

describe("keel check and keel test are clean after each generator", () => {
  it("project in an empty tree leaves keel check and keel test clean", () => {
    clean(apply("project", { name: "shop" }, new Map()).files);
  }, 60000);
  it("module in a fresh project leaves keel check and keel test clean", () => {
    clean(apply("module", { id: "billing" }, fresh()).files);
  }, 60000);
  it("route orders.list at /orders in a fresh project leaves keel check and keel test clean", () => {
    clean(apply("route", { id: "orders.list", path: "/orders" }, fresh()).files);
  }, 60000);
  it("component orders/OrderTile in a fresh project leaves keel check and keel test clean", () => {
    clean(apply("component", { id: "orders/OrderTile" }, fresh()).files);
  }, 60000);
  it("store orders.basket in a fresh project leaves keel check and keel test clean", () => {
    clean(apply("store", { id: "orders.basket" }, fresh()).files);
  }, 60000);
  it("transaction: store orders.cart in a fresh project leaves keel check and keel test clean", () => {
    clean(withStoreCart());
  }, 60000);
  it("transaction orders.cart.addItem in a fresh project leaves keel check and keel test clean", () => {
    clean(apply("transaction", { id: "orders.cart.addItem" }, withStoreCart()).files);
  }, 60000);
  it("service: a fresh project leaves keel check and keel test clean", () => {
    clean(fresh());
  }, 60000);
  it("service orders with an OpenAPI-generated schema and service source leaves keel check and keel test clean", () => {
    clean(apply("service", SERVICE_INPUT, freshNode()).files);
  }, 60000);
  it("keel scaffold service orders --openapi openapi.json in a fresh node project leaves keel check and keel test clean", () => {
    const dir = materialize(nodeWithOpenApi());
    dirs.push(dir);
    const gen = keel(dir, ["scaffold", "service", "orders", "--openapi", "openapi.json"]);
    expect(gen.status, JSON.stringify(gen.records)).toBe(0);
    const tree = readTree(dir);
    expect(tree.get("modules/orders/OrdersApi.schema.ts")).toMatch(/^export const OrdersApi = endpoints\(/m);
    expect(tree.get("modules/orders/api.server.ts")).toContain('import { OrdersApi } from "./OrdersApi.schema.ts";');
    cleanDir(dir, [...tree.keys()].filter((p) => /\.test\.tsx?$/.test(p)).length);
  }, 60000);
});
