// "Generated files are read-only (E1005)."
// ASSUMED reading: an edit set that needs to write into a generated location (.keel/, turbo.json, CI) is refused with E1005
// and nothing is written; operations that add no module/package leave turbo.json and CI workflows byte-identical.
import { describe, expect, it } from "vitest";
import {
  type Files,
  apply,
  errText,
  fresh,
  isGenerated,
  scaffoldRaw,
  snap,
  withOrders,
  withSchema,
} from "./fixtures.ts";

function refuses(op: Parameters<typeof apply>[0], input: Record<string, unknown>, files: Files) {
  const before = snap(files);
  const r = scaffoldRaw(op, input, files);
  expect(r.ok).toBe(false);
  expect(errText(r)).toContain("E1005");
  expect(snap(files)).toBe(before);
}

describe("E1005", () => {
  it("component, store and route targeting a generated location are refused with E1005", () => {
    refuses("component", { id: ".keel/gen/Widget" }, fresh());
    refuses("store", { id: ".keel.cart" }, fresh());
    refuses("route", { id: "orders.show", path: "/x", file: ".keel/routes.json" }, fresh());
  });
  it("rename of a declaration that lives in a generated file is refused with E1005", () => {
    const f = withOrders();
    f.set(".keel/gen/Widget.tsx", "export default function Widget() {}\n");
    refuses("rename", { kind: "component", from: "Widget", to: "Gadget" }, f);
  });
  it("move of a file that lives in a generated location is refused with E1005", () => {
    const f = withOrders();
    f.set(".keel/gen/Widget.tsx", "export default function Widget() {}\n");
    refuses("move", { name: "Widget", to: "catalog" }, f);
  });
  it("add-field to a schema that lives in a generated file is refused with E1005", () => {
    const f = withSchema(false);
    f.set(".keel/gen/Gen.schema.ts", "export const Gen = s.object({ id: s.id('Gen') })\n");
    refuses("add-field", { schema: "Gen", field: "note", type: "string.optional" }, f);
  });
  it("operations that add no module or package leave turbo.json and CI workflows byte-identical", () => {
    const calls: [Parameters<typeof apply>[0], Record<string, unknown>][] = [
      ["route", { id: "orders.list", path: "/orders" }],
      ["component", { id: "orders/OrderTile" }],
      ["store", { id: "orders.basket" }],
      ["rename", { kind: "component", from: "OrderCard", to: "OrderTile" }],
      ["move", { name: "OrderCard", to: "catalog" }],
    ];
    for (const [op, input] of calls) {
      const before = withOrders();
      const out = apply(op, input, before).files;
      for (const [p, c] of before)
        if (p === "turbo.json" || p.startsWith(".github/workflows/")) expect(out.get(p), `${String(op)} ${p}`).toBe(c);
      expect(isGenerated("turbo.json")).toBe(true);
    }
  });
});
