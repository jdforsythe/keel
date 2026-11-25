// k.scaffold, Guarantee "If `keel check` was clean before an operation, it is clean after."
// Real: each case materializes a project, runs the real `keel build` once (so `.keel/` and the generated build files exist), confirms `keel check` is clean,
// runs the real `keel scaffold <generator>` and asserts the generator exits 0, `keel check` is clean again, and no record anywhere carries E1005.
// No random input: one fixed project per generator.
import { afterAll, describe, expect, it } from "vitest";
import { type Files, ORDERS_OPENAPI, apply, fresh, withStoreCart } from "./fixtures.ts";
import { type CliRecord, cleanup, keel, materialize } from "./keel-cli.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

const diagCodes = (rs: CliRecord[]): unknown[] => rs.filter((r) => r.kind === "diag").map((r) => r.code);
const text = (rs: CliRecord[]): string => JSON.stringify(rs);

function freshNode(): Files {
  let files: Files = new Map();
  files = apply("project", { name: "shop", adapter: "node" }, files).files;
  files = apply("module", { id: "orders" }, files).files;
  files = apply("module", { id: "catalog" }, files).files;
  return files;
}

function builtClean(tree: Files): string {
  const dir = materialize(tree);
  dirs.push(dir);
  const build = keel(dir, ["build"]);
  expect(build.status, text(build.records)).toBe(0);
  const before = keel(dir, ["check"]);
  expect(before.status, text(before.records)).toBe(0);
  expect(diagCodes(before.records), "clean before the operation").toEqual([]);
  return dir;
}

function generate(tree: Files, args: string[]): void {
  const dir = builtClean(tree);
  const gen = keel(dir, ["scaffold", ...args]);
  expect(gen.status, text(gen.records)).toBe(0);
  expect(text(gen.records)).not.toContain("E1005");
  const after = keel(dir, ["check"]);
  expect(after.status, text(after.records)).toBe(0);
  expect(diagCodes(after.records), "clean after the operation").toEqual([]);
  expect(text(after.records)).not.toContain("E1005");
}

describe("in a built project, each generator leaves `keel check` clean with no E1005", () => {
  it("keel scaffold module billing", () => {
    generate(fresh(), ["module", "billing"]);
  }, 180000);
  it("keel scaffold route orders.show --path /orders/:id", () => {
    generate(fresh(), ["route", "orders.show", "--path", "/orders/:id"]);
  }, 180000);
  it("keel scaffold component orders/OrderCard", () => {
    generate(fresh(), ["component", "orders/OrderCard"]);
  }, 180000);
  it("keel scaffold store orders.cart", () => {
    generate(fresh(), ["store", "orders.cart"]);
  }, 180000);
  it("keel scaffold transaction orders.cart.addItem", () => {
    generate(withStoreCart(), ["transaction", "orders.cart.addItem"]);
  }, 180000);
  it("keel scaffold service orders --openapi openapi.json", () => {
    const tree = freshNode();
    tree.set("openapi.json", `${ORDERS_OPENAPI}\n`);
    generate(tree, ["service", "orders", "--openapi", "openapi.json"]);
  }, 180000);
});
