// Spec: k.scaffold, clause "`--dry-run` writes nothing and prints the diff a following apply writes."
// In-process: a dry run (scaffold, nothing written) == the following apply. Printed form: the real `keel` binary prints unified diffs; an independent applier
// (unified-diff.ts) applies them to the before-tree and the result must equal what the following real apply writes.
// Both forms cover every generator and codemod, transaction and service included (RFC 0039).
import { describe, expect, it } from "vitest";
import {
  type Files,
  SERVICE_INPUT,
  apply,
  dryRun,
  fresh,
  snap,
  withOpenApi,
  withOrders,
  withSchema,
  withStoreCart,
} from "./fixtures.ts";
import { freshNode } from "./service-base-support.ts";
import { type CliRecord, cleanup, keel, materialize, readTree } from "./keel-cli.ts";
import { type PrintedEdit, applyEdits } from "./unified-diff.ts";

const calls: [Parameters<typeof apply>[0], Record<string, unknown>, () => Files][] = [
  ["project", { name: "shop" }, () => new Map()],
  ["module", { id: "billing" }, fresh],
  ["route", { id: "orders.list", path: "/orders" }, withOrders],
  ["component", { id: "orders/OrderTile" }, fresh],
  ["store", { id: "orders.basket" }, fresh],
  ["rename", { kind: "component", from: "OrderCard", to: "OrderTile" }, withOrders],
  ["move", { name: "OrderCard", to: "catalog" }, withOrders],
  ["add-field", { schema: "Order", field: "note", type: "string.optional" }, () => withSchema(true)],
  ["transaction", { id: "orders.cart.addItem" }, withStoreCart],
  ["service", SERVICE_INPUT, freshNode],
  ["service", { id: "orders", base: "https://api.example.com" }, freshNode],
  ["service", { id: "orders", base: "https://api.example.com", reason: "order list" }, fresh],
];

describe("scaffold (dry run)", () => {
  for (const [op, input, mk] of calls) {
    it(`${String(op)} --dry-run writes nothing and yields exactly the edit set the following apply writes`, () => {
      const files = mk();
      const before = snap(files);
      const p = dryRun(op, input, files);
      expect(snap(files)).toBe(before);
      expect(p.ok).toBe(true);
      const a = apply(op, input, files);
      expect(snap(files)).toBe(before);
      if (p.ok) {
        expect(p.value.created).toEqual(a.created);
        expect(p.value.changed).toEqual(a.changed);
        expect(snap(p.value.files)).toBe(snap(a.files));
      }
    });
  }
});

function printedEdits(records: CliRecord[]): PrintedEdit[] {
  const out: PrintedEdit[] = [];
  for (const r of records) {
    if (r.kind !== "scaffold.edit") continue;
    const { action, path, diff } = r;
    if (
      (action === "create" || action === "change" || action === "remove") &&
      typeof path === "string" &&
      typeof diff === "string"
    )
      out.push({ action, path, diff });
    else throw new Error(`malformed scaffold.edit record: ${JSON.stringify(r)}`);
  }
  return out;
}

const cli: [string, string[], () => Files][] = [
  ["scaffold project shop", ["scaffold", "project", "shop"], () => new Map()],
  ["scaffold module billing", ["scaffold", "module", "billing"], fresh],
  ["scaffold route orders.list --path /orders", ["scaffold", "route", "orders.list", "--path", "/orders"], withOrders],
  ["scaffold component orders/OrderTile", ["scaffold", "component", "orders/OrderTile"], fresh],
  ["scaffold store orders.basket", ["scaffold", "store", "orders.basket"], fresh],
  ["codemod rename OrderCard OrderTile", ["codemod", "rename", "OrderCard", "OrderTile"], withOrders],
  ["codemod move OrderCard --to catalog", ["codemod", "move", "OrderCard", "--to", "catalog"], withOrders],
  [
    "codemod add-field Order note string.optional",
    ["codemod", "add-field", "Order", "note", "string.optional"],
    () => withSchema(true),
  ],
  ["scaffold transaction orders.cart.addItem", ["scaffold", "transaction", "orders.cart.addItem"], withStoreCart],
  [
    "scaffold service orders --openapi openapi.json --reason order-list",
    ["scaffold", "service", "orders", "--openapi", "openapi.json", "--reason", "order-list"],
    withOpenApi,
  ],
  [
    "scaffold service orders --base https://api.example.com --reason order-list",
    ["scaffold", "service", "orders", "--base", "https://api.example.com", "--reason", "order-list"],
    fresh,
  ],
];

describe("keel --dry-run printed form", () => {
  for (const [name, args, mk] of cli) {
    it(`${name} --dry-run writes nothing and prints exactly the diff the following apply writes`, () => {
      const dir = materialize(mk());
      try {
        const before = readTree(dir);
        const dry = keel(dir, [...args, "--dry-run"]);
        expect(dry.status, JSON.stringify(dry.records)).toBe(0);
        expect(readTree(dir)).toEqual(before);
        const edits = printedEdits(dry.records);
        expect(edits.length).toBeGreaterThan(0);
        const patched = applyEdits(before, edits);
        const real = keel(dir, args);
        expect(real.status, JSON.stringify(real.records)).toBe(0);
        const after = readTree(dir);
        expect([...after.keys()].sort()).toEqual([...patched.keys()].sort());
        for (const [p, content] of after) expect(patched.get(p), p).toBe(content);
        // the apply reports the same paths and actions the dry run printed
        expect(real.records.filter((r) => r.kind === "scaffold.edit").map((r) => `${r.action} ${r.path}`)).toEqual(
          edits.map((e) => `${e.action} ${e.path}`),
        );
      } finally {
        cleanup(dir);
      }
    }, 60000);
  }
});
