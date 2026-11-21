// @vitest-environment happy-dom
// Spec: k.roles, Conformance "A `grid` with `rowCount` 6 and `readOnly` true writes `aria-rowcount="6"` and `aria-readonly="true"`; a `treeitem` with `level` 2, `setSize` 3 and `posInSet` 1 writes `aria-level="2" aria-setsize="3" aria-posinset="1"`; a `gridcell` with `colSpan` 2 writes `colspan="2"`; a `slider` with `disabled` writes the `disabled` attribute and no `aria-disabled`."
// Seed: 1337 (fc.assert below).
import { Part } from "@keel/ui/aria";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import { SEED, byId, cleanup, render } from "./roles-support.ts";

afterEach(cleanup);
const text = (): string => "x";

describe("k.roles attribute props", () => {
  test("a `grid` with `rowCount` 6 and `readOnly` true writes `aria-rowcount=\"6\"` and `aria-readonly=\"true\"`", () => {
    const { host, off } = render(() => Part({ id: "g", role: "grid", label: "G", rowCount: 6, readOnly: true, children: text }));
    expect(byId(host, "g").getAttribute("aria-rowcount")).toBe("6");
    expect(byId(host, "g").getAttribute("aria-readonly")).toBe("true");
    off();
  });

  test("a `treeitem` with `level` 2, `setSize` 3 and `posInSet` 1 writes `aria-level=\"2\" aria-setsize=\"3\" aria-posinset=\"1\"`", () => {
    const { host, off } = render(() =>
      Part({ id: "i", role: "treeitem", level: 2, setSize: 3, posInSet: 1, children: text }),
    );
    const el = byId(host, "i");
    expect(el.getAttribute("aria-level")).toBe("2");
    expect(el.getAttribute("aria-setsize")).toBe("3");
    expect(el.getAttribute("aria-posinset")).toBe("1");
    off();
  });

  test("a `gridcell` with `colSpan` 2 writes `colspan=\"2\"`, and any span writes its number", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (n) => {
        const { host, off } = render(() => Part({ id: "c", role: "gridcell", colSpan: n, children: text }));
        expect(byId(host, "c").getAttribute("colspan")).toBe(String(n));
        off();
      }),
      { seed: SEED, numRuns: 20 },
    );
    const { host, off } = render(() => Part({ id: "c", role: "gridcell", colSpan: 2, children: text }));
    expect(byId(host, "c").getAttribute("colspan")).toBe("2");
    off();
  });

  test("a `slider` with `disabled` writes the `disabled` attribute and no `aria-disabled`", () => {
    const { host, off } = render(() => Part({ id: "s", role: "slider", label: "S", min: 0, max: 10, value: 3, disabled: true }));
    expect(byId(host, "s").hasAttribute("disabled")).toBe(true);
    expect(byId(host, "s").hasAttribute("aria-disabled")).toBe(false);
    off();
  });
});
