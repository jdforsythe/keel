// Spec: std.lists, Conformance "`activeId.get()` is `w.option.k2` when option `k2` of widget `w` is active, and `""` before `opened`."
// Spec: std.lists, listChart "`activeId` (the part id `<id>.<part>.<key>` of the active option, `""` when none)"
// Seed: 1337. Assumptions in lists-support.ts.
import { listChart } from "@keel/std-headless";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, inScope } from "./lists-support.ts";

const keys = fc.uniqueArray(fc.stringMatching(/^[A-Za-z0-9_-]{1,12}$/), { minLength: 1, maxLength: 6 });

describe("std.lists: activeId", () => {
  test("`activeId.get()` is `w.option.k2` when option `k2` of widget `w` is active", () => {
    const opts = [
      { key: "k1", text: "One" },
      { key: "k2", text: "Two" },
      { key: "k3", text: "Three" },
    ];
    const { value } = inScope(() => listChart("w", "option", () => opts));
    value.opened(1);
    expect(value.activeId.get()).toBe("w.option.k2");
    expect(value.partId("k3")).toBe("w.option.k3");
  });

  test("`activeId.get()` is the empty string before `opened`", () => {
    const opts = [{ key: "k1", text: "One" }];
    const { value } = inScope(() => listChart("w", "option", () => opts));
    expect(value.activeId.get()).toBe("");
  });

  test("property: the part id of every key is `<id>.<part>.<key>`, and `activeId` names the active one", () => {
    fc.assert(
      fc.property(keys, fc.nat(), (ks, pick) => {
        const opts = ks.map((key) => ({ key, text: key }));
        const { value } = inScope(() => listChart("w", "item", () => opts));
        const at = pick % ks.length;
        value.opened(at);
        expect(value.activeId.get()).toBe(`w.item.${ks[at]}`);
        for (const k of ks) expect(value.partId(k)).toBe(`w.item.${k}`);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
