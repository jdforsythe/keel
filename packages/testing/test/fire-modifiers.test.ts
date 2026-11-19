// @vitest-environment happy-dom
// Spec: k.testing Harness: `fire` `keydown` takes `key` and the modifiers `shift`, `alt`, `mod`, each false when absent;
// a `Part`'s `onKey` sees them as `KeyInput`; `find(id).state` carries `active`, `sort` and `checked: 'mixed'`.
import { createCtx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Part } from "@keel/ui/aria";
import type { KeyInput } from "@keel/ui/aria";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const seen: KeyInput[] = [];
const Keys = Object.assign(
  (): Node => {
    const mixed = signal<boolean | "mixed">("mixed");
    return Part({
      id: "w",
      role: "generic",
      children: () => [
        Part({
          id: "lb",
          role: "listbox",
          label: "Fruit",
          tabIndex: 0,
          activeDescendant: "o",
          onKey: (k) => {
            seen.push(k);
            return true;
          },
          children: () => [Part({ id: "o", role: "option", selected: false, children: () => "Apple" })],
        }),
        Part({
          id: "t",
          role: "table",
          label: "Fruit",
          children: () => [
            Part({
              id: "g",
              role: "rowgroup",
              head: true,
              children: () => [
                Part({
                  id: "r",
                  role: "row",
                  children: () => [Part({ id: "h", role: "columnheader", sort: "descending", children: () => "Name" })],
                }),
              ],
            }),
          ],
        }),
        Part({ id: "all", role: "checkbox", label: "Select all", checked: mixed }),
      ],
    });
  },
  { Props: s.object({}) },
);
const ctx = () => createCtx({ mode: "sim", seed: 1337 });

describe("fire keydown modifiers", () => {
  it("a keydown without modifiers gives false for each", async () => {
    seen.length = 0;
    const t = render(Keys, { props: {}, ctx: ctx() });
    await t.fire("lb", { type: "keydown", key: "ArrowDown" });
    expect(seen).toEqual([{ key: "ArrowDown", shift: false, alt: false, mod: false }]);
    t.dispose();
  });

  it("each modifier given reaches onKey", async () => {
    const t = render(Keys, { props: {}, ctx: ctx() });
    await fc.assert(
      fc.asyncProperty(fc.boolean(), fc.boolean(), fc.boolean(), async (shift, alt, mod) => {
        seen.length = 0;
        await t.fire("lb", { type: "keydown", key: "ArrowDown", shift, alt, mod });
        expect(seen).toEqual([{ key: "ArrowDown", shift, alt, mod }]);
      }),
      { seed: 1337, numRuns: 16 },
    );
    t.dispose();
  });

  it("find(id).state carries active, sort and a mixed native checkbox", async () => {
    const t = render(Keys, { props: {}, ctx: ctx() });
    await t.settle();
    expect(t.find("lb").state.active).toBe("o");
    expect(t.find("h").state.sort).toBe("descending");
    expect(t.find("all").state.checked).toBe("mixed");
    t.dispose();
  });
});
