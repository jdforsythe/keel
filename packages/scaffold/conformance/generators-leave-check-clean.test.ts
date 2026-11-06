// Clause: Each generator run in a fresh project leaves `keel check` and `keel test` clean.
// UNTESTABLE here: `keel check` / `keel test` are k.cli, not in the @keel/scaffold API.
// Proxy asserted instead: every relative import in every generated source file resolves to a file in the tree.
import { describe, expect, it } from "vitest";
import { type Files, apply, fresh } from "./fixtures.ts";

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
